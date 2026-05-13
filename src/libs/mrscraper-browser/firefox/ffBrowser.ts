/**
 * Copyright 2018 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { assert } from "./utils.js";
import type { BrowserOptions } from "./server/browser.js";
import type { ConnectionTransport } from "./server/transport.js";
import { FFConnection, type FFSession } from "./ffConnection.js";
import type { Protocol } from "./protocol.js";
import { blackList, debugGenerator } from "../utils.js";
import { ProxySettings } from "./server/types.js";
import { CdpShopeeError, CdpShopeeErrorType } from "../index.js";
import { timeout } from "../common/util.js";
import { FingerprintGenerator } from "../util/fingerprint-generator.js";

const delay = async (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
function toJugglerProxyOptions(proxy: ProxySettings) {
  const proxyServer = new URL(proxy.server);
  let port = parseInt(proxyServer.port, 10);
  let type: "http" | "https" | "socks" | "socks4" = "http";
  if (proxyServer.protocol === "socks5:") type = "socks";
  else if (proxyServer.protocol === "socks4:") type = "socks4";
  else if (proxyServer.protocol === "https:") type = "https";
  if (proxyServer.port === "") {
    if (proxyServer.protocol === "http:") port = 80;
    else if (proxyServer.protocol === "https:") port = 443;
  }
  return {
    type,
    bypass: proxy.bypass
      ? proxy.bypass.split(",").map((domain) => domain.trim())
      : [],
    host: proxyServer.hostname,
    port,
    username: proxy.username,
    password: proxy.password,
  };
}
const debug = debugGenerator("ffBrowser");
const kBandaidFirefoxUserPrefs = {};

export class FFBrowser {
  static async connect(
    transport: ConnectionTransport,
    options: BrowserOptions,
  ): Promise<FFSession> {
    console.log("Connect");
    const connection = new FFConnection(
      transport,
      options.protocolLogger,
      options.browserLogsCollector,
      options.browserProcess,
    );

    const proxy = options.originalLaunchOptions.proxyOverride || options.proxy;

    if ((options as any).__testHookOnConnectToBrowser)
      await (options as any).__testHookOnConnectToBrowser();
    let firefoxUserPrefs = options.originalLaunchOptions.firefoxUserPrefs ?? {};
    if (Object.keys(kBandaidFirefoxUserPrefs).length)
      firefoxUserPrefs = { ...kBandaidFirefoxUserPrefs, ...firefoxUserPrefs };
    const promises: Promise<any>[] = [
      connection.rootSession.send("Browser.enable", {
        attachToDefaultContext: !!options.persistent,
        userPrefs: Object.entries(firefoxUserPrefs).map(([name, value]) => ({
          name,
          value,
        })),
      }),
    ];
    if (proxy)
      promises.push(
        connection.rootSession.send(
          "Browser.setBrowserProxy",
          toJugglerProxyOptions(proxy),
        ),
      );
    const fingerprintGenerator = new FingerprintGenerator();
    const fingerprints = fingerprintGenerator.getFingerprint({
      devices: ["desktop"],
      screen: {
        minWidth: 800,
        maxWidth: 800,
        minHeight: 600,
        maxHeight: 600,
      },
      locales: ["zh-TW"],
      browsers: ["firefox"],
      operatingSystems: ["macos", "windows"],
    });
    const {
      fingerprint: { navigator },
    } = fingerprints;

    promises.push(
      connection.rootSession.send("Browser.setUserAgentOverride", {
        userAgent: navigator.userAgent,
      }),

      connection.rootSession.send("Browser.setLocaleOverride", {
        locale: navigator.language,
      }),

      connection.rootSession.send("Browser.setPlatformOverride", {
        platform: navigator.platform,
      }),
    );

    await Promise.all(promises);

    let session: FFSession;
    let frameId: string;

    const attachedToTarget = new Promise<void>((resolve) => {
      connection.rootSession.on("Browser.attachedToTarget", async (payload) => {
        const { type } = payload.targetInfo;
        if (type === "page") {
          session = connection.createSession(payload.sessionId);

          session.on("Page.frameAttached", (info) => {
            // console.log("frame attached", info);
            frameId = info.frameId;
            resolve(); // Resolve the promise when the frame is attached
          });
          debug("session created", session);
        }
        debug("Browser.attachedToTarget", payload);
      });
    });

    const browserContextResult = await connection.rootSession.send(
      "Browser.createBrowserContext",
      {},
    );

    const { browserContextId } = browserContextResult;
    await connection.rootSession.send("Browser.setDefaultViewport", {
      browserContextId,
      viewport: {
        viewportSize: {
          width: 1920,
          height: 993,
        },
      },
    });

    await connection.rootSession.send("Browser.setInitScripts", {
      browserContextId,
      scripts: [
        {
          script:
            "(() => { delete Object.getPrototypeOf(navigator).webdriver})()",
        },
      ],
    });

    await connection.rootSession.send("Browser.newPage", {
      browserContextId,
    });
    connection.rootSession.on("Network.requestWillBeSent", async (payload) => {
      const { requestId, url, method } = payload;
      console.log("Request intercepted", url);
    });

    await attachedToTarget;
    //@ts-ignore
    await session.send("Network.setRequestInterception", { enabled: true });
    const blackListRegex = blackList.map((pattern) => {
      const regexPattern = pattern.replace(/\*/g, ".*");
      return new RegExp(regexPattern);
    });
    //@ts-ignore
    session.on("Network.requestWillBeSent", async (payload) => {
      const { requestId, url, method } = payload;
      const isBlocked = blackListRegex.some((blacklistedUrl) =>
        blacklistedUrl.test(url),
      );
      if (isBlocked) {
        try {
          await session.sendMayFail("Network.abortInterceptedRequest", {
            requestId,
            errorCode: "Aborted",
          });
        } catch (error) {
          debug("Error aborting request", error);
        }
      } else {
        try {
          await session.sendMayFail("Network.resumeInterceptedRequest", {
            requestId: requestId,
            url,
            method,
            headers: payload.headers,
            postData: payload.postData,
          });
        } catch (error) {
          debug("Error resuming request", error);
        }
        if (url.includes("get_pc")) {
          debug("getpc", {
            requesiId: requestId,
            url,
          });
        }
      }
    });

    // @ts-ignore
    session.frameId = frameId;

    // @ts-ignore
    await session.send("Page.navigate", {
      // @ts-ignore
      frameId,
      url: "https://ipinfo.io/ip",
    });
    // await delay(60000);

    try {
      // @ts-ignore
      const ip = await this.getIp(session);
      // @ts-ignore
      session.ip = ip;
    } catch (error) {}

    // @ts-ignore
    return session;
  }
  static async getIpId(session: FFSession): Promise<{
    url: string;
    requestId: string;
    onRequestWillBeSent: (
      data: Protocol.Network.requestWillBeSentPayload,
    ) => void;
  }> {
    return new Promise((resolve, reject) => {
      const onRequestWillBeSent = (
        data: Protocol.Network.requestWillBeSentPayload,
      ) => {
        const { url } = data;

        if (url.includes("ipinfo.io/ip")) {
          // console.log("Frame navigated", data);
          resolve({ url, requestId: data.requestId, onRequestWillBeSent });
        }
      };
      session.on("Network.requestWillBeSent", onRequestWillBeSent);
    });
  }

  static async getIp(session: FFSession): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let { requestId, onRequestWillBeSent, url } = await this.getIpId(session);
      console.log("URL", url, requestId);
      const onResponse = (data: Protocol.Network.responseReceivedPayload) => {
        console.log("IP Response", data.requestId);
        if (data.requestId == requestId) {
          console.log("Found ip", url, requestId);
        }
      };
      const onLoadingFinished = async (
        data: Protocol.Network.requestFinishedPayload,
      ) => {
        if (data.requestId === requestId) {
          try {
            console.log("IP Request ", data);
            const response = await session.send("Network.getResponseBody", {
              requestId: data.requestId,
            });

            const responseBody = response.base64body.toString(); // This is your base64 encoded string

            // Decode the base64 string
            const decodedBody = Buffer.from(responseBody, "base64").toString(
              "utf-8",
            );

            // Parse the decoded string into a JSON object
            let body = decodedBody.trim();
            console.log("IP", body);
            resolve(body);
          } catch (error) {
            console.error(error);
            const err = new CdpShopeeError(
              "No response",
              CdpShopeeErrorType.NO_RESPONSE,
              undefined,
            );
            reject(err);
          } finally {
            session.off("Network.requestWillBeSent", onRequestWillBeSent);
            session.off("Network.responseReceived", onResponse);
            session.off("Network.requestFinished", onLoadingFinished);
          }
        }
      };
      session.on("Network.responseReceived", onResponse);
      session.on("Network.requestFinished", onLoadingFinished);
    });
  }

  static async getNewSession(connection: FFConnection): Promise<any> {
    return new Promise((resolve) => {
      connection.rootSession.on("Browser.attachedToTarget", (payload) => {
        const { targetId, browserContextId, openerId, type } =
          payload.targetInfo;
        assert(type === "page");
        console.log("FFBrowser.attachedToTarget", payload);

        const session = connection.createSession(payload.sessionId);

        let frameId;
        session.on("Page.frameAttached", (info) => {
          // console.log("frame attached", info);
          frameId = info.frameId;
        });
        resolve({ session, frameId });
        // console.log("session", session);
      });
    });
  }
}

