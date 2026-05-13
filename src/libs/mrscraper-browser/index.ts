import { assert } from "console";
import { execSync } from "child_process";
import fetch from "node-fetch";
import {
  CDP_WEBSOCKET_ENDPOINT_REGEX,
  launch,
  Process,
} from "./browsers/launch.js";
import fs from "fs";

const rmOptions = {
  force: true,
  recursive: true,
  maxRetries: 5,
};
import path from "path";
import os from "os";
import { existsSync } from "fs";
import { Connection } from "./cdp/Connection.js";
import { NodeWebSocketTransport } from "./node/NodeWebSocketTransport.js";
import scraperConfig from "../../config/scraper.cofig.js";
import { blackList, debugGenerator } from "./utils.js";
import { Protocol } from "puppeteer";
import { delay } from "../../utils/general.utils.js";
import { FingerprintGenerator } from "./util/fingerprint-generator.js";
import { FirefoxLauncher } from "./firefox/index.js";
import { FFSession } from "./firefox/ffConnection.js";
import { FingerprintInjector } from "./util/fingerprint-injector.js";
import { ProxyDetails } from "../../interfaces.js";

const debug = debugGenerator("ChromeLauncher");

export enum SupportedBrowsers {
  CHROME = "chrome",
  CHROMEHEADLESSSHELL = "chrome-headless-shell",
  CHROMIUM = "chromium",
  FIREFOX = "firefox",
  CHROMEDRIVER = "chromedriver",
  BRAVE = "brave",
}
type TargetOS = "macos" | "windows" | "linux";

const OS_MAP: Record<string, TargetOS> = {
  darwin: "macos",
  win32: "windows",
  linux: "linux",
  // Add more mappings if necessary
};

const DEFAULT_VIEWPORT = Object.freeze({ width: 1920, height: 993 });

