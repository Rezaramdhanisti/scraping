/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { __dirname } from "../../../index.js";
import * as dns from "dns";
import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as tls from "tls";
import path from "path";
import type { StackFrame } from "../../protocol/src/channels.js";
import colors from "colors/safe.js";
import StackUtils from "stack-utils";
import pkg from "debug";
const { debug } = pkg;
import fs from "fs";
import type { EventEmitter } from "events";
import * as yazl from "yazl";
import scraperConfig from "../../../config/scraper.cofig.js";
export function getFromENV(name: string): string | undefined {
  let value = process.env[name];
  value =
    value === undefined
      ? process.env[`npm_config_${name.toLowerCase()}`]
      : value;
  value =
    value === undefined
      ? process.env[`npm_package_config_${name.toLowerCase()}`]
      : value;
  return value;
}
const debugEnv = getFromENV("PWDEBUG") || "";
export function debugMode() {
  if (debugEnv === "console") return "console";
  if (debugEnv === "0" || debugEnv === "false") return "";
  return debugEnv ? "inspector" : "";
}
export function wrapInASCIIBox(text: string, padding = 0): string {
  const lines = text.split("\n");
  const maxLength = Math.max(...lines.map((line) => line.length));
  return [
    "╔" + "═".repeat(maxLength + padding * 2) + "╗",
    ...lines.map(
      (line) =>
        "║" +
        " ".repeat(padding) +
        line +
        " ".repeat(maxLength - line.length + padding) +
        "║",
    ),
    "╚" + "═".repeat(maxLength + padding * 2) + "╝",
  ].join("\n");
}

export function jsonStringifyForceASCII(object: any): string {
  return JSON.stringify(object).replace(
    /[\u007f-\uffff]/g,
    (c) => "\\u" + ("0000" + c.charCodeAt(0).toString(16)).slice(-4),
  );
}
export const fileUploadSizeLimit = 50 * 1024 * 1024;

export const existsAsync = (path: string): Promise<boolean> =>
  new Promise((resolve) => fs.stat(path, (err) => resolve(!err)));

export async function mkdirIfNeeded(filePath: string) {
  // This will harmlessly throw on windows if the dirname is the root directory.
  await fs.promises
    .mkdir(path.dirname(filePath), { recursive: true })
    .catch(() => {});
}

export async function removeFolders(dirs: string[]): Promise<Error[]> {
  return await Promise.all(
    dirs.map((dir: string) =>
      fs.promises
        .rm(dir, { recursive: true, force: true, maxRetries: 10 })
        .catch((e) => e),
    ),
  );
}

