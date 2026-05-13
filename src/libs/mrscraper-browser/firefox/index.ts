/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { firefox } from "playwright";
import * as os from "os";
import path from "path";
import { FFBrowser } from "./ffBrowser.js";
import { FFSession, kBrowserCloseMessageId } from "./ffConnection.js";
import {
  envArrayToObject,
  launchProcess,
  type Env,
} from "./processLauncher.js";
import { ConnectionTransport, WebSocketTransport } from "./server/transport.js";
import type * as types from "./server/types.js";
import {
  debugMode,
  existsAsync,
  ManualPromise,
  wrapInASCIIBox,
} from "./utils.js";
import { isProtocolError, type ProtocolError } from "./server/protocolError.js";
import type { ChildProcess } from "child_process";
import { ProxySettings } from "./server/types.js";
import { RecentLogsCollector } from "./utils.js";
import { helper } from "./server/helper.js";
import { CallMetadata } from "@protocol/callMetadata.js";
import { DEFAULT_TIMEOUT, TimeoutSettings } from "./common/timeoutSettings.js";
import { Progress, ProgressController } from "./server/progress.js";
import fs from "fs";
import { PipeTransport } from "./server/pipeTransport.js";

export interface BrowserProcess {
  onclose?: (exitCode: number | null, signal: string | null) => void;
  process?: ChildProcess;
  kill(): Promise<void>;
  close(): Promise<void>;
}

export function normalizeProxySettings(
  proxy: types.ProxySettings,
): types.ProxySettings {
  let { server, bypass } = proxy;
  let url;
  try {
    // new URL('127.0.0.1:8080') throws
    // new URL('localhost:8080') fails to parse host or protocol
    // In both of these cases, we need to try re-parse URL with `http://` prefix.
    url = new URL(server);
    if (!url.host || !url.protocol) url = new URL("http://" + server);
  } catch (e) {
    url = new URL("http://" + server);
  }
  if (url.protocol === "socks4:" && (proxy.username || proxy.password))
    throw new Error(`Socks4 proxy protocol does not support authentication`);
  if (url.protocol === "socks5:" && (proxy.username || proxy.password))
    throw new Error(`Browser does not support socks5 proxy authentication`);
  server = url.protocol + "//" + url.host;
  if (bypass)
    bypass = bypass
      .split(",")
      .map((t) => t.trim())
      .join(",");
  return { ...proxy, server, bypass };
}

export type BrowserOptions = {
  name: string;
  isChromium: boolean;
  channel?: string;
  artifactsDir: string;
  downloadsPath: string;
  tracesDir: string;
  headful?: boolean;
  persistent?: types.BrowserContextOptions; // Undefined means no persistent context.
  browserProcess: BrowserProcess;
  customExecutablePath?: string;
  proxy?: ProxySettings;
  protocolLogger: types.ProtocolLogger;
  browserLogsCollector: RecentLogsCollector;
  slowMo?: number;
  wsEndpoint?: string; // Only there when connected over web socket.
  originalLaunchOptions: types.LaunchOptions;
};

export const kNoXServerRunningError =
  "Looks like you launched a headed browser without having a XServer running.\n" +
  "Set either 'headless: true' or use 'xvfb-run <your-playwright-app>' before running Playwright.\n\n<3 Playwright Team";

export abstract class BrowserReadyState {
  protected readonly _wsEndpoint = new ManualPromise<string | undefined>();

  onBrowserExit(): void {
    // Unblock launch when browser prematurely exits.
    this._wsEndpoint.resolve(undefined);
  }
  async waitUntilReady(): Promise<{ wsEndpoint?: string }> {
    const wsEndpoint = await this._wsEndpoint;
    return { wsEndpoint };
  }

  abstract onBrowserOutput(message: string): void;
}

export abstract class BrowserType {
  private _name: string;
  _useBidi: boolean = false;

  constructor() {
    this._name = "firefox";
  }

  executablePath(): string {
    return firefox.executablePath();
  }

  name(): string {
    return this._name;
  }