class BrowserLauncher {
  async launch(isFirefox: boolean, options: any) {
    if (!isFirefox) {
      return new ChromeLauncher().launch(options);
    }
    return new FirefoxLauncher().launch(
      {
        id: "",
        log: [""],
        type: "internal",
        method: "",
        params: {},
        startTime: 0,
        endTime: 0,
      },
      options,
    );
  }
}
export class ChromeLauncher {
  async launch(options: any = {}): Promise<Connection> {
    const {
      dumpio = false,
      env = process.env,
      handleSIGINT = true,
      handleSIGTERM = true,
      handleSIGHUP = true,
    } = options;
    const protocol = "cdp";
    const fingerprintGenerator = new FingerprintGenerator();
    const fingerprintInjector = new FingerprintInjector();
    const fingerprints = fingerprintGenerator.getFingerprint({
      devices: ["desktop"],
      screen: {
        // minWidth: 320,
        // maxWidth: 470,
        // minHeight: 600,
        // maxHeight: 900,
        minWidth: 800,
        maxWidth: 2560,
        minHeight: 600,
        maxHeight: 1080,
      },
      locales: ["zh-TW"],
      browsers: ["chrome"],
      operatingSystems: ["windows", "macos"],
    });
    // const width = fingerprints.fingerprint.screen.width;
    // const height = fingerprints.fingerprint.screen.height;
    // const display = this.getDisplay();
    // console.log("Display", display);
    // if (display) {
    //   const resolution = `${width}x${height}`;
    //   if (!this.resolutionExists(resolution)) {
    //     this.addNewResolution(resolution, width, height, display);
    //   }
    //   this.setResolution(resolution, display);
    // }
    //
    options.args = options.args || [];
    // options.args.push(
    //   `--window-size=${fingerprints.fingerprint.screen.width},${fingerprints.fingerprint.screen.height}`,
    // );
    let {
      fingerprint: { navigator },
    } = fingerprints;

    // navigator.userAgent =
    //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
    // // @ts-ignore
    // navigator.userAgentData = {
    //   // @ts-ignore
    //   brands: [
    //     { brand: "Chromium", version: "130" },
    //     { brand: "Google Chrome", version: "130" },
    //     { brand: "Not?A_Brand", version: "99" },
    //   ],
    //   // @ts-ignore
    //   mobile: false,
    //   platform: "Windows",
    //   architecture: "x86",
    //   bitness: "64",
    //   // @ts-ignore
    //   fullVersionList: [
    //     { brand: "Chromium", version: "130.0.0.0" },
    //     { brand: "Google Chrome", version: "130.0.0.0" },
    //     { brand: "Not?A_Brand", version: "99.0.0.0" },
    //   ],
    //   model: "",
    //   platformVersion: "10.0.0",
    //   uaFullVersion: "130.0.0.0",
    // };
    const ffArgs = [
      // "--fingerprint=100",
      // "--fingerprinting-canvas-image-data-noise",
      // "--fingerprinting-canvas-measuretext-noise",
      // "--fingerprinting-client-rects-noise",
      `--fingerprint-platform=${fingerprints.fingerprint.navigator?.userAgentData?.platform?.toLowerCase() || "windows"}`,
      `--fingerprint-platform-version=${fingerprints.fingerprint.navigator?.userAgentData?.platformVersion || "10.0.0"}`,
      `--fingerprint-hardware-concurrency=${fingerprints.fingerprint.navigator?.hardwareConcurrency || 8}`,
      // `--fingerprint-brand=Opera`,
      "--lang=zh-TW",
      "--accept-lang=zh-TW",
    ];

    // options.args.push(...ffArgs);
    const launchArgs = await this.computeLaunchArguments({
      ...options,
      protocol,
    });

    if (!existsSync(launchArgs.executablePath)) {
      throw new Error(
        `Browser was not found at the configured executablePath (${launchArgs.executablePath})`,
      );
    }

    const usePipe = launchArgs.args.includes("--remote-debugging-pipe");

    const onProcessExit = async () => {
      console.log("Browser exited");
      await this.cleanUserDataDir(launchArgs.userDataDir, {
        isTemp: launchArgs.isTempUserDataDir,
      });
    };
    const browserProcess: Process = launch({
      executablePath: launchArgs.executablePath,
      args: launchArgs.args,
      handleSIGHUP: handleSIGHUP,
      handleSIGTERM: handleSIGTERM,
      handleSIGINT: handleSIGINT,
      dumpio: dumpio,
      env: env,
      pipe: usePipe,
      onExit: onProcessExit,
    });

    debug("Browser launched");
    const cdpConnection: Connection = await this.createCdpSocketConnection(
      browserProcess,
      {
        timeout: options.timeout || 30000,
        protocolTimeout: 15000,
        slowMo: 0,
      },
    );

    debug("Connected to browser");
    // await cdpConnection.send("Fetch.enable", { handleAuthRequests: true });
    // await cdpConnection.send("Network.enable");
    // await cdpConnection.send("Network.setBlockedURLs", { urls: blackList });

    cdpConnection.on("Fetch.authRequired", async (data) => {
      try {
        debug("Proxy authentication required");
        const { requestId } = data;
        await cdpConnection.send("Fetch.continueWithAuth", {
          requestId,
          authChallengeResponse: {
            response: "ProvideCredentials",
            username: options.proxy?.username || "",
            password: options.proxy?.password || "",
          },
        });
        debug("Proxy authenticated");
      } catch (error) {
        debug("Error during Fetch.continueWithAuth:", error);
      }
    });

    cdpConnection.on("Fetch.requestPaused", async (data) => {
      const { requestId, request } = data;

      const bypassUrlPatterns = [".js", ".css", ".json"];
      const shouldBypassProxy = bypassUrlPatterns.some((pattern) =>
        request.url.endsWith(pattern),
      );
      //
      // if (shouldBypassProxy) {
      //   // console.log(`Bypassing proxy for: ${request.url}`);
      //   try {
      //     const response = await fetch(request.url, {
      //       method: request.method,
      //       headers: request.headers,
      //     });
      //     const body = await response.buffer();
      //     await cdpConnection.send("Fetch.fulfillRequest", {
      //       requestId,
      //       responseCode: response.status,
      //       responseHeaders: Object.entries(response.headers.raw()).map(
      //         ([name, value]) => ({
      //           name,
      //           value: value.join(", "),
      //         }),
      //       ),
      //       body: body.toString("base64"),
      //     });
      //   } catch (error) {
      //     // console.error("Failed to bypass proxy:", error);
      //     // await cdpConnection.send("Fetch.continueRequest", { requestId });
      //   }
      // } else {
      try {
        await cdpConnection.send("Fetch.continueRequest", { requestId });
      } catch (error) {
        console.error("Error during Fetch.continueRequest:", error);
      }
      // }
    });

    cdpConnection.on("disconnect", () => {
      console.error("CDP connection disconnected.");
    });

    cdpConnection.on("error", (error) => {
      console.error("CDP connection error:", error);
    });

    cdpConnection.on("close", async () => {
      console.error("CDP connection closed unexpectedly.");
      await this.handleConnectionClosure(browserProcess);
      // Attempt to reconnect or handle the closure gracefully
    });

    try {
      // navigator = {
      //   userAgent:
      //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      //   userAgentData: {
      //     // @ts-ignore
      //     brands: [
      //       { brand: "Chromium", version: "130" },
      //       { brand: "Google Chrome", version: "130" },
      //       { brand: "Not?A_Brand", version: "99" },
      //     ],
      //
      //     // @ts-ignore
      //     mobile: false,
      //     platform: "Windows",
      //     architecture: "x86",
      //     bitness: "64",
      //
      //     // @ts-ignore
      //     fullVersionList: [
      //       { brand: "Chromium", version: "130.0.6723.116" },
      //       { brand: "Google Chrome", version: "130.0.6723.116" },
      //       { brand: "Not?A_Brand", version: "99.0.0.0" },
      //     ],
      //     model: "",
      //     platformVersion: "10.0.0",
      //     uaFullVersion: "130.0.6723.116",
      //   },
      //   language: "zh-TW",
      //   languages: ["zh-TW"],
      //   platform: "Win32",
      //   deviceMemory: 8,
      //   hardwareConcurrency: 8,
      //   maxTouchPoints: 0,
      //   product: "Gecko",
      //   productSub: "20030107",
      //   vendor: "Google Inc.",
      //   // @ts-ignore
      //   vendorSub: null,
      //   doNotTrack: "1",
      //   appCodeName: "Mozilla",
      //   appName: "Netscape",
      //   appVersion:
      //     "5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      //
      //   // @ts-ignore
      //   oscpu: null,
      //   extraProperties: {
      //     // @ts-ignore
      //     vendorFlavors: ["chrome"],
      //     // @ts-ignore
      //     globalPrivacyControl: null,
      //     // @ts-ignore
      //     pdfViewerEnabled: true,
      //     // @ts-ignore
      //     installedApps: [],
      //   },
      //   // @ts-ignore
      //   webdriver: false,
      // };

      console.log(JSON.stringify(navigator));
      await cdpConnection.send("Emulation.setHardwareConcurrencyOverride", {
        hardwareConcurrency: navigator.hardwareConcurrency,
      });
      await delay(2000);
      await cdpConnection.send("Emulation.setLocaleOverride", {
        locale: navigator.language,
      });
      await delay(2000);
      // if (navigator.userAgentData === null) {

      // }
      await cdpConnection.send("Emulation.setUserAgentOverride", {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        userAgentMetadata: {
          platform: navigator.userAgentData?.platform || "Win32",
          brands: navigator.userAgentData
            ?.brands as unknown as Protocol.Emulation.UserAgentBrandVersion[],
          model: navigator.userAgentData?.model,
          mobile: navigator.userAgentData?.mobile as unknown as boolean,
          architecture: navigator.userAgentData?.architecture || "x86",
          platformVersion: navigator.userAgentData?.platformVersion,
          bitness: navigator.userAgentData?.bitness,
          fullVersionList: navigator?.userAgentData
            ?.fullVersionList as unknown as Protocol.Emulation.UserAgentBrandVersion[],
        },
      });

      await fingerprintInjector.attachFingerprintToPuppeteer(
        cdpConnection,
        fingerprints,
      );
      console.log("Fingerprint attached to CDP connection");
      await cdpConnection.send("Page.navigate", {
        url: "https://ipinfo.io/ip",
      });
      await delay(1000);
      await cdpConnection.send("Page.reload", {});
      const ip = await cdpTimeoutExecute(30000, cdpGetIp(cdpConnection));
      // const detail = await fetch(`https://ipinfo.io/widget/demo/${ip}`);
      // if (detail.ok) {
      //   const data: ProxyDetails = (await detail.json()) as ProxyDetails;
      //   console.log("Proxy details", data);
      //   const [lat, long] = data.data.loc.split(",");
      //   await cdpConnection.send("Emulation.setGeolocationOverride", {
      //     latitude: parseFloat(lat),
      //     longitude: parseFloat(long),
      //   });
      // }
      cdpConnection.ip = ip;
    } catch (error) {
      console.error("Error during setup", error);
    }

    return cdpConnection;
  }
  setResolution(resolution: string, display: string) {
    try {
      let cmd = `xrandr --output ${display} --mode ${resolution}`;
      console.log(`Setting resolution: ${resolution}...`, cmd);
      execSync(cmd);
      console.log(`Resolution set successfully.`);
    } catch (error) {
      console.error("Failed to set resolution:", error);
      throw error;
    }
  }
  addNewResolution(
    resolution: string,
    width: number,
    height: number,
    display: string,
  ) {
    try {
      let cmd = `cvt ${width} ${height}`;
      console.log(`Adding new resolution: ${resolution} to ${display}...`, cmd);

      // Generate modeline using cvt
      const modelineOutput = execSync(cmd).toString();
      const modeline = modelineOutput
        .split("\n")[1]
        .split(" ")
        .slice(1)
        .join(" ");
      const value = modeline.split(" ").slice(1).join(" ");
      cmd = `xrandr --newmode ${resolution} ${value}`;

      // Add new mode to xrandr
      execSync(cmd);
      console.log(`New mode created successfully.`, cmd);
      cmd = `xrandr --addmode ${display} ${resolution}`;
      execSync(cmd);
      console.log(`Resolution ${resolution} added successfully.`, cmd);
    } catch (error) {
      console.error("Failed to add resolution:", error);
      throw error;
    }
  }
  resolutionExists(resolution: string) {
    try {
      const xrandrOutput = execSync(`xrandr`).toString();
      return xrandrOutput.includes(resolution);
    } catch (error) {
      console.error("Error checking resolution:", error);
      return false;
    }
  }
  getDisplay() {
    try {
      const xrandrOutput = execSync("xrandr --current").toString();
      console.log("xrandrOutput", xrandrOutput);
      const match = xrandrOutput.match(/^([^\s]+) connected primary/m); // Updated regex
      return match ? match[1] : null;
    } catch (error) {
      console.error("Error getting display:", error);
      return null;
    }
  }