export function canAccessFile(file: string) {
  if (!file) return false;

  try {
    fs.accessSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

export async function copyFileAndMakeWritable(from: string, to: string) {
  await fs.promises.copyFile(from, to);
  await fs.promises.chmod(to, 0o664);
}

export function sanitizeForFilePath(s: string) {
  return s.replace(/[\x00-\x2C\x2E-\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, "-");
}

export function toPosixPath(aPath: string): string {
  return aPath.split(path.sep).join(path.posix.sep);
}

type NameValue = { name: string; value: string };
type SerializedFSOperation =
  | {
      op: "mkdir";
      dir: string;
    }
  | {
      op: "writeFile";
      file: string;
      content: string | Buffer;
      skipIfExists?: boolean;
    }
  | {
      op: "appendFile";
      file: string;
      content: string;
    }
  | {
      op: "copyFile";
      from: string;
      to: string;
    }
  | {
      op: "zip";
      entries: NameValue[];
      zipFileName: string;
    };

export class SerializedFS {
  private _buffers = new Map<string, string[]>(); // Should never be accessed from within appendOperation.
  private _error: Error | undefined;
  private _operations: SerializedFSOperation[] = [];
  private _operationsDone: ManualPromise<void>;

  constructor() {
    this._operationsDone = new ManualPromise();
    this._operationsDone.resolve(); // No operations scheduled yet.
  }

  mkdir(dir: string) {
    this._appendOperation({ op: "mkdir", dir });
  }

  writeFile(file: string, content: string | Buffer, skipIfExists?: boolean) {
    this._buffers.delete(file); // No need to flush the buffer since we'll overwrite anyway.
    this._appendOperation({ op: "writeFile", file, content, skipIfExists });
  }

  appendFile(file: string, text: string, flush?: boolean) {
    if (!this._buffers.has(file)) this._buffers.set(file, []);
    this._buffers.get(file)!.push(text);
    if (flush) this._flushFile(file);
  }

  private _flushFile(file: string) {
    const buffer = this._buffers.get(file);
    if (buffer === undefined) return;
    const content = buffer.join("");
    this._buffers.delete(file);
    this._appendOperation({ op: "appendFile", file, content });
  }

  copyFile(from: string, to: string) {
    this._flushFile(from);
    this._buffers.delete(to); // No need to flush the buffer since we'll overwrite anyway.
    this._appendOperation({ op: "copyFile", from, to });
  }

  async syncAndGetError() {
    for (const file of this._buffers.keys()) this._flushFile(file);
    await this._operationsDone;
    return this._error;
  }

  zip(entries: NameValue[], zipFileName: string) {
    for (const file of this._buffers.keys()) this._flushFile(file);

    // Chain the export operation against write operations,
    // so that files do not change during the export.
    this._appendOperation({ op: "zip", entries, zipFileName });
  }

  // This method serializes all writes to the trace.
  private _appendOperation(op: SerializedFSOperation): void {
    const last = this._operations[this._operations.length - 1];
    if (
      last?.op === "appendFile" &&
      op.op === "appendFile" &&
      last.file === op.file
    ) {
      // Merge pending appendFile operations for performance.
      last.content += op.content;
      return;
    }

    this._operations.push(op);
    if (this._operationsDone.isDone()) this._performOperations();
  }

  private async _performOperations() {
    this._operationsDone = new ManualPromise();
    while (this._operations.length) {
      const op = this._operations.shift()!;
      // Ignore all operations after the first error.
      if (this._error) continue;
      try {
        await this._performOperation(op);
      } catch (e: any) {
        this._error = e;
      }
    }
    this._operationsDone.resolve();
  }

  private async _performOperation(op: SerializedFSOperation) {
    switch (op.op) {
      case "mkdir": {
        await fs.promises.mkdir(op.dir, { recursive: true });
        return;
      }
      case "writeFile": {
        // Note: 'wx' flag only writes when the file does not exist.
        // See https://nodejs.org/api/fs.html#file-system-flags.
        // This way tracing never have to write the same resource twice.
        if (op.skipIfExists)
          await fs.promises
            .writeFile(op.file, op.content, { flag: "wx" })
            .catch(() => {});
        else await fs.promises.writeFile(op.file, op.content);
        return;
      }
      case "copyFile": {
        await fs.promises.copyFile(op.from, op.to);
        return;
      }
      case "appendFile": {
        await fs.promises.appendFile(op.file, op.content);
        return;
      }
      case "zip": {
        const zipFile = new yazl.ZipFile();
        const result = new ManualPromise<void>();
        (zipFile as any as EventEmitter).on("error", (error) =>
          result.reject(error),
        );
        for (const entry of op.entries)
          zipFile.addFile(entry.value, entry.name);
        zipFile.end();
        zipFile.outputStream
          .pipe(fs.createWriteStream(op.zipFileName))
          .on("close", () => result.resolve())
          .on("error", (error) => result.reject(error));
        await result;
        return;
      }
    }
  }
}

export type RegisteredListener = {
  emitter: EventEmitter;
  eventName: string | symbol;
  handler: (...args: any[]) => void;
};

class EventsHelper {
  static addEventListener(
    emitter: EventEmitter,
    eventName: string | symbol,
    handler: (...args: any[]) => void,
  ): RegisteredListener {
    emitter.on(eventName, handler);
    return { emitter, eventName, handler };
  }

  static removeEventListeners(
    listeners: Array<{
      emitter: EventEmitter;
      eventName: string | symbol;
      handler: (...args: any[]) => void;
    }>,
  ) {
    for (const listener of listeners)
      listener.emitter.removeListener(listener.eventName, listener.handler);
    listeners.splice(0, listeners.length);
  }
}

export const eventsHelper = EventsHelper;
let _isUnderTest = !!process.env.PWTEST_UNDER_TEST;
export function setUnderTest() {
  _isUnderTest = true;
}
export function isUnderTest(): boolean {
  return _isUnderTest;
}
export function isRegExp(obj: any): obj is RegExp {
  return (
    obj instanceof RegExp ||
    Object.prototype.toString.call(obj) === "[object RegExp]"
  );
}

export function isObject(obj: any): obj is NonNullable<object> {
  return typeof obj === "object" && obj !== null;
}

export function isError(obj: any): obj is Error {
  return (
    obj instanceof Error ||
    (obj && Object.getPrototypeOf(obj)?.name === "Error")
  );
}

export const isLikelyNpxGlobal = () =>
  process.argv.length >= 2 && process.argv[1].includes("_npx");

const debugLoggerColorMap = {
  api: 45, // cyan
  protocol: 34, // green
  install: 34, // green
  download: 34, // green
  browser: 0, // reset
  socks: 92, // purple
  "client-certificates": 92, // purple
  error: 160, // red,
  channel: 33, // blue
  server: 45, // cyan
  "server:channel": 34, // green
  "server:metadata": 33, // blue,
  recorder: 45, // cyan
};
export type LogName = keyof typeof debugLoggerColorMap;

class DebugLogger {
  private _debuggers = new Map<string, debug.IDebugger>();

  constructor() {
    if (process.env.DEBUG_FILE) {
      const ansiRegex = new RegExp(
        [
          "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
          "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
        ].join("|"),
        "g",
      );
      const stream = fs.createWriteStream(process.env.DEBUG_FILE);
      (debug as any).log = (data: string) => {
        stream.write(data.replace(ansiRegex, ""));
        stream.write("\n");
      };
    }
  }

  log(name: LogName, message: string | Error | object) {
    let cachedDebugger = this._debuggers.get(name);
    if (!cachedDebugger) {
      cachedDebugger = debug(`pw:${name}`);
      this._debuggers.set(name, cachedDebugger);
      (cachedDebugger as any).color = debugLoggerColorMap[name] || 0;
    }
    cachedDebugger(message);
  }

  isEnabled(name: LogName) {
    return debug.enabled(`pw:${name}`);
  }
}

export const debugLogger = new DebugLogger();

const kLogCount = 150;
export class RecentLogsCollector {
  private _logs: string[] = [];

  log(message: string) {
    this._logs.push(message);
    if (this._logs.length === kLogCount * 2) this._logs.splice(0, kLogCount);
  }

  recentLogs(): string[] {
    if (this._logs.length > kLogCount) return this._logs.slice(-kLogCount);
    return this._logs;
  }
}
export function findRepeatedSubsequences(
  s: string[],
): { sequence: string[]; count: number }[] {
  const n = s.length;
  const result = [];
  let i = 0;

  const arraysEqual = (a1: string[], a2: string[]) => {
    if (a1.length !== a2.length) return false;
    for (let j = 0; j < a1.length; j++) {
      if (a1[j] !== a2[j]) return false;
    }

    return true;
  };

  while (i < n) {
    let maxRepeatCount = 1;
    let maxRepeatSubstr = [s[i]]; // Initialize with the element at index i
    let maxRepeatLength = 1;

    // Try substrings of length from 1 to the remaining length of the array
    for (let p = 1; p <= n - i; p++) {
      const substr = s.slice(i, i + p); // Extract substring as array
      let k = 1;

      // Count how many times the substring repeats consecutively
      while (
        i + p * k <= n &&
        arraysEqual(s.slice(i + p * (k - 1), i + p * k), substr)
      )
        k += 1;

      k -= 1; // Adjust k since it increments one extra time in the loop

      // Update the maximal repeating substring if necessary
      if (k > 1 && k * p > maxRepeatCount * maxRepeatLength) {
        maxRepeatCount = k;
        maxRepeatSubstr = substr;
        maxRepeatLength = p;
      }
    }

    // Record the substring and its count
    result.push({ sequence: maxRepeatSubstr, count: maxRepeatCount });
    i += maxRepeatLength * maxRepeatCount; // Move index forward
  }

  return result;
}

const stackUtils = new StackUtils({ internals: StackUtils.nodeInternals() });
export function parseStackTraceLine(line: string): StackFrame | null {
  const frame = stackUtils.parseLine(line);
  if (!frame) return null;
  if (
    !process.env.PWDEBUGIMPL &&
    (frame.file?.startsWith("internal") || frame.file?.startsWith("node:"))
  )
    return null;
  if (!frame.file) return null;
  // ESM files return file:// URLs, see here: https://github.com/tapjs/stack-utils/issues/60
  // @ts-ignore
  const file = frame.file.startsWith("file://")
    ? // @ts-ignore
      url.fileURLToPath(frame.file)
    : path.resolve(process.cwd(), frame.file);
  return {
    file,
    line: frame.line || 0,
    column: frame.column || 0,
    function: frame.function,
  };
}

export function rewriteErrorMessage<E extends Error>(
  e: E,
  newMessage: string,
): E {
  const lines: string[] = (e.stack?.split("\n") || []).filter((l) =>
    l.startsWith("    at "),
  );
  e.message = newMessage;
  const errorTitle = `${e.name}: ${e.message}`;
  if (lines.length) e.stack = `${errorTitle}\n${lines.join("\n")}`;
  return e;
}

const CORE_DIR = path.resolve(scraperConfig.firefoxLibPath, "..", "..");

const internalStackPrefixes = [CORE_DIR];
export const addInternalStackPrefix = (prefix: string) =>
  internalStackPrefixes.push(prefix);

export type RawStack = string[];

export function captureRawStack(): RawStack {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 50;
  const error = new Error();
  const stack = error.stack || "";
  Error.stackTraceLimit = stackTraceLimit;
  return stack.split("\n");
}

export function captureLibraryStackTrace(): {
  frames: StackFrame[];
  apiName: string;
} {
  const stack = captureRawStack();

  type ParsedFrame = {
    frame: StackFrame;
    frameText: string;
    isPlaywrightLibrary: boolean;
  };
  let parsedFrames = stack
    .map((line) => {
      const frame = parseStackTraceLine(line);
      if (!frame || !frame.file) return null;
      const isPlaywrightLibrary = frame.file.startsWith(CORE_DIR);
      const parsed: ParsedFrame = {
        frame,
        frameText: line,
        isPlaywrightLibrary,
      };
      return parsed;
    })
    .filter(Boolean) as ParsedFrame[];

  let apiName = "";

  // Deepest transition between non-client code calling into client
  // code is the api entry.
  for (let i = 0; i < parsedFrames.length - 1; i++) {
    const parsedFrame = parsedFrames[i];
    if (
      parsedFrame.isPlaywrightLibrary &&
      !parsedFrames[i + 1].isPlaywrightLibrary
    ) {
      apiName = apiName || normalizeAPIName(parsedFrame.frame.function);
      break;
    }
  }

  function normalizeAPIName(name?: string): string {
    if (!name) return "";
    const match = name.match(/(API|JS|CDP|[A-Z])(.*)/);
    if (!match) return name;
    return match[1].toLowerCase() + match[2];
  }

  // This is for the inspector so that it did not include the test runner stack frames.
  parsedFrames = parsedFrames.filter((f) => {
    if (process.env.PWDEBUGIMPL) return true;
    if (internalStackPrefixes.some((prefix) => f.frame.file.startsWith(prefix)))
      return false;
    return true;
  });

  return {
    frames: parsedFrames.map((p) => p.frame),
    apiName,
  };
}

export function stringifyStackFrames(frames: StackFrame[]): string[] {
  const stackLines: string[] = [];
  for (const frame of frames) {
    if (frame.function)
      stackLines.push(
        `    at ${frame.function} (${frame.file}:${frame.line}:${frame.column})`,
      );
    else stackLines.push(`    at ${frame.file}:${frame.line}:${frame.column}`);
  }
  return stackLines;
}

export function captureLibraryStackText() {
  const parsed = captureLibraryStackTrace();
  return stringifyStackFrames(parsed.frames).join("\n");
}

export function splitErrorMessage(message: string): {
  name: string;
  message: string;
} {
  const separationIdx = message.indexOf(":");
  return {
    name: separationIdx !== -1 ? message.slice(0, separationIdx) : "",
    message:
      separationIdx !== -1 && separationIdx + 2 <= message.length
        ? message.substring(separationIdx + 2)
        : message,
  };
}

export function formatCallLog(log: string[] | undefined): string {
  if (!log || !log.some((l) => !!l)) return "";
  return `
Call log:
${colors.dim(log.join("\n"))}
`;
}

export function compressCallLog(log: string[]): string[] {
  const lines: string[] = [];

  for (const block of findRepeatedSubsequences(log)) {
    for (let i = 0; i < block.sequence.length; i++) {
      const line = block.sequence[i];
      const leadingWhitespace = line.match(/^\s*/);
      const whitespacePrefix = "  " + leadingWhitespace?.[0] || "";
      const countPrefix = `${block.count} × `;
      if (block.count > 1 && i === 0)
        lines.push(whitespacePrefix + countPrefix + line.trim());
      else if (block.count > 1)
        lines.push(
          whitespacePrefix +
            " ".repeat(countPrefix.length - 2) +
            "- " +
            line.trim(),
        );
      else lines.push(whitespacePrefix + "- " + line.trim());
    }
  }
  return lines;
}

export type ExpectZone = {
  title: string;
  stepId: string;
};

export class ManualPromise<T = void> extends Promise<T> {
  private _resolve!: (t: T) => void;
  private _reject!: (e: Error) => void;
  private _isDone: boolean;

  constructor() {
    let resolve: (t: T) => void;
    let reject: (e: Error) => void;
    super((f, r) => {
      resolve = f;
      reject = r;
    });
    this._isDone = false;
    this._resolve = resolve!;
    this._reject = reject!;
  }

  isDone() {
    return this._isDone;
  }

  resolve(t: T) {
    this._isDone = true;
    this._resolve(t);
  }

  reject(e: Error) {
    this._isDone = true;
    this._reject(e);
  }

  static override get [Symbol.species]() {
    return Promise;
  }

  override get [Symbol.toStringTag]() {
    return "ManualPromise";
  }
}

export class LongStandingScope {
  private _terminateError: Error | undefined;
  private _closeError: Error | undefined;
  private _terminatePromises = new Map<ManualPromise<Error>, string[]>();
  private _isClosed = false;

  reject(error: Error) {
    this._isClosed = true;
    this._terminateError = error;
    for (const p of this._terminatePromises.keys()) p.resolve(error);
  }

  close(error: Error) {
    this._isClosed = true;
    this._closeError = error;
    for (const [p, frames] of this._terminatePromises)
      p.resolve(cloneError(error, frames));
  }

  isClosed() {
    return this._isClosed;
  }

  static async raceMultiple<T>(
    scopes: LongStandingScope[],
    promise: Promise<T>,
  ): Promise<T> {
    return Promise.race(scopes.map((s) => s.race(promise)));
  }

  async race<T>(promise: Promise<T> | Promise<T>[]): Promise<T> {
    return this._race(
      Array.isArray(promise) ? promise : [promise],
      false,
    ) as Promise<T>;
  }

  async safeRace<T>(promise: Promise<T>, defaultValue?: T): Promise<T> {
    return this._race([promise], true, defaultValue);
  }

  private async _race(
    promises: Promise<any>[],
    safe: boolean,
    defaultValue?: any,
  ): Promise<any> {
    const terminatePromise = new ManualPromise<Error>();
    const frames = captureRawStack();
    if (this._terminateError) terminatePromise.resolve(this._terminateError);
    if (this._closeError)
      terminatePromise.resolve(cloneError(this._closeError, frames));
    this._terminatePromises.set(terminatePromise, frames);
    try {
      return await Promise.race([
        terminatePromise.then((e) => (safe ? defaultValue : Promise.reject(e))),
        ...promises,
      ]);
    } finally {
      this._terminatePromises.delete(terminatePromise);
    }
  }
}

function cloneError(error: Error, frames: string[]) {
  const clone = new Error();
  clone.name = error.name;
  clone.message = error.message;
  clone.stack = [error.name + ":" + error.message, ...frames].join("\n");
  return clone;
}

const initialTime = process.hrtime();

export function monotonicTime(): number {
  const [seconds, nanoseconds] = process.hrtime(initialTime);
  return seconds * 1000 + ((nanoseconds / 1000) | 0) / 1000;
}

// Implementation(partial) of Happy Eyeballs 2 algorithm described in
// https://www.rfc-editor.org/rfc/rfc8305

// Same as in Chromium (https://source.chromium.org/chromium/chromium/src/+/5666ff4f5077a7e2f72902f3a95f5d553ea0d88d:net/socket/transport_connect_job.cc;l=102)
const connectionAttemptDelayMs = 300;

const kDNSLookupAt = Symbol("kDNSLookupAt");
const kTCPConnectionAt = Symbol("kTCPConnectionAt");

class HttpHappyEyeballsAgent extends http.Agent {
  createConnection(
    options: http.ClientRequestArgs,
    oncreate?: (err: Error | null, socket?: net.Socket) => void,
  ): net.Socket | undefined {
    // There is no ambiguity in case of IP address.
    if (net.isIP(clientRequestArgsToHostName(options)))
      return net.createConnection(options as net.NetConnectOpts);
    createConnectionAsync(options, oncreate, /* useTLS */ false).catch((err) =>
      oncreate?.(err),
    );
  }
}

class HttpsHappyEyeballsAgent extends https.Agent {
  createConnection(
    options: http.ClientRequestArgs,
    oncreate?: (err: Error | null, socket?: net.Socket) => void,
  ): net.Socket | undefined {
    // There is no ambiguity in case of IP address.
    if (net.isIP(clientRequestArgsToHostName(options)))
      return tls.connect(options as tls.ConnectionOptions);
    createConnectionAsync(options, oncreate, /* useTLS */ true).catch((err) =>
      oncreate?.(err),
    );
  }
}

// These options are aligned with the default Node.js globalAgent options.
export const httpsHappyEyeballsAgent = new HttpsHappyEyeballsAgent({
  keepAlive: true,
});
export const httpHappyEyeballsAgent = new HttpHappyEyeballsAgent({
  keepAlive: true,
});

export async function createSocket(
  host: string,
  port: number,
): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    if (net.isIP(host)) {
      const socket = net.createConnection({ host, port });
      socket.on("connect", () => resolve(socket));
      socket.on("error", (error) => reject(error));
    } else {
      createConnectionAsync(
        { host, port },
        (err, socket) => {
          if (err) reject(err);
          if (socket) resolve(socket);
        },
        /* useTLS */ false,
      ).catch((err) => reject(err));
    }
  });
}

