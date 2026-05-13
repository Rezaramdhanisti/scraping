import { JsonValue } from "@prisma/client/runtime/library";
import { Page } from "puppeteer";
import chromium from "@sparticuz/chromium";
import axios, { AxiosError } from "axios";
import puppeteer from "puppeteer-extra";
import { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } from "puppeteer-core";
import AdblockerPlugin from "puppeteer-extra-plugin-adblocker";
import BlockResourcesPlugin from "puppeteer-extra-plugin-block-resources";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import scraperConfig from "../config/scraper.cofig.js";
import { ObjectAny } from "../interfaces.js";
import { Connection } from "../libs/mrscraper-browser/cdp/Connection.js";
import { MrScraperCluster } from "../libs/mrscraper-cluster/index.js";
import puppeteerCore from "puppeteer-core";
import { delay, pickRandomTiktokStayDatesStressStyle } from "./general.utils.js";
import { HttpProxyAgent } from "http-proxy-agent";
import {
  debugGenerator,
  weightedBrowser,
  weightedProxies,
} from "../libs/mrscraper-cluster/util.js";
import { TaskFunctionArguments } from "../libs/mrscraper-cluster/Cluster.js";

import {
  cdpGetPc,
  CdpShopeeError,
  cdpTimeoutExecute,
  DEFAULT_OPTIONS,
} from "../libs/mrscraper-browser/index.js";
import fs from "fs";
import { HttpsProxyAgent } from "https-proxy-agent";
import {
  ShopeeShopProductRequest,
  ShopItemId,
  ShopItemsRequest,
  TestCookieTiktokRequest,
  TiktokShopSearchProductsRequest,
  URLsRequest,
  URLsRequestTiktok,
} from "../modules/scraper/scraper.interface.js";
import { FFSession } from "../libs/mrscraper-browser/firefox/ffConnection.js";
import { getPc } from "../libs/mrscraper-browser/firefox/ffBrowser.js";
import { firefox } from "playwright";
import {
  DiscountBreakdown,
  GetListData,
  GetPcData,
  Model,
  PriceBreakdown,
  ShopeeApiResponse,
} from "../interfaces/shopee.interface.js";
import { parse } from "tldts";
import { HttpRequest } from "./request.utils.js";
import { ShopeeSpResponse } from "../interfaces/shopee.sp.interface.js";
import { ShopeeSearchItemsResponse } from "../interfaces/shopee.si.interface.js";
import { db } from "../config/databases/sql.config.js";
import { env } from "process";
import serverConfig from "../config/server.config.js";
import { constants } from "buffer";

// ================== Scraper Helper ===================
const DISABLED_RESOURCES = [
  "jpeg",
  "jpg",
  "png",
  "gif",
  "css",
  "svg",
  "woff",
  "woff2",
  "ttf",
  "eot",
  "mp4",
];

const debug = debugGenerator("Scraper Util");
export let cluster: MrScraperCluster;
export const testWorker = async ({
  page,
  data: url,
  worker,
}: TaskFunctionArguments<string>) => {
  if (!page) {
    return;
  }
  if (page instanceof Page) {
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const isDisabledResource = DISABLED_RESOURCES.some((type) => {
        return request.url().endsWith(`.${type}`);
      });
      if (isDisabledResource) {
        request.abort();
      } else {
        request.continue();
      }
    });
    await page.goto(url);
    await delay(20000);
  }
};

export type ShopeeAPIStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "ERROR"
  | "BLOCKED_TOO_MANY_TIMES"
  | "CANCELLED"
  | "ERR_TOO_MANY"
  | "TIMEOUT";

interface ApiResponse {
  url: string;
  status: ShopeeAPIStatus;
  responseBody: string;
}
interface MrScraperResponse<T> {
  message: string;
  success: boolean;
  data: T;
}

export class TiktokError extends Error {
  proxy_id?: number;
  url?: string;
  status: ShopeeAPIStatus;
  ip?: string;
  responseBody?: string;
  constructor(
    message: string,
    url?: string,
    status: ShopeeAPIStatus = "ERROR",
    responseBody?: string,
    ip?: string,
    proxy_id?: number,
  ) {
    super(message);
    this.name = "ShopeeError";
    this.url = url;
    this.status = status;
    this.responseBody = responseBody;
    this.ip = ip;
    this.proxy_id = proxy_id;
  }
}

export const DATA_USAGE_PATH =
  "/home/leight/Leight/MrScraper/scraper-mrscraper/src/tmp/data-usage.csv";

// Function to convert an API URL back to its original Shopee URL
export const getShopeeParams = (apiUrl: string) => {
  // there are will be two types of url we need to handle:
  // 1. https://shopee.tw/api/v4/pdp/get_pc?item_id=2222624160&shop_id=3737015&tz_offset_minutes=420&detail_level=0&
  // 2. https://shopee.tw/%E6%A8%82%E9%AB%98-LEGO-42161-TEC-%E8%97%8D%E5%AF%B6%E5%A0%85%E5%B0%BCHurac%C3%A1n-Tecnica-i.2940251.20882475404
  const url = new URL(apiUrl);
  if (!url.hostname.includes("shopee"))
    throw new Error("Invalid API URL format: should be shopee url");
  if (!url.searchParams.get("shop_id") || !url.searchParams.get("item_id")) {
    // handle case 2: search for -i.{shop_id}.{item_id}
    const match = apiUrl.match(/-i\.(\d+)\.(\d+)/);
    if (match) {
      return { shopId: match[1], itemId: match[2] };
    }

    throw new Error(
      `Invalid API URL format: ${apiUrl}, missing shop_id or item_id`,
    );
  }

  const shopId = url.searchParams.get("shop_id") as string;
  const itemId = url.searchParams.get("item_id") as string;

  return { shopId, itemId };
};

export const getTiktokID = async (url: string) => {
  const res = await fetch(url, {
    method: 'HEAD',
    redirect: 'manual',
  });

  const location = res.headers.get('location');

  if (!location) {
    console.log('No redirect location found.');
    return;
  }

  const match = location.match(/\/place\/[^\/]+-(\d+)\?/);

  if (match && match[1]) {
    console.log('Place ID:', match[1]);
    return match[1];
  } else {
    console.log('Place ID not found in location URL.');
  }
}

export const replaceCountryCode = (cookie: string, currency: string) => {
  const newCookie = cookie.replace(/store-country-code=[^;]+/, `store-country-code=${currency}`);
  return newCookie;
}

// Function to convert an API URL back to its original Shopee URL
export const revertToOriginalUrl = (apiUrl: string) => {
  const url = new URL(apiUrl);
  if (!url.searchParams.get("shop_id") || !url.searchParams.get("item_id")) {
    throw new Error(
      `Invalid API URL format: ${apiUrl}, missing shop_id or item_id`,
    );
  }

  const shopId = url.searchParams.get("shop_id") as string;
  const itemId = url.searchParams.get("item_id") as string;

  return `https://shopee.tw/---i.${shopId}.${itemId}`;
};

export function processPriceShown(data: GetPcData): void {
  data.item.models = data.item.models.map((model) =>
    updateModelPrice(model, data),
  );
  const prices = new Set(data.item.models.map((model) => model.price));
  data.item.price_min = Math.min(...Array.from(prices));
  data.item.price_max = Math.max(...Array.from(prices));
  data.item.price = data.item.price_min;
  console.debug(`[DEBUG] Processed price shown for item ${data.item.item_id}`, {
    price: data.item.price,
    price_min: data.item.price_min,
    price_max: data.item.price_max,
  });
}

function updateModelPrice(model: Model, details: GetPcData): Model {
  const { price_before_discount: before, select_variation_response } = model;
  const data = select_variation_response?.data;

  if (!data) {
    console.error(
      `[ERROR] No select variant response data found for model ${model.model_id}`,
      {
        model,
      },
    );
    // fs.writeFileSync(
    //   "marcNoSelectVariantResponse.json",
    //   JSON.stringify({ model }),
    // );
  }

  if (model.price < 0) {
    model.price =
      data.product_price.price.range_max > 0
        ? data.product_price.price.range_max
        : model.price;
  }

  const breakdown = data?.price_breakdown?.discount_breakdown;

  // Skip if no “real” discount to apply
  if (!breakdown || breakdown.length < 1 || before === 0) {
    logSkipped(model, details, breakdown);
    return model;
  }

  const [first] = breakdown.filter((dc) => dc.type === 0);

  const newPrice = first ? before - first.discount_amount : before;

  console.debug(`[DEBUG] Model ${model.model_id} discounted:`, {
    before,
    discount: first,
    after: newPrice,
  });

  return { ...model, price: newPrice, price_before_discount: 0 };
}

function logSkipped(
  model: Model,
  data: GetPcData,
  breakdown?: DiscountBreakdown[],
) {
  if (model.price < 0) {
    console.error(`[ERROR] Model ${model.model_id} has negative price`, {
      model,
    });
    // fs.writeFileSync("marcNegativePrice.json", JSON.stringify({ data }));
  }

  console.debug(`[DEBUG] No applicable discount for model ${model.model_id}`, {
    current: model.price,
    before: model.price_before_discount,
    discountCount: breakdown?.length ?? 0,
  });
}

const countryTLDs: Record<string, string> = {
  bn: "Brunei Darussalam",
  kh: "Cambodia",
  id: "ID",
  "co.id": "ID",
  la: "Laos",
  my: "Malaysia",
  "com.my": "Malaysia",
  mm: "Myanmar",
  ph: "Philippines",
  "com.ph": "Philippines",
  sg: "Singapore",
  "com.sg": "Singapore",
  th: "Thailand",
  "co.th": "Thailand",
  vn: "Vietnam",
};
function getCountryFromDomain(domain: string) {
  const parsed = parse(domain);
  const suffix = parsed.publicSuffix;
  if (!suffix) return null;
  return countryTLDs[suffix];
}
interface ScraplessApiResponse {
  count: number;
  data: ObjectAny;
}

class ScraplessRequest extends HttpRequest {
  baseUrl: string = scraperConfig.thirdParty.thirdPartyApi;
  endpoint = {
    request: "/api/v1/scraper/request",
    result: "/api/v1/scraper/result",
  };
  apiToken: string = scraperConfig.thirdParty.thirdPartyToken;
  processedUrl: string = "";
  constructor() {
    super(
      {},
      {
        headers: {
          "x-api-token": scraperConfig.thirdParty.thirdPartyToken,
          "Content-Type": "application/json",
        },
        timeout: 60000 * 30, // 30 minutes
      },
    );
  }
  async scrapeProduct(url: string): Promise<ScraplessApiResponse | undefined> {
    try {
      const payload = {
        actor: "scraper.shopee",
        input: {
          action: "shopee.product",
          url: url,
        },
      };
      this.processedUrl = url;

      console.log("Starting Shopee scraping task with URL:", url);
      const response = await this.client.post(this.endpoint.request, payload);

      if (response.data?.taskId) {
        const result = await this.pollTaskResult(response.data.taskId);
        return result;
      }

      return response.data as ScraplessApiResponse;
    } catch (error) {
      this._handleError(error, "Failed to start scraping task");
    }
  }

