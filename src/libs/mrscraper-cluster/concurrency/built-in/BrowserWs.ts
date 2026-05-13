import * as puppeteer from "puppeteer";

import { debugGenerator, timeoutExecute } from "../../util.js";
import ConcurrencyImplementation, {
  WorkerInstance,
} from "../ConcurrencyImplementation.js";
const debug = debugGenerator("BrowserConcurrency");

const BROWSER_TIMEOUT = 30000;

export default class BrowserWs extends ConcurrencyImplementation {
  public async init() {}
  public async close() {}

  public async workerInstance(
    perBrowserOptions: puppeteer.ConnectOptions | undefined,
    restartFunction: () => Promise<string>,
  ): Promise<WorkerInstance> {
    const options = (perBrowserOptions ||
      this.options) as puppeteer.ConnectOptions; // should be connect options
    // NOTE: cause this is BrowserWs which is use browserless, we will use connect instead of launch
    let chrome = (await this.puppeteer.connect(options)) as puppeteer.Browser;
    let page: puppeteer.Page;
    // let context: any; // puppeteer typings are old...

    return {
      jobInstance: async () => {
        await timeoutExecute(
          BROWSER_TIMEOUT,
          (async () => {
            debug("Creating new page");
            page = await chrome.newPage();
            debug("page created", page);
          })(),
        );

        return {
          resources: {
            // context, // NOTE: we need to return context as well to be able to repair the browser instance
            page,
          },

          close: async () => {
            debug("Closing page");
            await timeoutExecute(BROWSER_TIMEOUT, page.close());
          },
        };
      },

      close: async () => {
        await chrome.close();
      },

      repair: async () => {
        debug("Starting repair");
        try {
          // will probably fail, but just in case the repair was not necessary
          await timeoutExecute(BROWSER_TIMEOUT, chrome.close());
        } catch (e) {}

        // just reconnect as there is only one page per browser
        options.browserWSEndpoint = await this.restartFunction();
        try {
          chrome = await this.puppeteer.connect(options);
          debug("Repair done");
        } catch (error) {
          console.error("Error during repair", error);
          throw error;
        }
      },
    };
  }
}