  async handleConnectionClosure(browserProcess: Process) {
    try {
      await browserProcess.close();
    } catch (error) {
      console.error("Failed to close browser process", error);
    }
  }
  getFeatures(flag: string, options: string[] = []): string[] {
    return options
      .filter((s) => {
        return s.startsWith(flag.endsWith("=") ? flag : `${flag}=`);
      })
      .map((s) => {
        return s.split(new RegExp(`${flag}=\\s*`))[1]?.trim();
      })
      .filter((s) => {
        return s;
      }) as string[];
  }
  removeMatchingFlags(array: string[], flag: string): string[] {
    const regex = new RegExp(`^${flag}=.*`);
    let i = 0;
    while (i < array.length) {
      if (regex.test(array[i]!)) {
        array.splice(i, 1);
      } else {
        i++;
      }
    }
    return array;
  }
  defaultArgs(options: any = {}): string[] {
    // See https://github.com/GoogleChrome/chrome-launcher/blob/main/docs/chrome-flags-for-tools.md

    const userDisabledFeatures = this.getFeatures(
      "--disable-features",
      options.args,
    );
    if (options.args && userDisabledFeatures.length > 0) {
      this.removeMatchingFlags(options.args, "--disable-features");
    }

    const userEnabledFeatures = this.getFeatures(
      "--enable-features",
      options.args,
    );
    if (options.args && userEnabledFeatures.length > 0) {
      this.removeMatchingFlags(options.args, "--enable-features");
    }

    const chromeArguments = [""].filter((arg) => {
      return arg !== "";
    });
    const {
      devtools = false,
      headless = !devtools,
      args = [],
      userDataDir,
    } = options;
    if (userDataDir) {
      chromeArguments.push(`--user-data-dir=${path.resolve(userDataDir)}`);
    }
    if (devtools) {
      chromeArguments.push("--auto-open-devtools-for-tabs");
    }
    if (headless) {
      chromeArguments.push(
        headless === "shell" ? "--headless" : "--headless=new",
        // "--hide-scrollbars",
        // "--mute-audio",
      );
    }
    if (
      // @ts-ignore
      args.every((arg) => {
        return arg.startsWith("-");
      })
    ) {
      // chromeArguments.push("about:blank");
    }
    chromeArguments.push(...args);
    return chromeArguments;
  }