export async function getURL(session: FFSession): Promise<{
  url: string;
  requestId: string;
  onRequestWillBeSent: (
    data: Protocol.Network.requestWillBeSentPayload,
  ) => void;
}> {
  return new Promise((resolve, reject) => {
    const onRequestWillBeSent = (
      data: Protocol.Network.requestWillBeSentPayload,
    ) => {
      const { url } = data;

      if (url.includes("get_pc")) {
        debug("Frame navigated", data);
        resolve({ url, requestId: data.requestId, onRequestWillBeSent });
      }
    };
    session.on("Network.requestWillBeSent", onRequestWillBeSent);
  });
}
export async function getPc(session: FFSession): Promise<any> {
  return new Promise(async (resolve, reject) => {
    let { requestId, onRequestWillBeSent, url } = await getURL(session);
    debug("URL", url, requestId);
    // let requestId: string | null = null;
    const onResponse = (data: Protocol.Network.responseReceivedPayload) => {
      debug("Response", data.requestId);
      if (data.requestId == requestId) {
        debug("Found get_pc", url, requestId);
      }
    };
    const onLoadingFinished = async (
      data: Protocol.Network.requestFinishedPayload,
    ) => {
      if (data.requestId === requestId) {
        try {
          const response = await session.send("Network.getResponseBody", {
            requestId: data.requestId,
          });

          const responseBody = response.base64body.toString(); // This is your base64 encoded string

          // Decode the base64 string
          const decodedBody = Buffer.from(responseBody, "base64").toString(
            "utf-8",
          );

          // Parse the decoded string into a JSON object
          let body;
          try {
            body = JSON.parse(decodedBody);
            debug("Parsed JSON body:", body);
          } catch (error) {
            console.error("Error parsing JSON:", error);
          }
          if (!body?.data?.item && body?.error !== 266900002) {
            debug("Request blocked");
            const error = new CdpShopeeError(
              "Blocked",
              CdpShopeeErrorType.BLOCKED,
              body ? JSON.stringify(body) : undefined,
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
          );
          reject(err);
        } finally {
          session.off("Network.requestWillBeSent", onRequestWillBeSent);
          session.off("Network.responseReceived", onResponse);
          session.off("Network.requestFinished", onLoadingFinished);
        }
      }
    };
    session.on("Network.responseReceived", onResponse);
    session.on("Network.requestFinished", onLoadingFinished);
  });
}