  async launch(
    metadata: CallMetadata,
    options: types.LaunchOptions,
    protocolLogger?: types.ProtocolLogger,
  ) {
    options = this._validateLaunchOptions(options);
    if (this._useBidi) options.useWebSocket = true;
    const controller = new ProgressController(metadata);
    controller.setLogName("browser");
    const browser = await controller.run((progress) => {
      return this._innerLaunchWithRetries(
        progress,
        options,
        undefined,
        helper.debugProtocolLogger(protocolLogger),
        // "/home/leight/tmp/mrscraper-chrome-profile-0",
      ).catch((e) => {
        throw this._rewriteStartupLog(e);
      });
    }, TimeoutSettings.launchTimeout(options));
    return browser;
  }

  async _innerLaunchWithRetries(
    progress: Progress,
    options: types.LaunchOptions,
    persistent: types.BrowserContextOptions | undefined,
    protocolLogger: types.ProtocolLogger,
    userDataDir?: string,
  ) {
    try {
      return await this._innerLaunch(
        progress,
        options,
        persistent,
        protocolLogger,
        userDataDir,
      );
    } catch (error: any) {
      // @see https://github.com/microsoft/playwright/issues/5214
      const errorMessage =
        typeof error === "object" && typeof error.message === "string"
          ? error.message
          : "";
      if (errorMessage.includes("Inconsistency detected by ld.so")) {
        progress.log(
          `<restarting browser due to hitting race condition in glibc>`,
        );
        return this._innerLaunch(
          progress,
          options,
          persistent,
          protocolLogger,
          userDataDir,
        );
      }
      throw error;
    }
  }

  async _innerLaunch(
    progress: Progress,
    options: types.LaunchOptions,
    persistent: types.BrowserContextOptions | undefined,
    protocolLogger: types.ProtocolLogger,
    maybeUserDataDir?: string,
  ) {
    options.proxy = options.proxy
      ? normalizeProxySettings(options.proxy)
      : undefined;
    const browserLogsCollector = new RecentLogsCollector();
    const { browserProcess, userDataDir, artifactsDir, transport } =
      await this._launchProcess(
        progress,
        options,
        !!persistent,
        browserLogsCollector,
        maybeUserDataDir,
      );
    if ((options as any).__testHookBeforeCreateBrowser)
      await (options as any).__testHookBeforeCreateBrowser();
    const browserOptions: BrowserOptions = {
      name: this._name,
      isChromium: this._name === "chromium",
      channel: options.channel,
      slowMo: options.slowMo,
      persistent,
      headful: !options.headless,
      artifactsDir,
      downloadsPath: (options.downloadsPath || artifactsDir)!,
      tracesDir: (options.tracesDir || artifactsDir)!,
      browserProcess,
      customExecutablePath: options.executablePath,
      proxy: options.proxy,
      protocolLogger,
      browserLogsCollector,
      wsEndpoint: options.useWebSocket
        ? (transport as WebSocketTransport).wsEndpoint
        : undefined,
      originalLaunchOptions: options,
    };
    copyTestHooks(options, browserOptions);
    const browser = await this.connectToTransport(transport, browserOptions);
    (browser as any)._userDataDirForTest = userDataDir;
    return browser;
  }