  async pollTaskResult(
    taskId: string,
    attempt = 1,
  ): Promise<ScraplessApiResponse | undefined> {
    try {
      console.log(
        `[INFO] Checking task status [${attempt}/${this.maxRetries}] for task: ${taskId}`,
      );

      const response = await this.client.get(
        `${this.endpoint.result}/${taskId}`,
      );
      const data = response.data;

      if (data.state === "pending" || data.state === "processing") {
        if (attempt >= this.maxRetries) {
          throw new Error(
            `Task ${taskId} timed out after ${this.maxRetries} attempts`,
          );
        }

        console.log(
          `Task ${taskId} is ${data.state}... checking again in ${this.pollingInterval / 1000
          }s`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, this.pollingInterval),
        );
        return this.pollTaskResult(taskId, attempt + 1);
      }

      if (data.error) {
        throw new Error(`Task failed: ${JSON.stringify(data.error)}`);
      }

      return (
        (data.result as ScraplessApiResponse) || (data as ScraplessApiResponse)
      );
    } catch (error: any) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        throw new Error(`Task ${taskId} not found`);
      }
      this._handleError(error, `Failed to check task ${taskId}`);
    }
  }

  async getTask(taskId: string) {
    try {
      const response = await this.client.get(`/scraper/result/${taskId}`);
      return response.data;
    } catch (error) {
      this._handleError(error, `Failed to get task ${taskId}`);
    }
  }

  _handleError(error: any, message: string) {
    if (error instanceof AxiosError) {
      if (error.response) {
        const errorData = error.response.data;
        if (error.response.status == 500) {
          throw new TiktokError(
            "Internal Server Error",
            this.processedUrl,
            "FAILED",
            errorData,
            "api-sl",
          );
        } else if (error.response.status === 400) {
          throw new TiktokError(
            `Bad Request: ${errorData.message}`,
            this.processedUrl,
            "ERROR",
            errorData,
            "api-sl",
          );
        } else {
          console.error(`[ERROR] unhandled third party error`, error);
          throw new TiktokError(
            `Internal Server Error`,
            this.processedUrl,
            "ERROR",
            errorData,
            "api-sl",
          );
        }
      } else if (error.request) {
        console.error(`[ERROR] ${message}`);
        throw new TiktokError(
          ` No response received from server`,
          this.processedUrl,
          "ERROR",
          undefined,
          "api-sl",
        );
      } else {
        throw new TiktokError(
          `${error.message}`,
          this.processedUrl,
          "ERROR",
          undefined,
          "api-sl",
        );
      }
    } else if (error instanceof TiktokError) throw error;

    console.error(
      `[ERROR] Unhandled Error out of HttpRequest ${message}`,
      error.message,
      error.stack,
      error.response?.data,
    );
    throw new TiktokError(
      `${error.message}`,
      this.processedUrl,
      "ERROR",
      undefined,
      "api-sl",
    );
  }
}
// Worker handler
const cookiePool: string[] = [
  "tt_csrf_token=6LrKpWFD-zXlZorvi2dPXyGpi4wzEfZmd_n0; tt_chain_token=6Kw5xm1K/IX7i5dtApFo0w==; passport_csrf_token=7e1592ee67367c03a9d0baaf9d8e66cc; passport_csrf_token_default=7e1592ee67367c03a9d0baaf9d8e66cc; s_v_web_id=verify_mbuiwkvw_204sqkhw_V9nR_4wYJ_BJCx_Pt50dkZqG1cF; d_ticket=6e3ff6bce08c301aa20c16b01aa224174e995; multi_sids=7515335136775521297%3A907616bad8b0a36b00de47e858497004; cmpl_token=AgQQAPOgF-RO0rh1O9qjtp0o8ipCj8_a_5IrYN9nkQ; uid_tt=b81e123c1f20d0ae44c63a2d9ac9294cdf43eeb1490f23e6991927b9499b29c8; uid_tt_ss=b81e123c1f20d0ae44c63a2d9ac9294cdf43eeb1490f23e6991927b9499b29c8; sid_tt=907616bad8b0a36b00de47e858497004; sessionid=907616bad8b0a36b00de47e858497004; sessionid_ss=907616bad8b0a36b00de47e858497004; store-idc=alisg; store-country-code=id; store-country-code-src=uid; tt-target-idc=alisg; tt-target-idc-sign=Y9qWcaU7k7jpGCOn45qrv-MXbD0atzy4cfmPJQngPhwg3_Zkle2PiDH7EXs9cK6-T_92OEytfxUmkG-c3vLv_qzSVLKjAcH8grilBxkwBlmZeCW21Fv1hoTQVCnAbVxGdC8qk6mcTMBZ5IdUQ00y9Uwjf8aJRjSjb_Xf7cM7_rqLaGTt77kRbhZT2ZRXNa_sG0HTvMsTDB4R6BYgsYxbHy-3ghp-QxiF1WDN-XQIDNSAAlvCHmbv_WfxvgVa-JNmQyHjW8PbKdmzLKn8BPGEFQ_2c6_8NHO74it8DOMjEAqVhW5vOGa0b6E3y996kUhLnR-QK9Eu3p6HbeUFDMsRW3_MD0sR2ot08FWMVfn_zsgFvbr3EEem1RKroUjlDblnAG0zA1owQ5ZP0HoQL-i5_CXxKwpPrTvu0x_0_PkLpVpYBx0BGH43NaZYpLszm0EZoCdS66ZUojTZMaq6uGCuKJ8qsR0WuN1TtygJR5yijkTw0xfOWuUi9xKSJAcHN1xs; sid_guard=907616bad8b0a36b00de47e858497004%7C1749801960%7C15551996%7CWed%2C+10-Dec-2025+08%3A05%3A56+GMT; sid_ucp_v1=1.0.0-KDc5YWY2M2YxZDBkNTk0M2Y1YjBlYjAzYTdlNjczY2FiNjk1YzNhMDcKGgiRiJHc0q_1pWgQ6LevwgYYsws4BEDqB0gEEAMaA3NnMSIgOTA3NjE2YmFkOGIwYTM2YjAwZGU0N2U4NTg0OTcwMDQ; ssid_ucp_v1=1.0.0-KDc5YWY2M2YxZDBkNTk0M2Y1YjBlYjAzYTdlNjczY2FiNjk1YzNhMDcKGgiRiJHc0q_1pWgQ6LevwgYYsws4BEDqB0gEEAMaA3NnMSIgOTA3NjE2YmFkOGIwYTM2YjAwZGU0N2U4NTg0OTcwMDQ; ttwid=1%7CHOyBBSld7Ns8y1E-hcrPZCEtpHUzKkcnpbuxymf0ot0%7C1749801960%7C75bc7e0bef6513106c37d93a805d8428ce928b04a11e16d167b614adfea6f623; store-country-sign=MEIEDHxoWSeXQH2Dk6vAFgQgJxCyII4v1cjl3FZPCqvG1hnSw8sPzXbbmHYYYFfw18oEEA80zzJtYWuFk58YsQWywCU; odin_tt=7f83920c0d3f93a07159e17899ee3e21e83abdd485c184153627c071ee36a58fec3e37076ca72ac8c1fedd275ef05a8e79acdc7dc61a9d2d9be8021b05ce2dd6a8eb21c1bfaec1bb3472bcd94945f901; msToken=bk-gGQdmU3fFzpT5dqnAxtmQ83cdxkedrRflQp02vvGVpgIQjuoQhWKw1OSzGBkLOpGgD-Ffpo-NCyxcEGLY5KrTwOVFaFEBk_u9i3RxDZ39W6kmbw1cLXjvckwd0I2JqFAzCpaC4r8D5hHKSHBBorlA",

  "tt_csrf_token=d2wD5kwe-RkJO7I6W5bh75Bgyz0yeVcjTlMQ; tt_chain_token=wg2yZAA2sOehcx/5IloO3Q==; passport_csrf_token=191f37b1853e4a05ec42bb2d500f2d4e; passport_csrf_token_default=191f37b1853e4a05ec42bb2d500f2d4e; s_v_web_id=verify_mbuiy4jz_oEPXrVPv_SnjE_4kS6_99Q6_m5jr6ILT46RY; d_ticket=16cb57db95325facfb1ec8408c113012b7fd5; multi_sids=7514928737751974930%3A01143790f2ac09ef3b3053868e955d7e; cmpl_token=AgQQAPOgF-RO0rh0jXiOJh0r8ipCySmdP5IrYN9nkw; uid_tt=f6b20afb147079525396d4f2b3e4d9cd410dc0a933450b69adc1fddd2f027472; uid_tt_ss=f6b20afb147079525396d4f2b3e4d9cd410dc0a933450b69adc1fddd2f027472; sid_tt=01143790f2ac09ef3b3053868e955d7e; sessionid=01143790f2ac09ef3b3053868e955d7e; sessionid_ss=01143790f2ac09ef3b3053868e955d7e; store-idc=alisg; store-country-code=id; store-country-code-src=uid; tt-target-idc=alisg; tt-target-idc-sign=F1t7NBBQNwucQvwFhQgYUrkjTg1OvvtbmEWwHPXk8l-funy42tObE6jwMS4IuYpddBxg8n8N984_3c306qrrVeDBXNFL6CA7y5ZVMSL5O9qf1eH-d9t4VMUDXRwDNgZaQ1Tf5tmdnL-z5AE-VtDcAX5wubUdBwaQKdO79U_291_Z-LCcsC4CDsEwHUEKX9PZUaEEcpwAZuoWM1r7m__vRhMB9qLyO6-1IJ6O-YbzTpQY4xy4Q6tlcO82Ves2EOzTgeLhXAwAd2B8Q4v2IPfZbw1YQ6vWdBpcQhaS7L8tNZSV1lrZpGAEtVrLZoAEKFlgfd0ZLsSLPqDyjSclxc0vV2_OaYRp8M0z8CBk4nNJA7hm0Dts64THLma-jor1ohCq0ysFRUqNtihxyadBqCjQWLuTJ-alSpoT2OF_rlazu22tkdGdQnOpHHD2owBir6W5_rIXcWgUhXk1eSQLQZHPtCLUlTD_1WFjR5LdWuGp4tAg-IJh7c0FBL0jsz5Alml0; store-country-sign=MEIEDA0wcHPlOSb_TZx3qQQgliLkUArcAkqsLZaiWMB8N6MqCACWBtG4zgl9j2pJxvwEELOyw5YCTMLABIWaF3EeqA8; ttwid=1%7Ch7bzO-DA07Df7HxtNZIyT8d8UrUR6Zd1cQuxFhb8kXQ%7C1749802033%7C9a4879672a7157c09c68e2d149c7fe4b7b8650227f89bee81e30bc168f266eac; sid_guard=01143790f2ac09ef3b3053868e955d7e%7C1749802033%7C15551995%7CWed%2C+10-Dec-2025+08%3A07%3A08+GMT; sid_ucp_v1=1.0.0-KDczNGEzNzQ4NTUwNTBkOTc5MzM0Njg3NzgwNGJkMDgzN2Q4NDIxNzQKGgiSiNOw8PuYpWgQsbivwgYYsws4BEDqB0gEEAMaA3NnMSIgMDExNDM3OTBmMmFjMDllZjNiMzA1Mzg2OGU5NTVkN2U; ssid_ucp_v1=1.0.0-KDczNGEzNzQ4NTUwNTBkOTc5MzM0Njg3NzgwNGJkMDgzN2Q4NDIxNzQKGgiSiNOw8PuYpWgQsbivwgYYsws4BEDqB0gEEAMaA3NnMSIgMDExNDM3OTBmMmFjMDllZjNiMzA1Mzg2OGU5NTVkN2U; odin_tt=50b0af146de56cb67b63413eb8324651183a1229231b6c47c578bb5bdcd1e5d334534e1eaf6e2ca744933da84dd4042603ac65a6d50bef035a13e692720831caeb30efaebdd75986b67ef07d33bdd6ff; msToken=sTWvzhdhwoucFFVbA65gWlRoRim9smCja-Q_B6yDibfV_68kozAz312To9iKAIJhhAuMUMLYHSBwCJzN2-e-kTpsHNS-M3iuhkMCtkQJRlBpHd4zRuNN0b3jjRKuKStS2ezx0s_8Wt8x_Q==",

  "_ttp=2e1RKGgOQpiaWK2QIdUvOHxRIlM; tt_chain_token=SV+H9VkhONOOfu6h7qcv0Q==; delay_guest_mode_vid=3; _ga=GA1.1.1341691172.1734426827; _ga_LWWPCY99PB=GS1.1.1734681226.3.1.1734681252.0.0.152646129; living_user_id=403375593621; _tea_utm_cache_1988={%22utm_source%22:%22copy%22%2C%22utm_medium%22:%22android%22%2C%22utm_campaign%22:%22client_share%22}; _tea_utm_cache_594856={%22utm_source%22:%22copy%22%2C%22utm_medium%22:%22android%22%2C%22utm_campaign%22:%22client_share%22}; _tea_utm_cache_548444={%22utm_source%22:%22copy%22%2C%22utm_medium%22:%22android%22%2C%22utm_campaign%22:%22client_share%22}; _tea_utm_cache_345918={%22utm_source%22:%22copy%22%2C%22utm_medium%22:%22android%22%2C%22utm_campaign%22:%22client_share%22}; tt_csrf_token=TGTzVmai-5cGKU9iNtdr69rKHYxMGy9KFYWM; csrf_session_id=3bbceea6e3677d92b8157dd18c5ef554; passport_csrf_token=3e3c09fab6b566fc16e1cb1416bf99c7; passport_csrf_token_default=3e3c09fab6b566fc16e1cb1416bf99c7; s_v_web_id=verify_mbug3lvv_UHA2F0oi_Jrl1_4wSp_Bsg4_uy7J5INcWZox; passport_auth_status=cadccc180af74e3fc28219870ff8bcf0%2C; passport_auth_status_ss=cadccc180af74e3fc28219870ff8bcf0%2C; tiktok_webapp_theme=dark; d_ticket=f2e137e35329852181aba0023cad6bf64b511; multi_sids=7515336078065828865%3A450f3dff2054c1bbfc939a17843199b3; cmpl_token=AgQQAPOgF-RO0rh1OP_c-F04_Lj_iepbf4UrYN9nkA; uid_tt=a79c8987158903adda5b12049414d38e109f830b5be7701b3f6ad571077733f8; uid_tt_ss=a79c8987158903adda5b12049414d38e109f830b5be7701b3f6ad571077733f8; sid_tt=450f3dff2054c1bbfc939a17843199b3; sessionid=450f3dff2054c1bbfc939a17843199b3; sessionid_ss=450f3dff2054c1bbfc939a17843199b3; store-idc=alisg; store-country-code=id; store-country-code-src=uid; tt-target-idc=alisg; tt-target-idc-sign=qZf55brHVojIqDWnjBS4StDffqAiedhjH9mbojwpEXc8LH1f1_fnrurOJAMBdiWUtijpQQEytgf_KY6vnyGMfaSDO-vqjXQKGMk-VM9jKWgy3O9hfuw_EGqom587TU6xTXm-E6gQ_6-UQ-C2lkzEPcG-yoJvffBMSMi0LjxCARH0VFRetc4WfIqq2p5D-h_l-U_ywxxpjAnK-wUUr6YJTsAptVu-izFu8UUVeimo-Z531A3yD_yi_aInbougX4b4l6p-Ec5vTeCVdy-MHzyzkDAo-mwWkQdPitkTp8UjYgSLlncq6cQ9n4zEv-9olAOp3C9lPqcAkfIf_dNHgaCqTmOKDYZBMQ6dz1eIa9Wi2my0lXN9cm8haZq4Xx4cXgr5BjTd70F-TPibzkdLzXMEmvepeMm2C7ayLyOe3U_ajVhJMd0Azxv6n1z_bKYa4aYngtUxswxnnXdihb5gW9vGx6w9qdgg7bhh4chVwt1GDRLPoX_YjDtcQ4O7s2fuiTl7; last_login_method=handle; tiktok_webapp_theme_source=auto; passport_fe_beating_status=true; ttwid=1%7CXL-mrApieUgADCueDalS2tYCLZEFfiBD7NZ1evbO6IE%7C1749801903%7C1a53c10a36fc3a88f46dc43041c1d1e667ac0cef037c5fbd080f20c68c469084; sid_guard=450f3dff2054c1bbfc939a17843199b3%7C1749801903%7C15551996%7CWed%2C+10-Dec-2025+08%3A04%3A59+GMT; sid_ucp_v1=1.0.0-KGQzMzgzNzI5ODkwOGEwZGQ3MjlkNTViNzllY2JkNzRlZWJmZDc0ZDYKGgiBiKqmhcv1pWgQr7evwgYYsws4BEDqB0gEEAMaA3NnMSIgNDUwZjNkZmYyMDU0YzFiYmZjOTM5YTE3ODQzMTk5YjM; ssid_ucp_v1=1.0.0-KGQzMzgzNzI5ODkwOGEwZGQ3MjlkNTViNzllY2JkNzRlZWJmZDc0ZDYKGgiBiKqmhcv1pWgQr7evwgYYsws4BEDqB0gEEAMaA3NnMSIgNDUwZjNkZmYyMDU0YzFiYmZjOTM5YTE3ODQzMTk5YjM; store-country-sign=MEIEDJJrLWD8TWsjLo-ddQQgqnedZvSYqW_2BexdA1bTfi7oIVeq2826Qvgr2gPc79YEEIJs-ghImsiZGW8rXUsZgms; perf_feed_cache={%22expireTimestamp%22:1749974400000%2C%22itemIds%22:[%227482076152270441733%22%2C%227491126483398757687%22%2C%227508638527660281094%22]}; msToken=YtG0HA3iBqMDd7UAS49Pr2opvEn6JSf2Hu0dtgB2bOGK4FZMKxHeMIzKn_YXGDufdUOusDEWXHuDBeVDVfCYcGcMR3Ux2s0kd4FKdxBgS1lgL_QvuQTg1RSqsUYTPlm7pn6tZ2m8BAbccQQ=; msToken=YtG0HA3iBqMDd7UAS49Pr2opvEn6JSf2Hu0dtgB2bOGK4FZMKxHeMIzKn_YXGDufdUOusDEWXHuDBeVDVfCYcGcMR3Ux2s0kd4FKdxBgS1lgL_QvuQTg1RSqsUYTPlm7pn6tZ2m8BAbccQQ=; odin_tt=bb73ccc654363c70b8ea19f96b0bd5cad5828153743595cdcc2dc305b98f1f8a0597531ee02444872fb5faccac6d377cdf20f3fc34725bf3d67d6d7ab96067d65ab5a641e195b42123fa687550a6c711",

  "tt_csrf_token=IEBHf8Ey-dVpIIKt5eQOY9is3YMeBw-a2Kmo; tt_chain_token=G0ty+Of4maB9jz6UGpjmew==; tiktok_webapp_theme=dark; delay_guest_mode_vid=5; passport_csrf_token=f164e75f7c229e5a1a108839d211a332; passport_csrf_token_default=f164e75f7c229e5a1a108839d211a332; s_v_web_id=verify_mbuitig9_fKKiURec_Q9ER_4Fme_A2Rj_kk4BGFYskbtl; d_ticket=999fab66bd8cfe091d41beba267eec2b38fbf; multi_sids=7515336729298256897%3Abb622d6bcbb05a5340adf884630170a8; cmpl_token=AgQQAPOgF-RO0rh1OEh9dh048ipOPi4Mv5IrYN9nlw; uid_tt=576ac2f5b8453992bc953b8e3d9d90860d18798dcae88446929855ec1ca3da41; uid_tt_ss=576ac2f5b8453992bc953b8e3d9d90860d18798dcae88446929855ec1ca3da41; sid_tt=bb622d6bcbb05a5340adf884630170a8; sessionid=bb622d6bcbb05a5340adf884630170a8; sessionid_ss=bb622d6bcbb05a5340adf884630170a8; store-idc=alisg; store-country-code=id; store-country-code-src=uid; tt-target-idc=alisg; tt-target-idc-sign=fajOrsdX1N7oFH6mSrBiFpIKAS5t2Dr46UOSbLQjJlbbpr1_WfRjOE48H-tgwfWRsDmWYfz7tw47jIj7sAZKzWWq5B2x2CqpKxCtuYVqiGl-Hl-R8UN8qqutlpz3CcO4bBN8RzM5ItsXPkhQ_0BYGwZl6zKPuE1lS45o3DX2IxTdnx4fdwwoHvyOSD6I_AYm96uNRuj1viFt-AfGMlWag4Cxs3htWCNBz3oeLmp9QdMHd92AmPzN3qkcaceQD-WBam4NUrSZBTKlitS6ZNwvbPois8JDMPGEfy2ZT405_XDyq4de18Yid2cfJOnnDJN46CJjlAdt7FHTw-SUiGsK2Ssjhc9Wz2aESDtoGv5GVFInE3EcjNItMjoaQ3edezZ2dTG1ZTwmZPQOEW2PDF4CwZ6qwWhKzoViyLUK1PdRUL-JMQ1i5c9uossaErcwIT_yIHDHUEojqxHZn9iccDgXsVge7HJuVc7suCo7inG44dxWtK9GOfwU-B1sV7GoNlMx; last_login_method=handle; tiktok_webapp_theme_source=auto; passport_fe_beating_status=true; ttwid=1%7CQ8vtigamgRc2EdRxwVIAz1pw9HUphcGfCJnPVtnHZIU%7C1749801830%7C51d314a9cf06332677579bfacdd92b9027557ee19a91f2f2a69242c19bc5cb45; sid_guard=bb622d6bcbb05a5340adf884630170a8%7C1749801830%7C15551996%7CWed%2C+10-Dec-2025+08%3A03%3A46+GMT; sid_ucp_v1=1.0.0-KGFjOTk5Yjk2NDNlZThhZGZhNWM4OTdkOGI4ODVlN2NjMzEwZGIzMjEKGgiBiJOq_931pWgQ5ravwgYYsws4BEDqB0gEEAMaA3NnMSIgYmI2MjJkNmJjYmIwNWE1MzQwYWRmODg0NjMwMTcwYTg; ssid_ucp_v1=1.0.0-KGFjOTk5Yjk2NDNlZThhZGZhNWM4OTdkOGI4ODVlN2NjMzEwZGIzMjEKGgiBiJOq_931pWgQ5ravwgYYsws4BEDqB0gEEAMaA3NnMSIgYmI2MjJkNmJjYmIwNWE1MzQwYWRmODg0NjMwMTcwYTg; store-country-sign=MEIEDB8bpkDW8XAp4jH-0AQgLFf2izh8c70jrh-zYyFlf_jrTa1al6QegIp5y6-k7kwEECPQ2OdfHhqhIQt-LYwFZgI; perf_feed_cache={%22expireTimestamp%22:1749974400000%2C%22itemIds%22:[%227482076152270441733%22%2C%227508638527660281094%22%2C%227508520883812683064%22]}; msToken=o2FPZJKprO5wX1q7-_6XE6mjognVn9Uq1UKgsdciMvjv6fegrvTa7cPwL-8_1ZDV40jDPtO--KXX-7M7c0Sc0O_4A8DtaC9DxSJFof1XQyFRITT_JJ9gPwjIXdcwD_Grs_B66_sIauVuRg==; odin_tt=00e57f7fbe4f1422c0a05b85fb5b1b16a81d536a5aac90cae5d281274cac2e52d5833812ffb3cb06e1376cfaecc7a3be073da8b60aa094e94a4d47316058753d218519e7257d659465519f70e6e834a7; msToken=s4IJGMLCR5s3YjA37dCG2ljnZ9DgDaewosGPT1qhgGIVwR2R0sYfRqqMZYn_WZQ47tiF3ouulZUOaijHFT2X7qRonrKiFppAY8JlXNCfcobA8sG0_gJLmb75VQ_diMJ-qm3Prtn4uSMGbg==",

  "_ttp=2xAjnufeMQxcAmrpRBO3ScXgVPH; _fbp=fb.1.1749523460021.1562813178; tt_chain_token=SI4qT7QPnaSXattYsFjIIQ==; passport_csrf_token=82caddb91b026bb277fc9049c8ffffc5; passport_csrf_token_default=82caddb91b026bb277fc9049c8ffffc5; tt_csrf_token=6jPUPJXR-E1jas-fLrgDIas7a-Jnpv5vGF5g; s_v_web_id=verify_mbuhqxez_7WJz8Coo_LC12_4ty6_9VrO_GF5ebuPRhcGB; multi_sids=7515337477687788561%3A5c1281b70f377702d10719fc866827dc; cmpl_token=AgQQAPOgF-RO0rh1OTm88B0o8iYCxUAfv5ArYN9now; uid_tt=2e5629597083cd5ccef971f2bd4d79b4402c53b25039fc86554f7833b1796d59; uid_tt_ss=2e5629597083cd5ccef971f2bd4d79b4402c53b25039fc86554f7833b1796d59; sid_tt=5c1281b70f377702d10719fc866827dc; sessionid=5c1281b70f377702d10719fc866827dc; sessionid_ss=5c1281b70f377702d10719fc866827dc; store-idc=alisg; store-country-code=id; store-country-code-src=uid; tt-target-idc=alisg; tt-target-idc-sign=W5e_YB4y1FVWsc3xkZYmTf6dQn_lSHziWOEhBSs8YEe9wttBSf3uLeGXl0remRbEh0cAQvyhq2vCf1cuCT9exffxfunt6XTc9jUIJ1uNato06Sj9Mp13YBZBCtFK7b35KgTdd4OjMWudBA117nTPLHkPUODMxZJKygdvVl2WmpsIvAjk7gjIHHM_9l7KNQ4bIGcjDgqw-LIxggI4W-l9CLbTEARU9abs9HJKAlHiCJTuiGE37ykFUgzXm53uEBSFUO6Vg8cQgJutB1BDpsjkJRfM9icGTzQq9iLpA4xNb0hao9hK50OklX66vm-qlhFtVqbxFSmkMa2aJlmZ3n6jUbjPCiyDkeryEFibgtKV0CL49HFP0DSsu2qsRehwOl4zOSUSMaEGKXec390CEiHEQgiDAtUf12pqyhauInDBTTt4ZNWejpwrzx3pbJuSwtMWir4rDZT9Ul-NrQLfdDr8Gh52AhNny8spA0sakCCw8ZB5_cArlX2cw_ylE1Fw9Ym3; sid_guard=5c1281b70f377702d10719fc866827dc%7C1749801110%7C15551993%7CWed%2C+10-Dec-2025+07%3A51%3A43+GMT; sid_ucp_v1=1.0.0-KGZlZTgyMjIxYTNmYmFjYTE5ZTk3NzhlNzUwOWRmZWNkZWI1YTM5MDkKGgiRiIum4_P1pWgQlrGvwgYYsws4AUDrB0gEEAMaA3NnMSIgNWMxMjgxYjcwZjM3NzcwMmQxMDcxOWZjODY2ODI3ZGM; ssid_ucp_v1=1.0.0-KGZlZTgyMjIxYTNmYmFjYTE5ZTk3NzhlNzUwOWRmZWNkZWI1YTM5MDkKGgiRiIum4_P1pWgQlrGvwgYYsws4AUDrB0gEEAMaA3NnMSIgNWMxMjgxYjcwZjM3NzcwMmQxMDcxOWZjODY2ODI3ZGM; ttwid=1%7CR1IzSl_feRMcnq13aprsee_8SwtwiQdbHeg8TAfhPo0%7C1749801740%7Cdf879fe209ff57bc1f8e3398ccf40bac1fe46d006d55d9f5467c2a30a4ec1c3a; store-country-sign=MEIEDK2bR2Ta5xRJsGkhaAQgOFMNEIgY0aMr0QXw8P5tHiMICYUvCxauyQhjz5bgvEoEEIriOrUtDMAWH2Rrz_QCmkc; odin_tt=57c6518cb13ff63d5d10707e5420046e6e7797a74f691f4c8d707767cfe6e936641a19d2d9ade38dad4573833594d6503d971c82f0cae039c33f7b39431f32134395cdb78a70dfe0b155b442c4bed91b; msToken=PAkigJzZlF7xBTkG3HRdct7ampMnHUhmiiS7DffnenutzWDXRxksO7h5Lf8JifZyt0Vj7xZCYEwW4aGjUBVBKj4Orksji7TNiy2nCFCSKV8h6_0P1dw9VOcTw-P1B78utabt5pynjVeS6C4shnyuYYxYKg==",
];

