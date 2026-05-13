import { debugGenerator, timeoutExecute } from "../../util.js";
import ConcurrencyImplementation, {
  WorkerInstance,
} from "../ConcurrencyImplementation.js";
import {
  CdpShopeeError,
  CdpShopeeErrorType,
} from "../../../mrscraper-browser/index.js";
import { delay } from "../../../../utils/general.utils.js";
import { BrowserTypeLaunchOptions } from "@protocol/channels.js";
import { FFSession } from "../../../mrscraper-browser/firefox/ffConnection.js";
import mrscraperFirefox from "../../../mrscraper-browser/firefox/index.js";
const debug = debugGenerator("BrowserConcurrency");

const BROWSER_TIMEOUT = 30000;

const randomSlowDown = async (max: number) => {
  // random delay to avoid all browsers starting at the same time
  // between 5 and 20 seconds
  const delayTime = Math.floor(Math.random() * max) + 5000;
  await delay(delayTime);
};

export default class FirefoxConnection extends ConcurrencyImplementation {
  public async init() {}
  public async close() {}

  public async workerInstance(
    perBrowserOptions: BrowserTypeLaunchOptions | undefined,
    restartFunction: () => Promise<string>,
  ): Promise<WorkerInstance> {
    const options = (perBrowserOptions ||
      this.options) as BrowserTypeLaunchOptions; // should be connect options
    console.log(
      "\n=============\n Launching browser with proxy: ",
      // @ts-ignore
      options?.proxy,
      " \n=============\n",
    );
    // @ts-ignore
    debug("Launching browser with proxy: ", options?.proxy);
    await randomSlowDown(30000);
    let firefox: FFSession = await mrscraperFirefox.launch(
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
      proxy: options?.proxy?.server,
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

      repair: async () => {
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

        do {
          try {
            // await randomSlowDown(10000);
            firefox = await mrscraperFirefox.launch(
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
}
