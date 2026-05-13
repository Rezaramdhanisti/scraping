import * as puppeteer from "puppeteer";

import { debugGenerator, ProxyServer, timeoutExecute } from "../../util.js";
import ConcurrencyImplementation, {
  WorkerInstance,
} from "../ConcurrencyImplementation.js";
import mrscraperBrowser, {
  CdpShopeeError,
  CdpShopeeErrorType,
} from "../../../mrscraper-browser/index.js";
import { Connection } from "../../../mrscraper-browser/cdp/Connection.js";
import { delay } from "../../../../utils/general.utils.js";
import { BrowserTypeLaunchOptions } from "@protocol/channels.js";
import { FFSession } from "../../../mrscraper-browser/firefox/ffConnection.js";
import { ProxyConfig } from "../../../../interfaces.js";
const debug = debugGenerator("BrowserConcurrency");

const BROWSER_TIMEOUT = 30000;

const randomSlowDown = async (max: number) => {
  // random delay to avoid all browsers starting at the same time
  // between 5 and 20 seconds
  const delayTime = Math.floor(Math.random() * max) + 5000;
  await delay(delayTime);
};

export default class CdpConnection extends ConcurrencyImplementation {
  public proxy: ProxyConfig | undefined;
  public async init() {}
  public async close() {}

  private async firefoxBasedBrowser(
    perBrowserOptions: BrowserTypeLaunchOptions | undefined,
    restartFunction?: () => Promise<
      puppeteer.LaunchOptions | BrowserTypeLaunchOptions
    >,
  ): Promise<WorkerInstance> {
    let options = (perBrowserOptions ||
      this.options) as BrowserTypeLaunchOptions; // should be connect options
    // @ts-ignore
    this.proxy = options?.proxy;
    console.log(
      "\n=============\n Launching browser with proxy: ",
      // @ts-ignore
      options?.proxy,
      " \n=============\n",
    );
    // @ts-ignore
    debug("Launching browser with proxy: ", options?.proxy);
    await randomSlowDown(30000);
    let firefox: FFSession = (await mrscraperBrowser.launch(
      true,
      options,
    )) as FFSession;
    // @ts-ignore
    firefox.proxy_id = options?.proxy?.id;
    // @ts-ignore
    firefox.provider = options?.proxy?.provider;
    // let context: any; // puppeteer typings are old...

    return {
      ip: firefox.ip,
      // @ts-ignore
      proxy_id: options?.proxy?.id,
      // @ts-ignore
      proxy: options?.proxy,
      browser: "firefox",
      jobInstance: async () => {
        await timeoutExecute(
          BROWSER_TIMEOUT,
          (async () => {
            debug("page created", firefox);
          })(),
        );

        return {
          resources: {
            // context, // NOTE: we need to return context as well to be able to repair the browser instance
            page: firefox,
          },

          close: async () => {
            debug("Closing page");
            // do not close any page
          },
        };
      },

      close: async () => {
        await firefox._connection.close();
        console.log("Browser closed via close");
      },

      repair: async (proxy?: ProxyConfig) => {
        console.log("Starting repair");
        try {
          // will probably fail, but just in case the repair was not necessary
          await timeoutExecute(BROWSER_TIMEOUT, firefox._connection.close());
          console.log("Browser closed");
        } catch (e) {
          console.error("Error during repair", e);
        }

        // just reconnect as there is only one page per browser
        let repairCount = 0;
        let isRepaired = false;
        // @ts-ignore
        options.proxy = proxy || this.proxy;

        do {
          try {
            // await randomSlowDown(10000);
            firefox = (await mrscraperBrowser.launch(
              true,
              options,
            )) as FFSession;
            // @ts-ignore
            firefox.proxy_id = options?.proxy?.id;
            // @ts-ignore
            firefox.provider = options?.proxy?.provider;
            isRepaired = true;
            console.log("Repair done");
          } catch (error: any) {
            repairCount++;
            isRepaired = false;
            console.error("Error during repair", error);
            await delay(5000); // wait for a bit before retrying
            if (repairCount >= 3) {
              throw new CdpShopeeError(
                error.message,
                CdpShopeeErrorType.INTERNAL_ERROR,
                "Failed to repair browser after 3 attempts",
              );
            }
          }
        } while (!isRepaired && repairCount < 3);
      },
    };
  }