function buildHeaders(): Record<string, string> {
  return {
    "Passport-Sdk-Version": "-1",
    "Cookie": cookiePool[Math.floor(Math.random() * cookiePool.length)],
  };
}

const headers = {
  'Passport-Sdk-Version': '-1',
  "Cookie": "install_id=7509847089892624135; ttreq=1$49a86b61e802b6629096e000646942ecfe9daa4f; store-country-code-src=uid; passport_csrf_token=ed4f9277f2d3302a166801eb4d75b613; passport_csrf_token_default=ed4f9277f2d3302a166801eb4d75b613; tt_ticket_guard_has_set_public_key=1; multi_sids=7480178227501122568%3A5dbfe05c3298e22c0948372fd25560f4%7C6942051423673713666%3A2a815df86d5a8b5da51fff79e154707a; cmpl_token=AgQQAPOgF-RP_bBp8FrIo907_axBS7nbv4orYN9r8A; sid_guard=2a815df86d5a8b5da51fff79e154707a%7C1749611793%7C15552000%7CMon%2C+08-Dec-2025+03%3A16%3A33+GMT; uid_tt=546468653417ac091667af7e451e8245928610b518034d94fde05b8403227afa; uid_tt_ss=546468653417ac091667af7e451e8245928610b518034d94fde05b8403227afa; sid_tt=2a815df86d5a8b5da51fff79e154707a; sessionid=2a815df86d5a8b5da51fff79e154707a; sessionid_ss=2a815df86d5a8b5da51fff79e154707a; store-idc=alisg; store-country-code=id; tt-target-idc=alisg; store-country-sign=MEIEDLK_MgbIALiHgJ7uwQQgZ14KqGWtofrIzMOQHtlB52oeKCwni0nO-M_ifARQWSwEEIMfWfXdto8gGzDZFI4xUiY; msToken=DrBN3LBnMQlx6jr7ZkJJRfh6AMccmxz590oQgWsATa19v5LxM2030rMz5pkE4m9GerSWEwPbQloS9Txsl6bPk8EXaS2yv5joE21Fw00R2M8=; odin_tt=3237007eb5c0c32c3690d0152f4d79406de646c94e2f7ffbb774fccb08daeba3e7438bd2cfeab4c6a1ea1846535f7564399126a4f625315fe2b93160a8102acffbf315984c63fccf88d0326a25a91502; odin_tt=257d94cd6757e605d452d575f296ddeee67697bfd07450cfc91cd65811e78ec64b614cf44f58254a98c0bc2b9700b041ef82ddddfb238546e652599ad23b3794d9e07300e4e25be8bba3bd4c7a44b02e"
};