export async function createTLSSocket(
  options: tls.ConnectionOptions,
): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    assert(options.host, "host is required");
    if (net.isIP(options.host)) {
      const socket = tls.connect(options);
      socket.on("secureConnect", () => resolve(socket));
      socket.on("error", (error) => reject(error));
    } else {
      createConnectionAsync(
        options,
        (err, socket) => {
          if (err) reject(err);
          if (socket) {
            socket.on("secureConnect", () => resolve(socket));
            socket.on("error", (error) => reject(error));
          }
        },
        true,
      ).catch((err) => reject(err));
    }
  });
}

export async function createConnectionAsync(
  options: http.ClientRequestArgs,
  oncreate: ((err: Error | null, socket?: tls.TLSSocket) => void) | undefined,
  useTLS: true,
): Promise<void>;

export async function createConnectionAsync(
  options: http.ClientRequestArgs,
  oncreate: ((err: Error | null, socket?: net.Socket) => void) | undefined,
  useTLS: false,
): Promise<void>;

export async function createConnectionAsync(
  options: http.ClientRequestArgs,
  oncreate: ((err: Error | null, socket?: any) => void) | undefined,
  useTLS: boolean,
): Promise<void> {
  const lookup = (options as any).__testHookLookup || lookupAddresses;
  const hostname = clientRequestArgsToHostName(options);
  const addresses = await lookup(hostname);
  const dnsLookupAt = monotonicTime();
  const sockets = new Set<net.Socket>();
  let firstError;
  let errorCount = 0;
  const handleError = (socket: net.Socket, err: Error) => {
    if (!sockets.delete(socket)) return;
    ++errorCount;
    firstError ??= err;
    if (errorCount === addresses.length) oncreate?.(firstError);
  };

  const connected = new ManualPromise();
  for (const { address } of addresses) {
    const socket = useTLS
      ? tls.connect({
          ...(options as tls.ConnectionOptions),
          port: options.port as number,
          host: address,
          servername: hostname,
        })
      : net.createConnection({
          ...options,
          port: options.port as number,
          host: address,
        });

    (socket as any)[kDNSLookupAt] = dnsLookupAt;

    // Each socket may fire only one of 'connect', 'timeout' or 'error' events.
    // None of these events are fired after socket.destroy() is called.
    socket.on("connect", () => {
      (socket as any)[kTCPConnectionAt] = monotonicTime();

      connected.resolve();
      oncreate?.(null, socket);
      // TODO: Cache the result?
      // Close other outstanding sockets.
      sockets.delete(socket);
      for (const s of sockets) s.destroy();
      sockets.clear();
    });
    socket.on("timeout", () => {
      // Timeout is not an error, so we have to manually close the socket.
      socket.destroy();
      handleError(socket, new Error("Connection timeout"));
    });
    socket.on("error", (e) => handleError(socket, e));
    sockets.add(socket);
    await Promise.race([
      connected,
      new Promise((f) => setTimeout(f, connectionAttemptDelayMs)),
    ]);
    if (connected.isDone()) break;
  }
}

