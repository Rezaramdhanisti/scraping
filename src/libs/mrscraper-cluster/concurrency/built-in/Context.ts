import * as puppeteer from "puppeteer";

import { ResourceData } from "../ConcurrencyImplementation.js";
import SingleBrowserImplementation from "../SingleBrowserImplementation.js";

export default class Context extends SingleBrowserImplementation {
  protected async createResources(): Promise<ResourceData> {
    const context = await (
      this.browser as puppeteer.Browser
    ).createBrowserContext();
    const page = await context.newPage();
    return {
      context,
      page,
    };
  }

  protected async freeResources(resources: ResourceData): Promise<void> {
    await resources.context.close();
  }
}