// const params = {
//   scene: "poi",
//   service_type: "main",
//   device_platform: "android",
//   os: "android",
//   aid: '1233',
//   version_name: '40.6.3',
//   language: "en",
//   current_region: "US",
//   sys_region: "US",
//   app_language: "id",
// };

// function convertToCheckInTimeStamp(dateStr: string) {
//   return Math.floor(new Date(dateStr).getTime() / 1000);
// }

// function convertToCheckoutTimeStamp(dateStr: string) {
//   const date = new Date(`${dateStr}T23:59:59+08:00`);
//   return Math.floor(date.getTime() / 1000);
// }

/** Offset UTC detik per kode negara (perluas sesuai kebutuhan). */
const OFFSET_SECONDS: Record<string, number> = {
  ID: 25200,
  SG: 28800,
  MY: 28800,
  TH: 25200,
  VN: 25200,
  PH: 28800,
  TW: 28800,
  JP: 32400,
  KR: 32400,
};

function formatIsoOffset(offsetSeconds: number) {
  const sign = offsetSeconds >= 0 ? "+" : "-";
  const abs = Math.abs(offsetSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** check-in: 00:00:00 lokal • check-out: 23:59:59 lokal */
function convertToTimestamp(
  dateStr: string,
  kind: "check_in" | "check_out",
  country: string,
): number {
  const cc = country.toUpperCase();
  const sec = OFFSET_SECONDS[cc] ?? OFFSET_SECONDS.ID;
  const off = formatIsoOffset(sec);
  const time = kind === "check_in" ? "T00:00:00" : "T23:59:59";
  const ms = Date.parse(`${dateStr}${time}${off}`);
  return Math.floor(ms / 1000);
}

// function convertToTimestamp(date: string) {
//   const dateInput = date;
//   const timeWIB = "14:26:25";

//   const [h, m, s] = timeWIB.split(":").map(Number);

//   const dateParts = dateInput.split("-").map(Number);
//   const dtUTC = new Date(Date.UTC(
//     dateParts[0],      // year
//     dateParts[1] - 1,  // month (0-indexed)
//     dateParts[2],      // day
//     h - 7,             // hour UTC
//     m,                 // minute
//     s                  // second
//   ));

//   const result_timestamp = Math.floor(dtUTC.getTime() / 1000);
//   return result_timestamp;
// }

function generateDeviceIdWithPrefix7() {
  let id = '7';
  for (let i = 0; i < 18; i++) {
    id += Math.floor(Math.random() * 10);
  }
  return id;
}

const extractRoomSize = (subTag: any) => {
  if (typeof subTag !== "string") return null;
  const match = subTag.match(/(\d+)\s?m²/);
  return match ? parseInt(match[1], 10) : null;
};

const extractMaxOccupancy = (subTag: any) => {
  if (typeof subTag !== "string") return null;
  const match = subTag.match(/(\d+)\s?pax/);
  return match ? parseInt(match[1], 10) : null;
};

/** Get room_size and max_occupancy from mspu: supports mspu_sub_tag_list (array) or mspu_sub_tag (string). */
function getRoomSizeAndOccupancy(mspu: any): { roomSize: number | null; maxOccupancy: number | null } {
  let roomSize: number | null = null;
  let maxOccupancy: number | null = null;
  const list = mspu?.mspu_sub_tag_list;
  if (Array.isArray(list)) {
    for (const item of list) {
      const name = item?.attribute_name;
      const content = item?.content != null ? String(item.content) : "";
      if (name === "spu_roomsize") {
        const m = content.match(/(\d+)\s?m²/);
        if (m) roomSize = parseInt(m[1], 10);
      } else if (name === "spu_maxcapacity") {
        const m = content.match(/(\d+)\s?pax/);
        if (m) maxOccupancy = parseInt(m[1], 10);
      }
    }
  }
  const subTag = mspu?.mspu_sub_tag ?? "";
  if (roomSize === null) roomSize = extractRoomSize(subTag);
  if (maxOccupancy === null) maxOccupancy = extractMaxOccupancy(subTag);
  return { roomSize, maxOccupancy };
}

function getWIBTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wib = new Date(utc + 7 * 60 * 60000);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatted = `${wib.getFullYear()}-${pad(wib.getMonth() + 1)}-${pad(wib.getDate())} ${pad(wib.getHours())}:${pad(wib.getMinutes())}`;
  return formatted
}

function getCurrencyByCountry(country: string): string | undefined {
  const currencyMap: { [key: string]: string } = {
    'id': 'IDR',   // Indonesia
    'sg': 'SGD',   // Singapore
    'th': 'THB',   // Thailand
    'my': 'MYR',   // Malaysia
    'vn': 'VND',   // Vietnam
    'ph': 'PHP',   // Philippines
    'kh': 'KHR',   // Cambodia
    'la': 'LAK',   // Laos
    'mm': 'MMK',   // Myanmar
    'bn': 'BND',   // Brunei
    'cn': 'CNY',   // China
    'jp': 'JPY',   // Japan
    'kr': 'KRW',   // South Korea
    'tw': 'TWD',   // Taiwan
    'hk': 'HKD',   // Hong Kong
    'mo': 'MOP',   // Macau
    'in': 'INR',   // India
    'pk': 'PKR',   // Pakistan
    'bd': 'BDT',   // Bangladesh
    'lk': 'LKR',   // Sri Lanka
    'np': 'NPR',   // Nepal
    'bt': 'BTN',   // Bhutan
    'mv': 'MVR',   // Maldives
    'af': 'AFN',   // Afghanistan
    'uz': 'UZS',   // Uzbekistan
    'kg': 'KGS',   // Kyrgyzstan
    'tj': 'TJS',   // Tajikistan
    'tm': 'TMT',   // Turkmenistan
    'kz': 'KZT',   // Kazakhstan
    'mn': 'MNT',   // Mongolia
    'ir': 'IRR',   // Iran
    'iq': 'IQD',   // Iraq
    'sa': 'SAR',   // Saudi Arabia
    'ae': 'AED',   // United Arab Emirates
    'qa': 'QAR',   // Qatar
    'kw': 'KWD',   // Kuwait
    'om': 'OMR',   // Oman
    'bh': 'BHD',   // Bahrain
    'jo': 'JOD',   // Jordan
    'lb': 'LBP',   // Lebanon
    'sy': 'SYP',   // Syria
    'ye': 'YER',   // Yemen
    'ps': 'ILS',   // Palestine (uses Israeli New Shekel)
    'il': 'ILS',   // Israel (in Asia for some contexts)
    'tr': 'TRY',   // Turkey (partly in Asia)
    'ge': 'GEL',   // Georgia
    'az': 'AZN',   // Azerbaijan
    'am': 'AMD',   // Armenia
    'ru': 'RUB',   // Russia (partly in Asia)
  };
  return currencyMap[country.toLowerCase()] || "";
}

function formatResponse(nodes: any, input: URLsRequestTiktok) {
  // fs.writeFileSync("response.json", JSON.stringify(nodes))
  const rawStar = nodes.poi_head_info?.data?.poi_detail_top_tags?.[0]?.tag_content?.common_text ?? "";
  const match = rawStar.match(/^(\d)|(\d)(?=\s*$)/);
  const star_rating = match ? parseFloat(`${match[1] || match[2]}.0`) : null;

  const scrape_time = getWIBTime();

  // Handle both old and new data structures
  const productShelf = nodes.dynamic_calendar_room_product_shelf_lynx ?? nodes.multi_merchant_product_shelf_lynx;
  let businessData = productShelf?.data?.business_data;

  // Parse business_data if it's a JSON string (new format)
  if (typeof businessData === 'string') {
    try {
      businessData = JSON.parse(businessData);
    } catch (e) {
      console.error('Failed to parse business_data JSON:', e);
      businessData = null;
    }
  }

  const spec = {
    specs: {
      hotel_id: input.poi_id,
      country: input.country,
      language: input.language,
      check_in: input.check_in,
      check_out: input.check_out,
      adults: input.adults,
      currency: "",
      scraped_at: scrape_time,
      target_site: "tiktok.com",
    },
    hotel_detail: {
      hotel_name: nodes.poi_head_info?.data?.poi_name ?? "",
      star_rating: star_rating,
      address: nodes.poi_head_info?.data?.formatted_address ?? "",
      lat: nodes.poi_head_info?.data?.location?.lat ?? null,
      long: nodes.poi_head_info?.data?.location?.lng ?? null,
      review_score: nodes.poi_head_info?.data?.poi_review_summary?.score ?? null,
      review_count: nodes.poi_head_info?.data?.poi_review_summary?.total_count ?? null,
      pic_url: nodes.category_background_album?.data?.picture_album?.pictures?.[0]?.url_list?.[0] ?? "",
    },
    rooms: businessData?.product_shelves?.map((merchant: any, i: number) => {
      if (merchant.mspu_list) {
        let is_promo_applied = false;
        if (merchant.merchant_marketing_price_ext) {
          try {
            const price_ext = JSON.parse(merchant.merchant_marketing_price_ext)
            const sub_prices = price_ext?.promotion_detail?.price_break_down?.sub_prices
            const promoCodeItem = sub_prices?.find(
              (item: any) =>
                item.key === "promo_code_discount" &&
                item.promotion_info &&
                item.promotion_info.coupon_code
            );

            if (promoCodeItem) {
              is_promo_applied = true;
            }

          } catch (e) {
            console.error('Failed to parse merchant_marketing_price_ext:', e);
          }
        }
        return {
          platform_name: merchant.merchant_name,
          rank: i + 1,
          product_list: merchant.mspu_list?.flatMap((product: any, i: number) => {
            const mspu = product.mspu_info;
            const priceInfo = mspu.mspu_ari_prices?.[0]?.average_price ?? "";
            const { roomSize, maxOccupancy } = getRoomSizeAndOccupancy(mspu);

            const baseFields = {
              room_name: mspu.mspu_name ?? "",
              room_image: mspu.raw_mspu_img_list?.product_images?.[0]?.url?.[0] ?? "",
              room_size: roomSize,
              room_size_unit: roomSize ? "sqm" : null,
              max_occupancy: maxOccupancy,
              discount_percent: priceInfo.discount_num != null
                ? +(priceInfo.discount_num * 100).toFixed(1)
                : null,
            };

            return product.products?.map((subProduct: any) => {
              const tags = subProduct.sku_tags?.map((tag: any) => tag.tag_content.toLowerCase()) ?? [];
              const is_breakfast = !tags.some((t: any) => t.includes("tidak termasuk sarapan") || t.includes("breakfast not included"));
              const refundable = !tags.some((t: any) => t.includes("tidak bisa dikembalikan") || t.includes("non-refundable"));
              const rate_type = tags.some((t: any) => t.includes("bayar di muka") || t.includes("pay in advance") || t.includes("pay now")) ? "PAY_NOW" : "PAY_AT_HOTEL";
              const price_info = subProduct.product_ari_prices?.[0]?.average_price;

              // Parse marketing_price_ext for additional promotion details
              let marketingExt = null;
              if (subProduct.marketing_price_ext) {
                try {
                  marketingExt = typeof subProduct.marketing_price_ext === 'string'
                    ? JSON.parse(subProduct.marketing_price_ext)
                    : subProduct.marketing_price_ext;
                } catch (e) {
                  console.error('Failed to parse marketing_price_ext:', e);
                }
              }

              return {
                product_id: subProduct.product_id ?? null,
                ...baseFields,
                is_promo_applied: is_promo_applied,
                final_price: price_info?.offer_price_num,
                original_fare: price_info?.original_price_num ?? price_info?.offer_price_num,
                currency: getCurrencyByCountry(input.country) || "",
                rate_type,
                is_breakfast,
                refundable,
                discount_detail: subProduct.product_marketing_info?.highlight_tag?.content
                  ?? subProduct.product_marketing_info?.normal_tag?.content
                  ?? null,
                // Other optional fields from updated data structure (uncomment if needed)
                // click_url: subProduct.click_url,
                // click_url: subProduct.click_url,
                // marketing_price_ext: marketingExt,
                // promotion_info: merchant.promotion_info,
                // disclaimer_info: merchant.disclaimer_info,
                // merchant_id: merchant.merchant_id,
                // shop_url: merchant.shop_url,
                // cta_text: merchant.cta_text,
                // expand_cta: merchant.expand_cta,
                // fold_cta: merchant.fold_cta,
                // view_all_cta: merchant.view_all_cta,
                // view_all_threshold: merchant.view_all_threshold,
                // merchant_products_type: merchant.merchant_products_type,
                // ttoclid: subProduct.ttoclid,
                // track_info: subProduct.track_info,
                // product_marketing_price_track_info: subProduct.product_marketing_price_track_info,
                // price_fallback_msg: subProduct.price_fallback_msg,
                // compliance_theme: subProduct.compliance_theme,
                // is_close_loop: subProduct.is_close_loop,
                // first_category: subProduct.first_category,
                // product_type: subProduct.product_type,
                // cta: subProduct.cta,
              };
            }) ?? [];
          }) ?? []

        };
      } else {
        return {
          platform_name: merchant.merchant_name,
          rank: i + 1,
          product_list: merchant.products?.map((product: any) => {
            const subTag = product.product_sub_tag || '';
            const roomSize = extractRoomSize(subTag);
            const maxOccupancy = extractMaxOccupancy(subTag);
            const tags = product.sku_tags?.map((tag: any) => tag.tag_content.toLowerCase()) ?? [];
            const is_breakfast = !tags.some((t: any) => t.includes("tidak termasuk sarapan") || t.includes("breakfast not included"));
            const refundable = !tags.some((t: any) => t.includes("tidak ada pembatalan") || t.includes("no cancellation"));

            // Parse marketing_price_ext for additional promotion details
            let marketingExt = null;
            if (product.marketing_price_ext) {
              try {
                marketingExt = typeof product.marketing_price_ext === 'string'
                  ? JSON.parse(product.marketing_price_ext)
                  : product.marketing_price_ext;
              } catch (e) {
                console.error('Failed to parse marketing_price_ext:', e);
              }
            }

            return {
              room_name: product.product_name,
              final_price: product.price_information?.offer_price_num,
              currency: getCurrencyByCountry(input.country) || "",
              original_fare: product.original_price ?? product.price_information?.offer_price_num,
              discount_percent: product.discount_num != null ? product.discount_num * 100 : null,
              discount_detail: product.product_marketing_info?.highlight_tag?.content ?? null,
              rate_type: null,
              is_breakfast: is_breakfast,
              refundable: refundable,
              room_image: product.raw_product_image_list?.[0]?.url_list?.[0],
              room_size: roomSize,
              room_size_unit: roomSize ? "sqm" : null,
              max_occupancy: maxOccupancy,
              product_id: product.product_id ?? null,
              // Other optional fields from updated data structure (uncomment if needed)
              // click_url: product.click_url,
              // click_url: product.click_url,
              // marketing_price_ext: marketingExt,
              // promotion_info: merchant.promotion_info,
              // disclaimer_info: merchant.disclaimer_info,
              // merchant_id: merchant.merchant_id,
              // shop_url: merchant.shop_url,
              // cta_text: merchant.cta_text,
              // expand_cta: merchant.expand_cta,
              // fold_cta: merchant.fold_cta,
              // view_all_cta: merchant.view_all_cta,
              // view_all_threshold: merchant.view_all_threshold,
              // merchant_products_type: merchant.merchant_products_type,
              // ttoclid: product.ttoclid,
              // track_info: product.track_info,
              // product_marketing_price_track_info: product.product_marketing_price_track_info,
              // price_fallback_msg: product.price_fallback_msg,
              // compliance_theme: product.compliance_theme,
              // is_close_loop: product.is_close_loop,
              // first_category: product.first_category,
              // product_type: product.product_type,
              // cta: product.cta,
            };
          }) ?? []
        }
      }
    }) ?? []
  };

  spec.specs.currency = getCurrencyByCountry(input.country) || "";

  const allRoomsEmpty = spec.rooms.every((room: any) =>
    !room.product_list || room.product_list.length === 0
  );

  if (allRoomsEmpty) {
    console.debug("All rooms are empty", input.poi_id);
    if (input.cookie_id) {
      const emptyRoomEndpoint = `${serverConfig.apiUrl}/cookie-empty-room/${input.cookie_id}`;
      const emptyRoomHeaders = {
        'x-api-key': serverConfig.apiKey,
        'Content-Type': 'application/json'
      };
      axios.post(emptyRoomEndpoint, { action: "EMPTY" }, {
        headers: emptyRoomHeaders,
      }).catch((callbackErr) => {
        console.log("Failed to update empty room action:", callbackErr);
      });
    }
    return {
      specs: spec.specs,
      hotel_detail: spec.hotel_detail,
      rooms: []
    };
  }

  return spec
}

function formatEmptyResponse(nodes: any, input: URLsRequestTiktok) {
  const rawStar = nodes.poi_head_info?.data?.poi_detail_top_tags?.[0]?.tag_content?.common_text ?? "";
  const match = rawStar.match(/^(\d)|(\d)(?=\s*$)/);
  const star_rating = match ? parseFloat(`${match[1] || match[2]}.0`) : null;

  const scrape_time = getWIBTime();

  const spec = {
    specs: {
      hotel_id: input.poi_id,
      country: input.country,
      language: input.language,
      check_in: input.check_in,
      check_out: input.check_out,
      adults: input.adults,
      currency: "",
      scraped_at: scrape_time,
      target_site: "tiktok.com",
    },
    hotel_detail: {
      hotel_name: nodes.poi_head_info?.data?.poi_name ?? nodes.poi_navigation_bar?.data?.poi_name ?? "",
      star_rating: star_rating,
      address: nodes.poi_head_info?.data?.formatted_address ?? nodes.travel_head_info?.data?.formatted_address ?? "",
      lat: nodes.poi_head_info?.data?.location?.lat ?? null,
      long: nodes.poi_head_info?.data?.location?.lng ?? null,
      review_score: nodes.poi_head_info?.data?.poi_review_summary?.score ?? null,
      review_count: nodes.poi_head_info?.data?.poi_review_summary?.total_count ?? nodes.travel_head_info?.data?.poi_review_summary?.total_count ?? null,
      pic_url: nodes.category_background_album?.data?.picture_album?.pictures?.[0]?.url_list?.[0] ?? nodes.travel_head_info?.data?.picture_album?.pictures?.[0]?.url_list?.[0] ?? "",
    },
    rooms: []
  };

  spec.specs.currency = getCurrencyByCountry(input.country) || "";
  return spec
}

function sanitizeCookie(cookie: string): string {
  return cookie
    // hapus newline & carriage return
    .replace(/[\r\n]+/g, ' ')
    // hapus control chars
    .replace(/[\x00-\x1F\x7F]/g, '')
    // rapikan spasi
    .replace(/\s{2,}/g, ' ')
    // hapus ; ganda
    .replace(/;\s*;/g, ';')
    // trim
    .trim();
}


async function fetchTiktokAccomodation(
  poi_id: string,
  input: URLsRequestTiktok,
  providedCookie = "",
  retry = 1,
) {
  // providedCookie = "delay_guest_mode_vid=5;tt-target-idc-sign=H7g3AW2ErKkdqGv9blv_xAu6WcRDsl0dQPRsuzZmvSrGSqQgcpbRB3N_-tNXwcdfl1hQi6DQ0os5ezsIonyUdU819_SVAQMehUIIcisuqw3GSfB7IgXyo5MZ3R8Wc8C6l5qmjLclm6GIoZEXwS5o94c5ZGLhKh-baUOREndlt1S1jjzQGmEJMe_RzyJAodFySVZOPOXeuLQU6fTLLxR90uV4TmPho_1HISocXapwhPd1tU6uf1bWHhbDz97oA7ePZAXPwQjVXSJtXzg2DM3BtQN-Fa8mhxIFjUytJsps4ILbDHdP6nR9kuVhjx6d0ie1qU0FsKVYlR_U51E3ZdqX7AaYHZUMpO2tkqRY_viJlEuR9d0gHI5_0HYG2-AgAj9-MGTNHIAITVMq0vkMdtHYIB6yniw3L9Ajvn3NTbMH1w9eudpdBtXqR0MT0Zrq-oA9oHLc8mCDsFvHrOgp4ClbY0XhYHFSwNvDP6vL6seS19ETgVxLjWJu3HDJfQ7zQFbt;msToken=geJQYigW8HBv4twrfyDZryKwV-hmZ4udxJ8_yEbvlnmHEMPyDdLitWxx-MXHY47FdqIjbvSrD8GYC0sODj3QMRggiZU6h51y4ckUCQEmW-wX1ory2qPMzKurx-_C1LmxeZe_tIo-VULaow==;tt_session_tlb_tag=sttt%7C4%7CU0ayDIJ8MHWFDtyBE5k8JP_________f1XxgEmLpE3urdWpqMwSTJ0Te0lLNu7-_r-a1HX7BRFk%3D;sid_guard=5346b20c827c3075850edc8113993c24%7C1777020120%7C15552000%7CWed%2C+21-Oct-2026+08%3A42%3A00+GMT;ttwid=1%7CXX7Xu-8LGWcdN0IjcPIrUuNDLmdlsRFkJe8QiYL1OFQ%7C1777020133%7C228044cf277dc68cc7becc59d44611e7b254f806cc35c820c13ec8e24fff316e;tt_ticket_guard_has_set_public_key=1;store-country-code-src=uid;perf_feed_cache={%22expireTimestamp%22:1777622400000%2C%22itemIds%22:[%227625683061396688135%22%2C%227617326340156427538%22%2C%227626314683028638997%22]};uid_tt=8c46b975d884bafd39fb29e0f12f43675d327df6ea479cd79a7593ae1cecf49c;store-country-sign=MEIEDMR5vzEJtfQ1SlLUogQgQUgRHrXG2VUTFr9GDs3ebr1pjJ2xovXdxo9Og-lId2gEENK7p9431S--1s21VdFayas;msToken=geJQYigW8HBv4twrfyDZryKwV-hmZ4udxJ8_yEbvlnmHEMPyDdLitWxx-MXHY47FdqIjbvSrD8GYC0sODj3QMRggiZU6h51y4ckUCQEmW-wX1ory2qPMzKurx-_C1LmxeZe_tIo-VULaow==;s_v_web_id=verify_mocnwbmq_wCeOl7Zj_DsLg_4MMq_Bhjw_ziVEVfnV79KK;store-idc=alisg;ssid_ucp_v1=1.0.1-KDYyNTY1ZTBhMGQ3OWEzODBkNDQ5OWQ0Mzc2NjBiMTdkMjYwZTJhNjEKIQiViNmky7nF82kQ2NmszwYYswsgDDDgq5zPBjgIQBJIBBADGgNzZzEiIDUzNDZiMjBjODI3YzMwNzU4NTBlZGM4MTEzOTkzYzI0Mk4KIEIjiVuBd8ab-hRcUmfkub_Hfi0KDD2FKlpY8Ke-6ZS2EiAIIzBnZDW-sOz8-WHHbLtt-bGHTC7LGUEL0MFgAbgpzxgBIgZ0aWt0b2s;tiktok_webapp_theme=light;_waftokenid=eyJ2Ijp7ImEiOiJSb2t3ZTRlYVdrZzBIWUpWdmYzKzU2U1BLM2hWN3RMWmd2TlpoTDZTTFdzPSIsImIiOjE3NzcwMjAxMjUsImMiOiJFVEhreExFNTUxa1JQbnQ2bURYdXcvZUNxVnNseXMwZWhnaVpqTjNvemZZPSJ9LCJzIjoidFlXeHgxeU55b0JiNUtFNG9kTlhUa1FVLy95UzRTRkRsYStvOTFiVnJ6OD0ifQ;cmpl_token=AgQYAPOg_hfkTtK52ftrPKSdLPOKspMy0P-FK2Cgc54;last_login_method=google;multi_sids=7631092062549853205%3A5346b20c827c3075850edc8113993c24;odin_tt=488115f9cdc9e9dbb65642be0da46687b29fa9508c3a67e4379b7f42b4cdb30f043116002cebcaf2405c22ee950766c5d1d5f4279c6ac4b539a0321fbd4ba32bc76f4787dae0bb7e36a090d6688b6e3f;passport_auth_status=7c2915e975d71b9c859fa29a9588ed81%2C;passport_auth_status_ss=7c2915e975d71b9c859fa29a9588ed81%2C;passport_fe_beating_status=true;sessionid=5346b20c827c3075850edc8113993c24;sessionid_ss=5346b20c827c3075850edc8113993c24;sid_tt=5346b20c827c3075850edc8113993c24;sid_ucp_v1=1.0.1-KDYyNTY1ZTBhMGQ3OWEzODBkNDQ5OWQ0Mzc2NjBiMTdkMjYwZTJhNjEKIQiViNmky7nF82kQ2NmszwYYswsgDDDgq5zPBjgIQBJIBBADGgNzZzEiIDUzNDZiMjBjODI3YzMwNzU4NTBlZGM4MTEzOTkzYzI0Mk4KIEIjiVuBd8ab-hRcUmfkub_Hfi0KDD2FKlpY8Ke-6ZS2EiAIIzBnZDW-sOz8-WHHbLtt-bGHTC7LGUEL0MFgAbgpzxgBIgZ0aWt0b2s;store-country-code=id;tiktok_webapp_theme_source=auto;tt-target-idc=alisg;tt_chain_token=Hul6opMBDQNT8LKv3+6wZg==;tt_csrf_token=stl3nqsb-SU1EDACbS8Rg6s_SPmbmnzqchyc;uid_tt_ss=8c46b975d884bafd39fb29e0f12f43675d327df6ea479cd79a7593ae1cecf49c;x-web-secsdk-uid=5cb07f4d-d73f-4876-8f41-c9b1e6d5a02b";
  console.debug("Fetch tiktok shop", { poi_id });
  let responseCookie = {
    data: {
      success: true,
      cookie: providedCookie,
      id: 1,
    },
  };
  if (!providedCookie) {
    responseCookie = await axios.get(serverConfig.apiUrl + "/get-tiktok-cookie?platform=TIKTOK_DESTINATION", {
      headers: {
        "x-api-key": serverConfig.apiKey
      }
    })
  }

  if (!responseCookie?.data?.success || responseCookie?.data?.success !== true || !responseCookie?.data?.cookie || responseCookie?.data?.cookie === "") {
    throw new TiktokError(
      `Tiktok api error: Blocked`,
      poi_id,
      "FAILED",
      JSON.stringify(responseCookie?.data ?? {}),
      "api-sr",
    );
  }

  const idCookie = responseCookie?.data?.id
  let cookie = responseCookie?.data?.cookie

  if (input.country) {
    cookie = replaceCountryCode(cookie, input.country)
  }

  const proxy = weightedProxies[Math.floor(Math.random() * weightedProxies.length)];
  let proxyUrl = `${proxy.hostname.includes("https") ? "https" : "http"}://${proxy.username}:${proxy.password}@${proxy.hostname.replace("https", "").replace("http", "")}:${proxy.port}`;

  if (serverConfig.proxyUrl) {
    proxyUrl = serverConfig.proxyUrl;
  }

  const httpProxyAgent = new HttpProxyAgent(proxyUrl, { keepAlive: false });
  const httpsProxyAgent = new HttpsProxyAgent(proxyUrl, { keepAlive: false });

  // const baseUrl = "https://api31-normal-alisg.tiktokv.com/tiktok/poi/slash/v1";
  const baseUrl = "https://api22-normal-c-alisg.tiktokv.com/tiktok/poi/slash/v1";

  // https://api22-normal-c-alisg.tiktokv.com/tiktok/poi/slash/v1?scene=poi&slash_param=%7B%22is_chunk%22%3Atrue%2C%22is_event%22%3Afalse%7D&service_type=main&poi_id=21568226298638185&enter_from=deeplink&poi_review_scene=6&poi_review_count=20&poi_review_cursor=0&region_discovery_scene=5&region_discovery_sub_scene=7&poi_video_list_cursor=0&poi_merged_list_count=9&has_more_aweme=1&has_more_review=1&privacy_auth_status_query_required=true&poi_ymal_count=12&poi_ymal_cursor=0&client_map_usable=true&nearby_scene=8&poi_count=12&device_platform=android&os=android&ssmix=a&_rticket=1776949008938&cdid=16f021ac-44d7-4b7d-a059-852f3f538286&channel=samsung_preload&aid=1180&app_name=trill&version_code=400000&version_name=40.0.0&manifest_version_code=400000&update_version_code=400000&ab_version=40.0.0&resolution=720*1467&dpi=300&device_type=SM-A065F&device_brand=samsung&language=id&os_api=34&os_version=14&ac=wifi&is_pad=0&current_region=ID&app_type=normal&sys_region=ID&last_install_time=1729065742&timezone_name=Asia%2FJakarta&carrier_region_v2=510&residence=ID&app_language=id&carrier_region=ID&timezone_offset=25200&host_abi=arm64-v8a&locale=id-ID&ac2=wifi&uoo=1&op_region=ID&build_number=40.0.0&region=ID&ts=1776949008&iid=7631902788183934736&device_id=7631900606294181393&openudid=b59ccedd24f38dc7
  const params = {
    "poi_id": poi_id,
    // "slash_param": "%7B%22is_chunk%22%3Atrue%2C%22is_event%22%3Afalse%7D",
    "device_id": generateDeviceIdWithPrefix7(),
    "check_in_timestamp": convertToTimestamp(input.check_in, "check_in", input.country),
    "adult_num": input.adults,
    "check_out_timestamp": convertToTimestamp(input.check_out, "check_out", input.country),
    "check_in_date_str": input.check_in,
    "check_out_date_str": input.check_out,
    "scene": "poi",
    "service_type": "main",
    "enter_from": "search_places",
    "poi_review_scene": "6",                    // Optional - review related
    "poi_review_count": "20",                   // Optional - review related
    "poi_review_cursor": "0",                   // Optional - review related
    "region_discovery_scene": "5",              // Optional - discovery related
    "region_discovery_sub_scene": "7",          // Optional - discovery related
    "poi_video_list_cursor": "0",              // Optional - video related
    "poi_merged_list_count": "9",              // Optional - list related
    "has_more_aweme": "1",                      // Optional - content related
    "has_more_review": "1",                     // Optional - review related
    "privacy_auth_status_query_required": "true", // Optional - privacy related
    "poi_ymal_count": "12",                     // Optional - YMAL related
    "poi_ymal_cursor": "0",                     // Optional - YMAL related
    "client_map_usable": "true",                // Optional - map related
    "nearby_scene": "8",                        // Optional - nearby related
    "poi_count": "12",                          // Optional - count related
    "device_platform": "android",
    "os": "android",
    "ssmix": "a",
    "_rticket": "1755663336316",
    "channel": "googleplay",
    "aid": "1233",
    "app_name": "musical_ly",
    "version_code": "400603",
    "version_name": "40.6.3",
    // "manifest_version_code": "2024006030",      // Optional - version info
    // "update_version_code": "2024006030",        // Optional - version info
    // "ab_version": "40.6.3",                     // Optional - A/B testing version
    "resolution": "1080*2118",
    "dpi": "440",
    "device_type": "MI 8",
    "device_brand": "Xiaomi",
    "language": input.language,
    "os_api": "27",
    "os_version": "8.1.0",
    "ac": "wifi",
    "is_pad": "0",
    "current_region": input.country.toUpperCase(),
    "app_type": "normal",
    "sys_region": input.country.toUpperCase(),
    "last_install_time": "1755661894",          // Optional - device info
    "timezone_name": "Asia/Jakarta",
    "carrier_region_v2": "510",                 // Optional - carrier info
    "residence": input.country.toUpperCase(),
    "app_language": input.language,
    "carrier_region": input.country.toUpperCase(),
    "timezone_offset": "-18000",                // Optional - timezone
    "host_abi": "arm64-v8a",                    // Optional - device architecture
    "locale": input.language,
    "ac2": "wifi",
    "uoo": "0",
    "op_region": input.country.toUpperCase(),
    "build_number": "40.6.3",
    "region": input.country.toUpperCase(),
    // "ts": "1755663335",
    // "iid": "7540510351111620360",
  };

  params["app_language"] = input.language

  const stringParams = Object.entries(params).reduce((acc, [key, val]) => {
    acc[key] = String(val);
    return acc;
  }, {} as Record<string, string>);

  const queryString = new URLSearchParams(stringParams).toString();
  const url = `${baseUrl}?${queryString}`;

  // console.log("COOKIE: ", idCookie)

  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: url,
    headers: {
      "User-Agent": "com.zhiliaoapp.musically/2024006030 (Linux; U; Android 8.1.0; en; MI 8; Build/OPM1.171019.011; Cronet/TTNetVersion:cdd6bd4b 2025-06-09 QuicVersion:52c2b40d 2025-04-03)",
      "Connection": "keep-alive",
      "Accept": "*/*",
      "Accept-Encoding": "gzip, deflate, br",
      "Cookie": sanitizeCookie(cookie)
    }
  };

  const response = await axios.get(config.url, {
    headers: config.headers,
    httpAgent: httpProxyAgent,
    httpsAgent: httpsProxyAgent,
  })

  // fs.writeFileSync("response.json", JSON.stringify(response.data, null, 2));
  if (response?.data?.status_msg?.toLowerCase().includes("suspended")) {
    axios.post(serverConfig.apiUrl + "/update-tiktok-cookie", {
      id: idCookie,
      status: "BLOCKED",
    }, {
      headers: {
        "x-api-key": serverConfig.apiKey
      }
    });
    throw new TiktokError(
      `Tiktok api error: Blocked`,
      poi_id,
      "FAILED",
      response?.data,
      "api-sr",
    );
  }

  const nodes = response?.data?.nodes;
  const product = nodes.dynamic_calendar_room_product_shelf_lynx ?? nodes.multi_merchant_product_shelf_lynx;
  const emptyRoomEndpoint = `${serverConfig.apiUrl}/cookie-empty-room/${idCookie}`;
  const emptyRoomHeaders = {
    'x-api-key': serverConfig.apiKey,
    'Content-Type': 'application/json'
  };

  if (!product) {
    if (nodes) {
      const message = `Product is empty ${poi_id} with ${idCookie}`;
      console.log("Error Product: ", message);

      try {
        await axios.post(emptyRoomEndpoint, { action: "EMPTY" }, {
          headers: emptyRoomHeaders,
        });
      } catch (callbackErr) {
        console.log("Failed to update empty room action:", callbackErr);
      }

      if (retry < 3) {
        // Pastikan retry benar-benar mengembalikan hasil retry, bukan nodes kosong dari percobaan awal.
        await delay(400 * retry);
        return await fetchTiktokAccomodation(poi_id, input, cookie, retry + 1);
      }

      throw new TiktokError("Product is empty", poi_id, "ERROR");
    }
    throw new TiktokError("Product is empty", poi_id, "ERROR");
  }

  try {
    const businessData = product.data.business_data;

    const json = JSON.parse(businessData);

    if (nodes?.dynamic_calendar_room_product_shelf_lynx?.data) {
      nodes.multi_merchant_product_shelf_lynx = nodes.dynamic_calendar_room_product_shelf_lynx;
      delete nodes.dynamic_calendar_room_product_shelf_lynx;
    }

    if (nodes?.multi_merchant_product_shelf_lynx?.data) {
      nodes.multi_merchant_product_shelf_lynx.data.business_data = json;
    }
    try {
      axios.post(emptyRoomEndpoint, { action: "HAS_ROOM" }, {
        headers: emptyRoomHeaders,
      });
    } catch (callbackErr) {
      console.log("Failed to update empty room action:", callbackErr);
    }

    axios.post(serverConfig.apiUrl + "/update-tiktok-cookie", {
      id: idCookie,
      status: "SUCCESS",
    }, {
      headers: {
        "x-api-key": serverConfig.apiKey
      }
    });

    return { result: nodes, message: null };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new TiktokError(
        `Tiktok api request failed`,
        poi_id,
        "FAILED",
        err.response?.data || err.message,
        "api-sr",
      );
    }
    console.log("ERROR: " + err)
    throw new TiktokError(
      `internal error`,
      poi_id,
      "ERROR",
      "Internal server error",
      "api-sr",
    );
  }
}

