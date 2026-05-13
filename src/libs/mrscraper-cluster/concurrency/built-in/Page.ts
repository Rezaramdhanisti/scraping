import * as puppeteer from "puppeteer";

import { ResourceData } from "../ConcurrencyImplementation.js";
import SingleBrowserImplementation from "../SingleBrowserImplementation.js";
import { Connection } from "../../../mrscraper-browser/cdp/Connection.js";
import { FFSession } from "../../../mrscraper-browser/firefox/ffConnection.js";

export default class Page extends SingleBrowserImplementation {
  protected async createResources(): Promise<ResourceData> {
    return {
      page: await (this.browser as puppeteer.Browser).newPage(),
    };
  }

  protected async freeResources(resources: ResourceData): Promise<void> {
    if (
      resources.page instanceof Connection ||
      resources.page instanceof FFSession
    ) {
      throw new Error("Page should be a puppeteer.Page instance");
    }

    await resources.page.close();
  }
}