  private async _launchProcess(
    progress: Progress,
    options: types.LaunchOptions,
    isPersistent: boolean,
    browserLogsCollector: RecentLogsCollector,
    userDataDir?: string,
  ): Promise<{
    browserProcess: BrowserProcess;
    artifactsDir: string;
    userDataDir: string;
    transport: ConnectionTransport;
  }> {
    const {
      ignoreDefaultArgs,
      ignoreAllDefaultArgs,
      args = [],
      executablePath = null,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
    } = options;

    const env = options.env ? envArrayToObject(options.env) : process.env;

    await this._createArtifactDirs(options);

    const tempDirectories = [];
    const artifactsDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "playwright-artifacts-"),
    );
    tempDirectories.push(artifactsDir);

    if (userDataDir) {
      // Firefox bails if the profile directory does not exist, Chrome creates it. We ensure consistent behavior here.
      if (!(await existsAsync(userDataDir)))
        await fs.promises.mkdir(userDataDir, { recursive: true, mode: 0o700 });
    } else {
      userDataDir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), `playwright_${this._name}dev_profile-`),
      );
      tempDirectories.push(userDataDir);
    }
    await this.prepareUserDataDir(options, userDataDir);

    const browserArguments = [];
    if (ignoreAllDefaultArgs) browserArguments.push(...args);
    else if (ignoreDefaultArgs)
      browserArguments.push(
        ...this.defaultArgs(options, isPersistent, userDataDir).filter(
          (arg) => ignoreDefaultArgs.indexOf(arg) === -1,
        ),
      );
    else
      browserArguments.push(
        ...this.defaultArgs(options, isPersistent, userDataDir),
      );

    let executable: string;
    if (executablePath) {
      if (!(await existsAsync(executablePath)))
        throw new Error(
          `Failed to launch ${this._name} because executable doesn't exist at ${executablePath}`,
        );
      executable = executablePath;
    } else {
      executable = firefox.executablePath();
    }

    const readyState = this.readyState(options);
    // Note: it is important to define these variables before launchProcess, so that we don't get
    // "Cannot access 'browserServer' before initialization" if something went wrong.
    let transport: ConnectionTransport | undefined = undefined;
    let browserProcess: BrowserProcess | undefined = undefined;
    const { launchedProcess, gracefullyClose, kill } = await launchProcess({
      command: executable,
      args: browserArguments,
      env: this.amendEnvironment(
        env,
        userDataDir,
        executable,
        browserArguments,
      ),
      handleSIGINT,
      handleSIGTERM,
      handleSIGHUP,
      log: (message: string) => {
        readyState?.onBrowserOutput(message);
        progress.log(message);
        browserLogsCollector.log(message);
      },
      stdio: "pipe",
      tempDirectories,
      attemptToGracefullyClose: async () => {
        if ((options as any).__testHookGracefullyClose)
          await (options as any).__testHookGracefullyClose();
        // We try to gracefully close to prevent crash reporting and core dumps.
        // Note that it's fine to reuse the pipe transport, since
        // our connection ignores kBrowserCloseMessageId.
        this.attemptToGracefullyCloseBrowser(transport!);
      },
      onExit: (exitCode, signal) => {
        // Unblock launch when browser prematurely exits.
        readyState?.onBrowserExit();
        if (browserProcess && browserProcess.onclose)
          browserProcess.onclose(exitCode, signal);
      },
    });
    async function closeOrKill(timeout: number): Promise<void> {
      let timer: NodeJS.Timeout;
      try {
        await Promise.race([
          gracefullyClose(),
          new Promise(
            (resolve, reject) => (timer = setTimeout(reject, timeout)),
          ),
        ]);
      } catch (ignored) {
        await kill().catch((ignored) => {}); // Make sure to await actual process exit.
      } finally {
        clearTimeout(timer!);
      }
    }
    browserProcess = {
      onclose: undefined,
      process: launchedProcess,
      close: () =>
        closeOrKill(
          (options as any).__testHookBrowserCloseTimeout || DEFAULT_TIMEOUT,
        ),
      kill,
    };
    progress.cleanupWhenAborted(() =>
      closeOrKill(progress.timeUntilDeadline()),
    );
    const wsEndpoint = (await readyState?.waitUntilReady())?.wsEndpoint;
    if (options.useWebSocket) {
      transport = await WebSocketTransport.connect(progress, wsEndpoint!);
    } else {
      const stdio = launchedProcess.stdio as unknown as [
        NodeJS.ReadableStream,
        NodeJS.WritableStream,
        NodeJS.WritableStream,
        NodeJS.WritableStream,
        NodeJS.ReadableStream,
      ];
      transport = new PipeTransport(stdio[3], stdio[4]);
    }
    return { browserProcess, artifactsDir, userDataDir, transport };
  }

  async _createArtifactDirs(options: types.LaunchOptions): Promise<void> {
    if (options.downloadsPath)
      await fs.promises.mkdir(options.downloadsPath, { recursive: true });
    if (options.tracesDir)
      await fs.promises.mkdir(options.tracesDir, { recursive: true });
  }

  private _validateLaunchOptions(
    options: types.LaunchOptions,
  ): types.LaunchOptions {
    const { devtools = false } = options;
    let { headless = !devtools, downloadsPath, proxy } = options;
    if (debugMode()) headless = false;
    if (downloadsPath && !path.isAbsolute(downloadsPath))
      downloadsPath = path.join(process.cwd(), downloadsPath);

    return { ...options, devtools, headless, downloadsPath, proxy };
  }

  _rewriteStartupLog(error: Error): Error {
    if (!isProtocolError(error)) return error;
    return this.doRewriteStartupLog(error);
  }

  readyState(options: types.LaunchOptions): BrowserReadyState | undefined {
    return undefined;
  }

  async prepareUserDataDir(
    options: types.LaunchOptions,
    userDataDir: string,
  ): Promise<void> {}

  getExecutableName(options: types.LaunchOptions): string {
    return options.channel || this._name;
  }

  abstract defaultArgs(
    options: types.LaunchOptions,
    isPersistent: boolean,
    userDataDir: string,
  ): string[];
  abstract connectToTransport(
    transport: ConnectionTransport,
    options: BrowserOptions,
  ): Promise<FFSession>;
  abstract amendEnvironment(
    env: Env,
    userDataDir: string,
    executable: string,
    browserArguments: string[],
  ): Env;
  abstract doRewriteStartupLog(error: ProtocolError): ProtocolError;
  abstract attemptToGracefullyCloseBrowser(
    transport: ConnectionTransport,
  ): void;
}