async function fetchFromSandro(
  url: string,
): Promise<ShopeeApiResponse<GetPcData>> {
  const { shopId, itemId } = getShopeeParams(url);
  console.debug("Fetching from Sandro API", { url, shopId, itemId });
  try {
    const { data } = await axios.get(
      "http://147.139.201.186:5000/api/shopeeProduct/detail",
      {
        params: { shop_id: shopId, item_id: itemId, version_code: 1 },
        headers: {
          auth: "d1ff3266-bc0e-4962-853e-41ecd82ee355",
        },
        timeout: 15 * 60 * 1000,
      },
    );

    const { status, data: payload, message } = data;
    if (status === "ok") {
      return { bff_meta: null, error: null, error_msg: null, data: payload };
    }
    throw new TiktokError(
      `Shopee api error: ${message}`,
      url,
      "FAILED",
      data,
      "api-sr",
    );
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new TiktokError(
        `Shopee api request failed`,
        url,
        "FAILED",
        err.response?.data || err.message,
        "api-sr",
      );
    }
    throw new TiktokError(
      `internal error`,
      url,
      "ERROR",
      (err as Error).message,
      "api-sr",
    );
  }
}
// Third-party scraper helper for non-ID regions
async function fetchFromThirdParty(
  url: string,
): Promise<ShopeeApiResponse<GetPcData>> {
  const mode =
    scraperConfig.thirdParty.thirdPartyOpt || "CORRECTED_WITH_VARIATIONS";
  try {
    let res: ApiResponse = await axios
      .post(
        scraperConfig.thirdParty.thirdPartyApi,
        { requests: [{ url }], productDetail_mode: mode },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + scraperConfig.thirdParty.thirdPartyToken,
          },
          timeout: 15 * 60 * 1000,
        },
      )
      .then((r) => (Array.isArray(r.data) ? r.data[0] : r.data));

    if (res.status === "SUCCESS") {
      try {
        const data: ShopeeApiResponse<GetPcData> = JSON.parse(res.responseBody);
        if (data.data?.item) {
          try {
            processPriceShown(data.data);
          } catch (err) {
            console.error("Error processing price shown", err);
            process.exit(1);
          }
        } else {
          console.warn("No item found in response", data);
          // fs.writeFileSync("marcNoItemFound.json", JSON.stringify(data));
        }
        delete (data as any).diagnostic_info;
        return data;
      } catch (err) {
        console.debug(
          "thirdParty:parse Unable to parse response body",
          res.responseBody,
        );
        throw new Error("Unable to parse response body");
      }
    }

    // handle specific error statuses
    switch (res.status) {
      case "BLOCKED_TOO_MANY_TIMES":
        console.debug("thirdParty:blocked", res);
        throw new TiktokError(
          "Blocked too many times, should be retried",
          url,
          res.status,
          res.responseBody,
          "api-m",
        );
      case "CANCELLED":
        console.error("Error Response:", res.responseBody);
        throw new TiktokError(
          "Scraping failed",
          url,
          res.status,
          res.responseBody,
          "api-m",
        );
      default:
        console.debug("thirdParty:error", res);
        console.error("Error in response", res);
        throw new TiktokError(
          `Error while scraping ${url}`,
          url,
          res.status,
          res.responseBody,
          "api-m",
        );
    }
  } catch (err: any) {
    // fallback on network or Axios errors
    if (err.response?.data) {
      const res: ApiResponse = err.response.data;
      // handle specific error statuses
      switch (res.status) {
        case "BLOCKED_TOO_MANY_TIMES":
          console.debug("thirdParty:blocked", res);
          throw new TiktokError(
            "Blocked too many times, should be retried",
            url,
            res.status,
            res.responseBody,
            "api-m",
          );
        case "CANCELLED":
          console.error("Error Response:", res.responseBody);
          throw new TiktokError(
            "Scraping failed",
            url,
            res.status,
            res.responseBody,
            "api-m",
          );
        default:
          console.debug("thirdParty:error", res);
          console.error("Error in response", res);
          throw new TiktokError(
            `Error while scraping ${url}`,
            url,
            res.status,
            res.responseBody,
            "api-m",
          );
      }
    }
    console.error("Unhandled Error", err);
    throw new TiktokError(err.message, url, "ERROR", undefined, "api-m");
  }
}
async function fetchListFromThirdParty(
  domain: string,
  shopItemIds: ShopItemId[],
): Promise<ShopeeApiResponse<GetListData>> {
  try {
    let res: ApiResponse = await axios
      .post(
        scraperConfig.thirdParty.thirdPartyApi,
        {
          requests: [
            {
              url: `https://${domain}/api/v4/item/get_list`,
              method: "POST",
              payload: {
                source: "microsite_individual_product",
                shop_item_ids: shopItemIds,
              },
            },
          ],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + scraperConfig.thirdParty.thirdPartyToken,
          },
          timeout: 15 * 60 * 1000,
        },
      )
      .then((r) => (Array.isArray(r.data) ? r.data[0] : r.data));

    if (res.status === "SUCCESS") {
      try {
        const data: ShopeeApiResponse<GetListData> = JSON.parse(
          res.responseBody,
        );
        return data;
      } catch (err) {
        console.debug(
          "thirdParty:parse Unable to parse response body",
          res.responseBody,
        );
        throw new Error("Unable to parse response body");
      }
    }

    // handle specific error statuses
    switch (res.status) {
      case "BLOCKED_TOO_MANY_TIMES":
        console.debug("thirdParty:blocked", res);
        throw new TiktokError(
          "Blocked too many times, should be retried",
          JSON.stringify(shopItemIds),
          res.status,
          res.responseBody,
          "api-m",
        );
      case "CANCELLED":
        console.error("Error Response:", res.responseBody);
        throw new TiktokError(
          "Scraping failed",
          JSON.stringify(shopItemIds),
          res.status,
          res.responseBody,
          "api-m",
        );
      default:
        console.debug("thirdParty:error", res);
        console.error("Error in response", res);
        throw new TiktokError(
          `Error while scraping ${JSON.stringify(shopItemIds)}`,
          JSON.stringify(shopItemIds),
          res.status,
          res.responseBody,
          "api-m",
        );
    }
  } catch (err: any) {
    // fallback on network or Axios errors
    if (err.response?.data) {
      const res: ApiResponse = err.response.data;
      // handle specific error statuses
      switch (res.status) {
        case "BLOCKED_TOO_MANY_TIMES":
          console.debug("thirdParty:blocked", res);
          throw new TiktokError(
            "Blocked too many times, should be retried",
            JSON.stringify(shopItemIds),
            res.status,
            res.responseBody,
            "api-m",
          );
        case "CANCELLED":
          console.error("Error Response:", res.responseBody);
          throw new TiktokError(
            "Scraping failed",
            JSON.stringify(shopItemIds),
            res.status,
            res.responseBody,
            "api-m",
          );
        default:
          console.debug("thirdParty:error", res);
          console.error("Error in response", res);
          throw new TiktokError(
            `Error while scraping ${JSON.stringify(shopItemIds)}`,
            JSON.stringify(shopItemIds),
            res.status,
            res.responseBody,
            "api-m",
          );
      }
    }
    console.error("Unhandled Error", err);
    throw new TiktokError(
      err.message,
      JSON.stringify(shopItemIds),
      "ERROR",
      undefined,
      "api-m",
    );
  }
}
async function fetchShopProductFromThirdParty(
  domain: string,
  shopId: number,
  productPerPage: number = 30,
  getNextPage: boolean = true,
  maxPages: number = 3,
  maxResults: number = 150,
): Promise<ShopeeSpResponse> {
  try {
    let res: ApiResponse = await axios
      .post(
        scraperConfig.thirdParty.thirdPartyApi,
        {
          requests: [
            {
              url: `https://${domain}/api/v4/shop/rcmd_items?shop_id=${shopId}`,
            },
          ],
          // Set the product "limit" URL parameter to 30
          shopProducts_enrichUrlQuery_pageSize: productPerPage,
          // Automatically crawl the next product pages
          shopProducts_crawlNextPages: getNextPage,
          // Crawl until the 3rd product page
          shopProducts_crawlNextPages_maxPages: maxPages,
          // Alternatively, indicate the maximum number of products to crawl
          shopProducts_crawlNextPages_maxResults: maxResults,
          // Automatically crawl product details
          shopProducts_crawlProductDetails: false,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + scraperConfig.thirdParty.thirdPartyToken,
          },
          timeout: 15 * 60 * 1000,
        },
      )
      .then((r) => (Array.isArray(r.data) ? r.data[0] : r.data));

    if (res.status === "SUCCESS") {
      try {
        const data: ShopeeSpResponse = JSON.parse(res.responseBody);
        return data;
      } catch (err) {
        console.debug(
          "thirdParty:parse Unable to parse response body",
          res.responseBody,
        );
        throw new Error("Unable to parse response body");
      }
    }

    // handle specific error statuses
    switch (res.status) {
      case "BLOCKED_TOO_MANY_TIMES":
        console.debug("thirdParty:blocked", res);
        throw new TiktokError(
          "Blocked too many times, should be retried",
          JSON.stringify({
            shopId,
            maxPages,
            maxResults,
            getNextPage,
            productPerPage,
          }),
          res.status,
          res.responseBody,
          "api-sp-m",
        );
      case "CANCELLED":
        console.error("Error Response:", res.responseBody);
        throw new TiktokError(
          "Scraping failed",
          JSON.stringify({
            shopId,
            maxPages,
            maxResults,
            getNextPage,
            productPerPage,
          }),
          res.status,
          res.responseBody,
          "api-sp-m",
        );
      default:
        console.debug("thirdParty:error", res);
        console.error("Error in response", res);
        throw new TiktokError(
          `Error while scraping ${JSON.stringify(shopId)}`,
          JSON.stringify({
            shopId,
            maxPages,
            maxResults,
            getNextPage,
            productPerPage,
          }),
          res.status,
          res.responseBody,
          "api-sp-m",
        );
    }
  } catch (err: any) {
    // fallback on network or Axios errors
    if (err.response?.data) {
      const res: ApiResponse = err.response.data;
      // handle specific error statuses
      switch (res.status) {
        case "BLOCKED_TOO_MANY_TIMES":
          console.debug("thirdParty:blocked", res);
          throw new TiktokError(
            "Blocked too many times, should be retried",
            JSON.stringify({
              shopId,
              maxPages,
              maxResults,
              getNextPage,
              productPerPage,
            }),
            res.status,
            res.responseBody,
            "api-sp-m",
          );
        case "CANCELLED":
          console.error("Error Response:", res.responseBody);
          throw new TiktokError(
            "Scraping failed",
            JSON.stringify({
              shopId,
              maxPages,
              maxResults,
              getNextPage,
              productPerPage,
            }),
            res.status,
            res.responseBody,
            "api-sp-m",
          );
        default:
          console.debug("thirdParty:error", res);
          console.error("Error in response", res);
          throw new TiktokError(
            `Error while scraping ${JSON.stringify({ shopId, maxPages, maxResults, getNextPage, productPerPage })}`,
            JSON.stringify({
              shopId,
              maxPages,
              maxResults,
              getNextPage,
              productPerPage,
            }),
            res.status,
            res.responseBody,
            "api-sp-m",
          );
      }
    }
    console.error("Unhandled Error", err);
    throw new TiktokError(
      err.message,
      JSON.stringify({
        shopId,
        maxPages,
        maxResults,
        getNextPage,
        productPerPage,
      }),
      "ERROR",
      undefined,
      "api-m",
    );
  }
}