  async computeLaunchArguments(options: any = {}): Promise<any> {
    const {
      ignoreDefaultArgs = false,
      args = [],
      pipe = false,
      debuggingPort,
      channel,
      executablePath,
    } = options;

    const chromeArguments = [
      "--incognito",
      "--start-maximized",
      "--allow-pre-commit-input",
      "--disable-background-networking",
      "--disable-blink-features=AutomationControlled",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-breakpad",
      "--disable-client-side-phishing-detection",
      "--disable-component-extensions-with-background-pages",
      "--disable-default-apps",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-hang-monitor",
      "--disable-infobars",
      "--disable-ipc-flooding-protection",
      "--disable-popup-blocking",
      "--disable-prompt-on-repost",
      "--disable-renderer-backgrounding",
      "--disable-search-engine-choice-screen",
      "--disable-sync",
      "--export-tagged-pdf",
      "--generate-pdf-document-outline",
      "--force-color-profile=srgb",
      "--metrics-recording-only",
      "--no-first-run",
      "--password-store=basic",
      "--use-mock-keychain",
      "--no-sandbox",
      "--disable-cpu",
    ];
    if (options.proxy) {
      chromeArguments.push(`--proxy-server=${options.proxy.server}`);
    }
    if (!ignoreDefaultArgs) {
      chromeArguments.push(...this.defaultArgs(options));
    } else if (Array.isArray(ignoreDefaultArgs)) {
      chromeArguments.push(
        ...this.defaultArgs(options).filter((arg) => {
          return !ignoreDefaultArgs.includes(arg);
        }),
      );
    } else {
      chromeArguments.push(...args);
    }

    if (
      !chromeArguments.some((argument) => {
        return argument.startsWith("--remote-debugging-");
      })
    ) {
      if (pipe) {
        assert(
          !debuggingPort,
          "Browser should be launched with either pipe or debugging port - not both.",
        );
        chromeArguments.push("--remote-debugging-pipe");
      } else {
        chromeArguments.push(`--remote-debugging-port=${debuggingPort || 0}`);
      }
    }

    let chromeExecutable = executablePath;
    if (!chromeExecutable) {
      assert(
        channel,
        `An \`executablePath\` or \`channel\` must be specified for \`puppeteer-core\``,
      );
      chromeExecutable = executablePath(channel, options.headless ?? true);
    }
    let isTempUserDataDir = false;
    // Check for the user data dir argument, which will always be set even
    // with a custom directory specified via the userDataDir option.
    let userDataDirIndex = chromeArguments.findIndex((arg) => {
      return arg.startsWith("--user-data-dir");
    });
    if (userDataDirIndex < 0) {
      isTempUserDataDir = true;
      const tmpDir = await fs.promises.mkdtemp(
        path.join(os.tmpdir(), "mrscraper-chrome-profile-"),
      );
      chromeArguments.push(`--user-data-dir=${tmpDir}`);
      userDataDirIndex = chromeArguments.length - 1;
    }

    const userDataDir = chromeArguments[userDataDirIndex]!.split("=", 2)[1];
    assert(typeof userDataDir === "string", "`--user-data-dir` is malformed");

    return {
      executablePath: chromeExecutable,
      args: chromeArguments,
      isTempUserDataDir: isTempUserDataDir,
      userDataDir: userDataDir,
    };
  }
  async createCdpSocketConnection(
    browserProcess: ReturnType<typeof launch>,
    opts: {
      timeout: number;
      protocolTimeout: number | undefined;
      slowMo: number;
    },
  ): Promise<Connection> {
    const browserWSEndpoint = await browserProcess.waitForLineOutput(
      CDP_WEBSOCKET_ENDPOINT_REGEX,
      opts.timeout,
    );
    const wsUrl = new URL(browserWSEndpoint);
    const url = await this.getWsUrl(parseInt(wsUrl.port) || 0);
    const transport = await NodeWebSocketTransport.create(url);
    return new Connection(url, transport, opts.slowMo, opts.protocolTimeout);
  }