function copyTestHooks(from: object, to: object) {
  for (const [key, value] of Object.entries(from)) {
    if (key.startsWith("__testHook")) (to as any)[key] = value;
  }
}

export class FirefoxLauncher extends BrowserType {
  override connectToTransport(
    transport: ConnectionTransport,
    options: BrowserOptions,
  ): Promise<FFSession> {
    return FFBrowser.connect(transport, options);
  }

  override doRewriteStartupLog(error: ProtocolError): ProtocolError {
    if (!error.logs) return error;
    // https://github.com/microsoft/playwright/issues/6500
    if (
      error.logs.includes(
        `as root in a regular user's session is not supported.`,
      )
    )
      error.logs =
        "\n" +
        wrapInASCIIBox(
          `Firefox is unable to launch if the $HOME folder isn't owned by the current user.\nWorkaround: Set the HOME=/root environment variable${process.env.GITHUB_ACTION ? " in your GitHub Actions workflow file" : ""} when running Playwright.`,
          1,
        );
    if (error.logs.includes("no DISPLAY environment variable specified"))
      error.logs = "\n" + wrapInASCIIBox(kNoXServerRunningError, 1);
    return error;
  }

  override amendEnvironment(
    env: Env,
    userDataDir: string,
    executable: string,
    browserArguments: string[],
  ): Env {
    if (!path.isAbsolute(os.homedir()))
      throw new Error(
        `Cannot launch Firefox with relative home directory. Did you set ${os.platform() === "win32" ? "USERPROFILE" : "HOME"} to a relative path?`,
      );
    if (os.platform() === "linux") {
      // Always remove SNAP_NAME and SNAP_INSTANCE_NAME env variables since they
      // confuse Firefox: in our case, builds never come from SNAP.
      // See https://github.com/microsoft/playwright/issues/20555
      return { ...env, SNAP_NAME: undefined, SNAP_INSTANCE_NAME: undefined };
    }
    return env;
  }

  override attemptToGracefullyCloseBrowser(
    transport: ConnectionTransport,
  ): void {
    const message = {
      method: "Browser.close",
      params: {},
      id: kBrowserCloseMessageId,
    };
    transport.send(message);
  }

  override defaultArgs(
    options: types.LaunchOptions,
    isPersistent: boolean,
    userDataDir: string,
  ): string[] {
    const { args = [], headless } = options;

    if (args.find((arg) => arg.startsWith("-juggler")))
      throw new Error("Use the port parameter instead of -juggler argument");
    const firefoxArguments = ["-no-remote"];
    if (headless) {
      firefoxArguments.push("-headless");
    } else {
      firefoxArguments.push("-wait-for-browser");
      firefoxArguments.push("-foreground");
    }
    firefoxArguments.push(`-profile`, userDataDir);
    firefoxArguments.push("-juggler-pipe");
    firefoxArguments.push(...args);
    if (isPersistent) firefoxArguments.push("about:blank");
    else firefoxArguments.push("https://ipinfo.io/ip");
    return firefoxArguments;
  }

  override readyState(
    options: types.LaunchOptions,
  ): BrowserReadyState | undefined {
    return new JugglerReadyState();
  }
}

class JugglerReadyState extends BrowserReadyState {
  override onBrowserOutput(message: string): void {
    if (message.includes("Juggler listening to the pipe"))
      this._wsEndpoint.resolve(undefined);
  }
}

let mrscraperFirefox = new FirefoxLauncher();
export default mrscraperFirefox;