async function fetchFromZetsu<T>(endpoint: string, url: string): Promise<T> {
  try {
    let res: MrScraperResponse<T> = await axios
      .post(
        "http://35.166.139.44:3000/scrape" + endpoint,
        {
          msg: {
            data: {
              url,
            },
          },
        },
        {
          headers: {
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzbHVnIjoicGVuYXRlYW0iLCJpYXQiOjE3MzE4MTMxODksImV4cCI6MTc2MzM0OTE4OX0.0RnB7I1swrchV2RX3vALE-kagCKhE0yp4TApMICkegY",
            "Content-Type": "application/json",
          },
          timeout: 15 * 60 * 1000,
        },
      )
      .then((r) => r.data);

    if (res.success) {
      const data: T = res.data;
      return data;
    } else {
      console.log(`[ERROR] Zetsu API Error:`, res, url);
      throw new TiktokError(
        res.message,
        url,
        "ERROR",
        JSON.stringify(res),
        "api-z",
      );
    }
  } catch (err: any) {
    // fallback on network or Axios errors
    if (err instanceof AxiosError) {
      // handle specific error statuses
      switch (err.status) {
        case 500:
          console.debug("zetsu:internal_server_error", err);
          throw new TiktokError(
            "Zetsu Failed to scrape, should be retried",
            url,
            "ERROR",
            err.response?.data,
            "api-z",
          );
        default:
          console.debug("zetsu:error", err);
          console.error("Error in response", err.response);
          throw new TiktokError(
            `Error while scraping ${url}`,
            url,
            "ERROR",
            JSON.stringify(err.response?.data),
            "api-z",
          );
      }
    }
    console.error("Unhandled Error", err);
    throw new TiktokError(err.message, url, "ERROR", undefined, "api-z");
  }
}