  private async chromeBasedBrowser(
    perBrowserOptions: puppeteer.LaunchOptions | undefined,
    restartFunction?: () => Promise<
      puppeteer.LaunchOptions | BrowserTypeLaunchOptions
    >,
  ): Promise<WorkerInstance> {
    let options = (perBrowserOptions ||
      this.options) as puppeteer.LaunchOptions; // should be connect options
    // @ts-ignore
    this.proxy = options?.proxy;
    console.log(
      "\n=============\n Launching browser with proxy: ",
      // @ts-ignore
      options?.proxy,
      " \n=============\n",
    );
    // @ts-ignore
    debug("Launching browser with proxy: ", options?.proxy);
    await randomSlowDown(30000);
    let chrome: Connection = (await mrscraperBrowser.launch(
      false,
      options,
    )) as Connection;
    // @ts-ignore
    chrome.proxy_id = options?.proxy?.id;
    // @ts-ignore
    chrome.provider = options?.proxy?.provider;
    // let context: any; // puppeteer typings are old...

    return {
      ip: chrome.ip,
      // @ts-ignore
      proxy_id: options?.proxy?.id,
      // @ts-ignore
      proxy: options?.proxy,
      browser: options?.executablePath?.split("/").pop(),
      jobInstance: async () => {
        await timeoutExecute(
          BROWSER_TIMEOUT,
          (async () => {
            debug("page created", chrome);
          })(),
        );

        return {
          resources: {
            // context, // NOTE: we need to return context as well to be able to repair the browser instance
            page: chrome,
          },

          close: async () => {
            debug("Closing page");
            // do not close any page
          },
        };
      },

      close: async () => {
        await chrome.send("Browser.close");
      },

      repair: async (proxy?: ProxyConfig) => {
        debug("Starting repair");
        try {
          // will probably fail, but just in case the repair was not necessary
          await timeoutExecute(BROWSER_TIMEOUT, chrome.send("Browser.close"));
        } catch (e) {}

        // just reconnect as there is only one page per browser
        let repairCount = 0;
        let isRepaired = false;

        // @ts-ignore
        options.proxy = proxy || this.proxy;
        // @ts-ignore

        do {
          try {
            // await randomSlowDown(10000);
            chrome = (await mrscraperBrowser.launch(
              false,
              options,
            )) as Connection;
            // @ts-ignore
            chrome.proxy_id = options?.proxy?.id;
            // @ts-ignore
            chrome.provider = options?.proxy?.provider;
            isRepaired = true;
            debug("Repair done");
          } catch (error: any) {
            repairCount++;
            isRepaired = false;
            console.error("Error during repair", error);
            await delay(5000); // wait for a bit before retrying
            if (repairCount >= 3) {
              throw new CdpShopeeError(
                error.message,
                CdpShopeeErrorType.INTERNAL_ERROR,
                "Failed to repair browser after 3 attempts",
              );
            }
          }
        } while (!isRepaired && repairCount < 3);
      },
    };
  }

  public async workerInstance(
    perBrowserOptions:
      | puppeteer.LaunchOptions
      | BrowserTypeLaunchOptions
      | undefined,
    restartFunction?: () => Promise<
      puppeteer.LaunchOptions | BrowserTypeLaunchOptions
    >,
  ): Promise<WorkerInstance> {
    // check if we are using chrome or firefox
    if (perBrowserOptions?.executablePath !== "firefox") {
      debug("Using chrome based browser");
      return this.chromeBasedBrowser(
        perBrowserOptions as puppeteer.LaunchOptions,
        restartFunction,
      );
    }
    debug("Using firefox based browser");
    delete perBrowserOptions?.executablePath;
    return this.firefoxBasedBrowser(
      perBrowserOptions as BrowserTypeLaunchOptions,
      restartFunction,
    );
  }
}