  async cleanUserDataDir(
    path: string,
    opts: { isTemp: boolean },
  ): Promise<void> {
    debug("Cleaning user data dir", path, opts.isTemp);
    if (opts.isTemp) {
      try {
        await this.rm(path), console.log("Removed temp user data dir", path);
      } catch (error) {
        console.error("Failed removed tmp user data dir", error);
        throw error;
      }
    }
  }

  async rm(path: string): Promise<void> {
    if (!existsSync) return;
    await fs.promises.rm(path, rmOptions);
  }

  async getWsUrl(port: number): Promise<string> {
    const response = await fetch(`http://localhost:${port}/json`);
    const data: any[] = (await response.json()) as any[];
    return data[0].webSocketDebuggerUrl;
  }
}

// helper
export async function cdpGetIp(cdpConnection: Connection): Promise<string> {
  return new Promise((resolve, reject) => {
    let requestId: string | null = null;
    const onResponse = (data: Protocol.Network.ResponseReceivedEvent) => {
      const { response, requestId: reqId } = data;
      const { url } = response;
      debug("Response received", url);

      if (url.includes("ipinfo.io/ip")) {
        requestId = reqId; // Save the request ID for later use
        debug("Found ipinfo", url, response);
      }
    };
    const onLoadingFinished = async (
      data: Protocol.Network.LoadingFinishedEvent,
    ) => {
      if (data.requestId === requestId) {
        try {
          const response = await cdpConnection.send("Network.getResponseBody", {
            requestId: data.requestId,
          });
          debug("IP fetched successfully", response.body);
          resolve(response.body.trim()); // the response is plain text
        } catch (error) {
          console.error("Error getting the IP", error);
          reject(new Error("Failed to get IP from response"));
        } finally {
          cdpConnection.off("Network.responseReceived", onResponse);
          cdpConnection.off("Network.loadingFinished", onLoadingFinished);
        }
      }
    };

    cdpConnection.on("Network.responseReceived", onResponse);

    cdpConnection.on("Network.loadingFinished", onLoadingFinished);
  });
}
export async function cdpGetPc(cdpConnection: Connection): Promise<any> {
  return new Promise((resolve, reject) => {
    let requestId: string | null = null;
    const onResponse = (data: Protocol.Network.ResponseReceivedEvent) => {
      const { response } = data;
      const { url } = response;
      if (url.includes("get_pc") || url.includes("get_rw")) {
        debug("Found get_pc", url, requestId);
        requestId = data.requestId;
      }
    };
    const onLoadingFinished = async (
      data: Protocol.Network.LoadingFinishedEvent,
    ) => {
      if (data.requestId === requestId) {
        try {
          const response = await cdpConnection.send("Network.getResponseBody", {
            requestId: data.requestId,
          });
          const body = JSON.parse(response.body);
          if (!body?.data?.item && body?.error !== 266900002) {
            console.error("Request blocked");
            const error = new CdpShopeeError(
              "Blocked",
              CdpShopeeErrorType.BLOCKED,
              response.body,
              cdpConnection.ip,
              cdpConnection.proxy_id,
            );
            reject(error);
          } else {
            debug("Scrapping succeed");
            resolve(body);
          }
        } catch (error) {
          console.error(error);
          const err = new CdpShopeeError(
            "No response",
            CdpShopeeErrorType.NO_RESPONSE,
            undefined,
            cdpConnection.ip,
            cdpConnection.proxy_id,
          );

          reject(err);
        } finally {
          cdpConnection.off("Network.responseReceived", onResponse);
          cdpConnection.off("Network.loadingFinished", onLoadingFinished);
        }
      }
    };
    cdpConnection.on("Network.responseReceived", onResponse);
    cdpConnection.on("Network.loadingFinished", onLoadingFinished);
  });
}