async function fetchFromApify(endpoint: string, params: TiktokShopSearchProductsRequest) {
  try {
    const baseUrl = `https://atiktok-shop-analysis.p.rapidapi.com${endpoint}`;
    const url = new URL(baseUrl)
    url.searchParams.set('keyword', params.keyword)
    url.searchParams.set('country_code', params.country_code || 'ID');
    url.searchParams.set('end_product_rating', params.end_product_rating.toString());
    url.searchParams.set('start_product_rating', params.start_product_rating.toString());
    url.searchParams.set('limit', params.limit || '10');
    url.searchParams.set('page', params.page || '1');
    url.searchParams.set('shop_key_word', params.shop_key_word);
    const response = await axios.get(
      url.toString(),
      {
        headers: {
          'x-rapidapi-host': 'tiktok-shop-analysis.p.rapidapi.com',
          'x-rapidapi-key': 'f2032f7e77msh3169540fc947a60p1e8ea6jsnc1225315f059'
        },
        timeout: 15 * 60 * 1000,
      },
    );

    if (response.data && response.data.msg === "success") {
      return response.data.data;
    } else {
      throw new TiktokError(
        `Apify actor failed with status: ${response.data.status}`,
        JSON.stringify(params),
        "ERROR",
        JSON.stringify(response.data),
        "api-ts-r",
      );
    }
  } catch (err) {
    console.error("Apify request error", err);
    throw new TiktokError(
      `Fetch request failed`,
      JSON.stringify(params),
      "ERROR",
      (err as Error).message,
      "api-ts-r",
    );
  }
}

// Worker handler
export const tiktokAccomodationWorker = async (
  args: TaskFunctionArguments<URLsRequestTiktok>,
) => {
  let {
    page,
    data: { poi_id, language, country, check_in, check_out, adults },
    type,
  } = args;

  const input: URLsRequestTiktok = { poi_id, language, country, check_in, check_out, adults, request_timestamp: Date.now().toString() }

  try {
    if (type === "api") {
      // const { hostname } = new URL(url);
      // const country = getCountryFromDomain(hostname);
      // console.debug("Country detected", { country, hostname });

      // ID country: use BFF endpoint
      if (+adults > 4) {
        adults = "4"
      }
      let { result, message } = await fetchTiktokAccomodation(poi_id, input)
      if (!result) throw new TiktokError("No data returned");
      // fs.writeFileSync("output_tiktok.json", JSON.stringify(result, null, 2))

      const formattedRes = formatResponse(result, input)
      const formattedResult = { request_timestamp: input.request_timestamp, ...formattedRes }

      if ('success' in formattedResult) {
        console.log("Tiktok accomodation rooms are empty", poi_id);
        return { result: formattedResult };
      }

      await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 20000)));
      return { result: formattedResult };
    }

    if (type === "scraper") {
      if (!page) {
        throw new TiktokError("Page required for scraper", poi_id, "ERROR");
      }
      // TO-DO: implement Puppeteer/CDP strategies via separate modules
      throw new Error("Scraper strategy not implemented on this worker");
    }

    throw new TiktokError(`Unknown worker type: ${type}`);
  } catch (err) {
    if (err instanceof TiktokError) {
      console.log("ERROR Tiktok")
      throw err
    }
    console.log("Tiktok Worker Error", err);
    throw new TiktokError("Internal server Error");
  }
};

