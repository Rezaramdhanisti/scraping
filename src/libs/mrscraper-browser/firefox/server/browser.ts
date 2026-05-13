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

import { RecentLogsCollector } from "../utils.js";
import type * as types from "./types.js";
import type { ProxySettings } from "./types.js";
import type { ChildProcess } from "child_process";

export interface BrowserProcess {
  onclose?: (exitCode: number | null, signal: string | null) => void;
  process?: ChildProcess;
  kill(): Promise<void>;
  close(): Promise<void>;
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
  browserLogsCollector: RecentLogsCollector;
  browserProcess: BrowserProcess;
  customExecutablePath?: string;
  proxy?: ProxySettings;
  protocolLogger: types.ProtocolLogger;
  slowMo?: number;
  wsEndpoint?: string; // Only there when connected over web socket.
  originalLaunchOptions: types.LaunchOptions;
};
