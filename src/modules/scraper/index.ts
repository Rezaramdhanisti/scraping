import * as express from "express";
import {
  deleteProxyValidation,
  scrapeBatchResultValidation,
  scrapeSyncValidation,
  shoppeProxiesConfigValidation,
  TestCookieValidation as testCookieValidation,
  TiktokSyncValidation,
  updateProxyValidation,
} from "./scraper.validation.js";
import {
  deleteShopeeProxy,
  getShopeeProxies,
  scrapeShopeeAsync,
  scrapeShopeeAsyncResult,
  scrapeShopeeSync,
  scrapeTiktokAccomodationSync as scrapeTiktokAccomodationSync,
  shopeeProxiesConfig,
  testCookieTiktok,
  updateShopeeProxy,
} from "./scraper.service.js";
import limitToken from "../../midlewares/scrape.middleware.js";
const scraperRouter = express.Router();

scraperRouter.get("/shopee/proxies-config", getShopeeProxies);
scraperRouter.put(
  "/shopee/proxies-config/:id",
  updateProxyValidation,
  updateShopeeProxy,
);
scraperRouter.delete(
  "/shopee/proxies-config/:id",
  deleteProxyValidation,
  deleteShopeeProxy,
);
scraperRouter.post(
  "/shopee/proxies-config",
  shoppeProxiesConfigValidation,
  shopeeProxiesConfig,
);

scraperRouter.post(
  "/shopee/sync",
  limitToken,
  scrapeSyncValidation,
  scrapeShopeeSync,
);

scraperRouter.post(
  "/tiktok/accomodation/sync",
  limitToken,
  TiktokSyncValidation,
  scrapeTiktokAccomodationSync,
);

scraperRouter.post(
  "/test-cookie-tiktok/sync",
  limitToken,
  testCookieValidation,
  testCookieTiktok,
);

scraperRouter.post(
  "/shopee/async",
  limitToken,
  scrapeSyncValidation,
  scrapeShopeeAsync,
);
scraperRouter.get(
  "/shopee/async/result/:id",
  limitToken,
  scrapeBatchResultValidation,
  scrapeShopeeAsyncResult,
);

export default scraperRouter;