function isTiktokRoomsEmpty(formatted: ReturnType<typeof formatResponse>): boolean {
  const rooms = formatted.rooms as { product_list?: unknown[] }[] | undefined;
  if (!Array.isArray(rooms) || rooms.length === 0) return true;
  return rooms.every(
    (room) => !room.product_list || room.product_list.length === 0,
  );
}

export const testCookieTiktokWorker = async (
  args: TaskFunctionArguments<TestCookieTiktokRequest>,
) => {
  const {
    data: { cookie },
  } = args;

  const poiId = "21568226298638185";
  const { check_in, check_out } = pickRandomTiktokStayDatesStressStyle();
  const input: URLsRequestTiktok = {
    poi_id: poiId,
    language: "id",
    country: "ID",
    check_in,
    check_out,
    adults: "2",
    request_timestamp: Date.now().toString(),
  };

  try {
    const { result: nodes } = await fetchTiktokAccomodation(poiId, input, cookie);
    if (!nodes) return "failed";
    const formatted = formatResponse(nodes, input);
    if (isTiktokRoomsEmpty(formatted)) return "failed";
    return "success";
  } catch (err) {
    if (err instanceof TiktokError) {
      console.log("ERROR Tiktok");
      throw err;
    }
    console.log("Tiktok Worker Error", err);
    throw new TiktokError("Internal server Error");
  }
};

export const shopeeWorker = async (
  args: TaskFunctionArguments<URLsRequest>,
) => {
  const {
    page,
    data: { url },
    type,
  } = args;

  try {
    if (type === "api") {
      const { hostname } = new URL(url);
      const country = getCountryFromDomain(hostname);
      console.debug("Country detected", { country, hostname });

      // ID country: use BFF endpoint
      const result =
        country === "ID"
          ? await fetchFromSandro(url)
          : await fetchFromThirdParty(url);

      if (!result) throw new Error("No data returned");

      return { result, ip: country === "ID" ? "api-sr" : "api-sl" };
    }

    if (type === "scraper") {
      if (!page) {
        throw new TiktokError("Page required for scraper", url, "ERROR");
      }
      // TO-DO: implement Puppeteer/CDP strategies via separate modules
      throw new Error("Scraper strategy not implemented on this worker");
    }

    throw new Error(`Unknown worker type: ${type}`);
  } catch (err: unknown) {
    console.error("Shopee Worker Error", err);
    throw err;
  }
};

export const shopeeListWorker = async (
  args: TaskFunctionArguments<ShopItemsRequest>,
) => {
  const { page, data, type } = args;
  console.debug(`Shopee List Worker`, data);

  try {
    if (type === "api") {
      const result = await fetchListFromThirdParty(
        data.domain,
        data.shopItemIds,
      );

      if (!result) throw new Error("No data returned");

      return { result, ip: "api-l-m" };
    }

    if (type === "scraper") {
      if (!page) {
        throw new TiktokError(
          "Page required for scraper",
          JSON.stringify(data),
          "ERROR",
        );
      }
      // TO-DO: implement Puppeteer/CDP strategies via separate modules
      throw new Error("Scraper strategy not implemented on this worker");
    }

    throw new Error(`Unknown worker type: ${type}`);
  } catch (err: unknown) {
    console.error("Shopee Worker Error", err);
    throw err;
  }
};

export const shopeeProductWorker = async (
  args: TaskFunctionArguments<ShopeeShopProductRequest>,
) => {
  const { page, data, type } = args;
  console.debug(`Shopee Shop Products Worker`, data);

  try {
    if (type === "api") {
      const result = await fetchShopProductFromThirdParty(
        data.domain,
        data.shop_id,
        data.products_per_page,
        data.get_next_page,
        data.max_page,
        data.max_results,
      );

      if (!result) throw new Error("No data returned");

      return { result, ip: "api-sp-m" };
    }

    if (type === "scraper") {
      if (!page) {
        throw new TiktokError(
          "Page required for scraper",
          JSON.stringify(data),
          "ERROR",
        );
      }
      // TO-DO: implement Puppeteer/CDP strategies via separate modules
      throw new Error("Scraper strategy not implemented on this worker");
    }

    throw new Error(`Unknown worker type: ${type}`);
  } catch (err: unknown) {
    console.error("Shopee Worker Error", err);
    throw err;
  }
};

export const shopeeSearchWorker = async (
  args: TaskFunctionArguments<URLsRequest>,
) => {
  const {
    page,
    data: { url },
    type,
  } = args;
  console.debug(`Shopee Search Worker`, url);

  try {
    if (type === "api") {
      const result = await fetchFromZetsu<ShopeeSearchItemsResponse>(
        "/search-items",
        url,
      );

      if (!result) throw new Error("No data returned");

      return { result: result, ip: "api-s-z" };
    }

    if (type === "scraper") {
      if (!page) {
        throw new TiktokError("Page required for scraper", url, "ERROR");
      }
      // TO-DO: implement Puppeteer/CDP strategies via separate modules
      throw new Error("Scraper strategy not implemented on this worker");
    }

    throw new Error(`Unknown worker type: ${type}`);
  } catch (err: unknown) {
    console.error("Shopee Worker Error", err);
    throw err;
  }
};

export const shopeeReviewsWorker = async (
  args: TaskFunctionArguments<URLsRequest>,
) => {
  const {
    page,
    data: { url },
    type,
  } = args;
  console.debug(`Shopee Search Worker`, url);

  try {
    if (type === "api") {
      const result = await fetchFromZetsu<ShopeeSearchItemsResponse>(
        "/reviews",
        url,
      );

      if (!result) throw new Error("No data returned");

      return { result: result, ip: "api-r-z" };
    }

    if (type === "scraper") {
      if (!page) {
        throw new TiktokError("Page required for scraper", url, "ERROR");
      }
      // TO-DO: implement Puppeteer/CDP strategies via separate modules
      throw new Error("Scraper strategy not implemented on this worker");
    }

    throw new Error(`Unknown worker type: ${type}`);
  } catch (err: unknown) {
    console.error("Shopee Worker Error", err);
    throw err;
  }
};

export const tiktokShopSearchProductsWorker = async (
  args: TaskFunctionArguments<TiktokShopSearchProductsRequest>,
) => {
  const {
    page,
    data,
    type,
  } = args;
  const {
    country_code,
    end_product_rating,
    keyword,
    limit,
    page: pageNumber,
    start_product_rating,
    shop_key_word,
  } = data
  console.debug(`Tiktok Shop Search Worker`, JSON.stringify(data));

  try {
    if (type === "api") {
      const result = await fetchFromApify(
        "/analysis",
        data,
      );

      if (!result) throw new Error("No data returned");

      return { result: result, ip: "api-ts-r" };
    }

    if (type === "scraper") {
      if (!page) {
        throw new TiktokError("Page required for scraper", JSON.stringify(data), "ERROR");
      }
      // TO-DO: implement Puppeteer/CDP strategies via separate modules
      throw new Error("Scraper strategy not implemented on this worker");
    }

    throw new Error(`Unknown worker type: ${type}`);
  } catch (err: unknown) {
    console.error("Tiktok Worker Error", err);
    throw err;
  }
}

export async function createCluster(retryLimit: number) {
  debug("Creating cluster");

  const concurrency = parseInt(scraperConfig.concurrency);
  const perBrowserOptions = [];

  for (let i = 0; i < concurrency; i++) {
    // const tmpDir = `/home/leight/Leight/MrScraper/scraper-mrscraper/tmp/mrscraper-${i}`;
    // if (!fs.existsSync(tmpDir)) {
    //   fs.mkdirSync(tmpDir, { recursive: true });
    // }
    const opt = {
      ...DEFAULT_OPTIONS,
      debuggingPort: 9222 + i,
      headless: false,
      executablePath: scraperConfig.chromePath,
      timeout: 0,
    };
    if (scraperConfig.isOnlyChrome == "false") {
      const executablePath =
        weightedBrowser[Math.floor(Math.random() * weightedBrowser.length)];
      console.log("Executable Path: ", executablePath);
      opt.executablePath = executablePath;
    }
    perBrowserOptions.push(opt);
  }
  const context = await MrScraperCluster.launch({
    puppeteer: puppeteerCore,
    concurrency: MrScraperCluster.CONCURRENCY_CDP,
    maxConcurrency: concurrency,
    puppeteerConnectOptions: {
      browserWSEndpoint: scraperConfig.browserWSEndpoint,
    },
    perBrowserOptions,
    retryLimit,
    // sameDomainDelay: 30000,
    restartFunction: async () => {
      return scraperConfig.browserWSEndpoint;
    },
    monitor: true,
    timeout: 900 * 1000, // 15 minutes
    autoClose: 60, // in seconds
    s3Bucket: "mrscraper-enterprise",
  });

  cluster = context;
}

export async function getBrowserInstance(event: ObjectAny) {
  let args = chromium.args;

  const proxyServer = event.proxy_server;
  args.push("--proxy-server=" + proxyServer);

  // const disabledArgs = ["--single-process", "--headless='shell'"];
  // args = args.filter((e) => !disabledArgs.includes(e));

  // @ts-ignore
  puppeteer.use(StealthPlugin());

  // @ts-ignore
  puppeteer.use(
    // @ts-ignore
    AdblockerPlugin({
      blockTrackersAndAnnoyances: true,
      interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
    }),
  );
  if (event.disabled_resources) {
    // @ts-ignore
    puppeteer.use(
      // @ts-ignore
      BlockResourcesPlugin({
        blockedTypes: new Set(event.disabled_resources),
        interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY,
      }),
    );
  }

  // @ts-ignore
  return await puppeteer.launch({
    args: args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    timeout: event.timeout,
  });
}

export async function setupPageListeners(page: Page) {
  page.on("dialog", async (dialog) => {
    await dialog.dismiss();
  });

  page.on("pageerror", async (error) => {
    console.log("page error: " + error);
  });

  page.on("console", async (msg) => {
    console.log("PAGE LOG", msg.text());
  });

  page.on("error", async (error) => {
    console.log("scraping script errored: ", error.message);
  });
}

export async function configurePage(page: Page, event: ObjectAny) {
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setDefaultNavigationTimeout(event.timeout * 1000);
  await page.setRequestInterception(true);
  await page.setUserAgent(event.user_agent);
  if (event.cookies?.length) {
    await page.setCookie(...event.cookies);
  }
  if (event.http_headers && Object.keys(event.http_headers).length) {
    await page.setExtraHTTPHeaders(event.http_headers);
  }

  await page.authenticate({
    username: event.auth.username,
    password: event.auth.password,
  });
}

export function getBaseUrl(url: string) {
  url = url.endsWith("/") ? url.slice(0, -1) : url;

  const match = url.match(/^.+?[^\/:](?=[?\/]|$)/);
  if (match) return match[0];

  return null;
}

export function formatHtml(data: string, url: string) {
  let html = data;
  const regex =
    /(?:href|src|srcset|action)=['"`]([^'`"]*)['"`]|url\(([^)]+)\)/g;
  const matches = [...html.matchAll(regex)];
  const baseUrl = getBaseUrl(url);

  const urlObject = new URL(url);
  const protocol = urlObject.protocol;

  matches.forEach((e) => {
    let link = e[1] || e[2];

    if (link) {
      if (link.startsWith("data:")) {
        return;
      } else if (link.startsWith("//")) {
        link = protocol + link;
      } else if (link.startsWith("/")) {
        link = baseUrl + link;
      } else if (
        !link.startsWith("/") &&
        !link.startsWith("\\") &&
        !link.startsWith("http://") &&
        !link.startsWith("https://")
      ) {
        link = baseUrl + "/" + link;
      }

      if (e[1]) {
        if (e[0].startsWith("srcset=")) {
          const urlsWithDescriptors = link.split(",").map((item) => {
            const trimmedItem = item.trim();
            const urlPart = trimmedItem.split(" ")[0];
            const descriptor = trimmedItem.slice(urlPart.length).trim();

            const absoluteUrl = urlPart.startsWith("/")
              ? baseUrl + urlPart
              : urlPart;
            return `${absoluteUrl} ${descriptor}`.trim();
          });
          html = html.replace(
            e[0],
            `${e[0].split("=")[0]}="${urlsWithDescriptors.join(", ")}"`,
          );
        } else {
          html = html.replace(e[0], `${e[0].split("=")[0]}="${link}"`);
        }
      } else if (e[2]) {
        html = html.replace(e[0], `url(${link})`);
      }
    }
  });

  return html;
}

export async function createSession(url: string, config?: ObjectAny) {
  if (!config) {
    config = {
      url,
      timeout: 900000,
      auth: {
        host: "p.webshare.io",
        port: "80",
        username: "xjrxxdsh-rotate",
        password: "bs1a64qlhfnk",
      },
      proxy_server: "p.webshare.io:80",
      user_agent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      http_headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US;q=0.8,en;q=0.7",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Upgrade-Insecure-Requests": "1",
      },
      cookies: [],
    };
  }
  // open a browser
  const browser = await getBrowserInstance(config);

  // open a page
  const page = await browser.newPage();

  await configurePage(page, config);

  await setupPageListeners(page);

  await page.goto(url, {
    waitUntil: ["domcontentloaded", "networkidle0"],
    // waitUntil: ["load", "domcontentloaded", "networkidle0"],
  });

  return { browser, page };
}