async function lookupAddresses(hostname: string): Promise<dns.LookupAddress[]> {
  const addresses = await dns.promises.lookup(hostname, {
    all: true,
    family: 0,
    verbatim: true,
  });
  let firstFamily = addresses.filter(({ family }) => family === 6);
  let secondFamily = addresses.filter(({ family }) => family === 4);
  // Make sure first address in the list is the same as in the original order.
  if (firstFamily.length && firstFamily[0] !== addresses[0]) {
    const tmp = firstFamily;
    firstFamily = secondFamily;
    secondFamily = tmp;
  }
  const result = [];
  // Alternate ipv6 and ipv4 addresses.
  for (let i = 0; i < Math.max(firstFamily.length, secondFamily.length); i++) {
    if (firstFamily[i]) result.push(firstFamily[i]);
    if (secondFamily[i]) result.push(secondFamily[i]);
  }
  return result;
}

function clientRequestArgsToHostName(options: http.ClientRequestArgs): string {
  if (options.hostname) return options.hostname;
  if (options.host) return options.host;
  throw new Error("Either options.hostname or options.host must be provided");
}

export function timingForSocket(socket: net.Socket | tls.TLSSocket) {
  return {
    dnsLookupAt: (socket as any)[kDNSLookupAt] as number | undefined,
    tcpConnectionAt: (socket as any)[kTCPConnectionAt] as number | undefined,
  };
}