// utils
export enum CdpShopeeErrorType {
  BLOCKED = "BLOCKED",
  BLOCKED_TOO_MANY_TIMES = "BLOCKED_TOO_MANY_TIMES",
  TIMEOUT = "TIMEOUT",
  NO_RESPONSE = "NO_RESPONSE",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
export class CdpShopeeError extends Error {
  status: CdpShopeeErrorType;
  ip?: string;
  proxy_id?: number;
  response?: string;
  constructor(
    message: string,
    status: CdpShopeeErrorType = CdpShopeeErrorType.BLOCKED,
    response?: string,
    ip?: string,
    proxy_id?: number,
  ) {
    super(message);
    this.name = "ShopeeError";
    this.status = status;
    this.response = response;
    this.ip = ip;
    this.proxy_id = proxy_id;
  }
}
export async function cdpTimeoutExecute(millis: number, promise: Promise<any>) {
  let timeout = null;

  const result = await Promise.race([
    (async () => {
      await new Promise((resolve) => {
        timeout = setTimeout(resolve, millis);
      });
      throw new CdpShopeeError(
        `Timeout hit: ${millis}`,
        CdpShopeeErrorType.TIMEOUT,
        "Timeout",
      );
    })(),
    (async () => {
      try {
        return await promise;
      } catch (error) {
        // Cancel timeout in error case
        if (timeout) clearTimeout(timeout);
        throw error;
      }
    })(),
  ]);
  if (timeout) clearTimeout(timeout); // is there a better way?
  return result;
}

// MAIN CODE
export const DEFAULT_OPTIONS = {
  acceptInsecureCerts: false,
  defaultViewport: DEFAULT_VIEWPORT,
  downloadBehavior: undefined,
  slowMo: 0,
  timeout: 30000, // 30 seconds
  waitForInitialPage: true,
  protocolTimeout: undefined,
  executablePath: scraperConfig.chromePath,
  headless: false,
  debuggingPort: 9222,
  targetFilter: undefined,
};
let mrscraperBrowser = new BrowserLauncher();

export default mrscraperBrowser;