export function assert(value: any, message?: string): asserts value {
  if (!value) throw new Error(message || "Assertion error");
}

// See https://joel.tools/microtasks/
export function makeWaitForNextTask() {
  // As of Mar 2021, Electron v12 doesn't create new task with `setImmediate` despite
  // using Node 14 internally, so we fallback to `setTimeout(0)` instead.
  // @see https://github.com/electron/electron/issues/28261
  if ((process.versions as any).electron)
    return (callback: () => void) => setTimeout(callback, 0);
  if (parseInt(process.versions.node, 10) >= 11) return setImmediate;

  // Unlike Node 11, Node 10 and less have a bug with Task and MicroTask execution order:
  // - https://github.com/nodejs/node/issues/22257
  //
  // So we can't simply run setImmediate to dispatch code in a following task.
  // However, we can run setImmediate from-inside setImmediate to make sure we're getting
  // in the following task.

  let spinning = false;
  const callbacks: (() => void)[] = [];
  const loop = () => {
    const callback = callbacks.shift();
    if (!callback) {
      spinning = false;
      return;
    }
    setImmediate(loop);
    // Make sure to call callback() as the last thing since it's
    // untrusted code that might throw.
    callback();
  };

  return (callback: () => void) => {
    callbacks.push(callback);
    if (!spinning) {
      spinning = true;
      setImmediate(loop);
    }
  };
}
