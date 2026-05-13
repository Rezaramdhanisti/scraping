import { Request, Response } from "express";
import { debugGenerator } from "../../libs/mrscraper-cluster/util.js";
import {
  ShopeeBatchBodyRequest,
  ShopeeProxyConfig,
  ShopeeResult,
  ShopeeSyncBodyRequest,
  TestCookieTiktokRequest,
  TiktokShopSearchProductsRequest,
  URLsRequestTiktok,
} from "./scraper.interface.js";
import { errorResponse, successResponse } from "../../utils/request.utils.js";
import {
  cluster,
  revertToOriginalUrl,
  TiktokError,
  shopeeWorker,
  testCookieTiktokWorker,
  tiktokShopSearchProductsWorker,
  tiktokAccomodationWorker,
} from "../../utils/scraper.utils.js";
import { db } from "../../config/databases/sql.config.js";
import { Proxy, Result } from "@prisma/client";
import { S3Storage } from "../../utils/storage.utils.js";
import axios from "axios";
import serverConfig from "../../config/server.config.js";

const { apiUrl, apiKey } = serverConfig;

const debug = debugGenerator("scraper-service");

const apiEndpoints = {
  createJob: "create-job",
  getJob: "get-job",
  createProxy: "recreate-proxy",
  getProxy: "get-proxy",
  updateProxy: "update-proxy",
  deleteProxy: "delete-proxy",
};

export async function deleteShopeeProxy(req: Request, res: Response) {
  try {
    debug("DELETE /shopee/proxies-config");
    const { id } = req.params;
    if (serverConfig.dataMode == "db") {
      await db.proxy.delete({
        where: {
          id: parseInt(id),
        },
      });
    } else {
      await axios.delete(`${apiUrl}/${apiEndpoints.deleteProxy}/${id}`, {
        headers: {
          "X-Api-Key": apiKey,
        },
      });
    }
    return successResponse(res, "Successfully delete proxy", { id });
  } catch (error: any) {
    console.error(`Error deleting proxy`, error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}

export async function updateShopeeProxy(req: Request, res: Response) {
  try {
    debug("PUT /shopee/proxies-config");
    const { id } = req.params;
    const data = req.body as ShopeeProxyConfig;
    if (serverConfig.dataMode == "db") {
      await db.proxy.update({
        where: {
          id: parseInt(id),
        },
        data,
      });
    } else {
      await axios.put(`${apiUrl}/${apiEndpoints.updateProxy}/${id}`, data, {
        headers: {
          "X-Api-Key": apiKey,
        },
      });
    }
    return successResponse(res, "Successfully update proxy", data);
  } catch (error: any) {
    console.error(`Error updating proxy`, error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}

export async function getShopeeProxies(req: Request, res: Response) {
  try {
    debug("GET /shopee/proxies-config");
    let proxies: Proxy[] = [];
    if (serverConfig.dataMode == "db") {
      proxies = await db.proxy.findMany({});
    } else {
      const response = await axios.get(`${apiUrl}/${apiEndpoints.getProxy}`, {
        headers: {
          "X-Api-Key": apiKey,
        },
      });
      proxies = response.data;
    }
    return successResponse(res, "Successfully get the proxies", proxies);
  } catch (error: any) {
    console.error(`Error fetch proxies`, error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}

export async function shopeeProxiesConfig(req: Request, res: Response) {
  try {
    const proxies = req.body as ShopeeProxyConfig[];
    debug("POST /shopee/proxies-config", proxies);
    if (serverConfig.dataMode == "db") {
      const now = new Date();
      await db.proxy.createMany({
        data: proxies.map((p) => ({ ...p, updatedAt: now })),
      });
    } else {
      await axios.post(
        `${apiUrl}/${apiEndpoints.createProxy}`,
        {
          proxies,
        },
        {
          headers: {
            "X-Api-Key": apiKey,
          },
        },
      );
    }
    return successResponse(res, "Proxies configured", proxies);
  } catch (error: any) {
    console.error(`Error configure proxy`, error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}

export async function scrapeShopeeSync(req: Request, res: Response) {
  const token = req.headers.authorization as string;
  const role = req.headers["X-USER-ROLE"] as string;
  const { url } = req.body as ShopeeSyncBodyRequest;
  const originalUrl = revertToOriginalUrl(url);
  try {
    const startTimer = Date.now();
    debug("POST /shopee/sync", token);
    debug("Scraping url", originalUrl);
    const result: ShopeeResult = await cluster.execute(
      { url: originalUrl, step_id: undefined, priority: 1 },
      req.user,
      shopeeWorker,
    );
    debug("Scraped response", result);
    const totalTime = Date.now() - startTimer;
    debug("Total time", totalTime);
    if (role !== "developer") {
      try {
        await Promise.all([
          req.user.addTokenUsage(1),
          req.user.logResult(
            "SUCCESS",
            originalUrl,
            undefined,
            result.ip,
            result.proxy_id,
          ),
        ]);
      } catch (error) {
        // console.error(`Failed to update token usage`, error);
      }
    }
    return successResponse(res, "URL scrapped", result.result);
  } catch (error: any) {
    debug("Error", error);
    if (error instanceof TiktokError) {
      try {
        console.error(`Shopee Error: `, error);
        await req.user.logResult(
          error.status,
          originalUrl,
          error.responseBody ?? error.message,
          error.ip,
          error.proxy_id,
        );

        console.error(`Scraping Error: `, error);
        return errorResponse(res, error.status, error.message, 500);
      } catch (error: any) {
        console.error(`Failed to log result`, error);
        return errorResponse(res, "Internal server error", error.message, 500);
      }
    } else {
      try {
        await req.user.logResult("ERROR", originalUrl, error.message);
      } catch (error) {
        console.error(`Failed to log result`, error);
      }
    }
    console.error(`Scraping Error: `, error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}

export async function scrapeTiktokAccomodationSync(req: Request, res: Response) {
  const token = req.headers.authorization as string;
  const role = req.headers["X-USER-ROLE"] as string;
  const { poi_id, language, country, check_in, check_out, adults } = req.body as URLsRequestTiktok;
  try {
    const startTimer = Date.now();
    debug("POST /tiktok/accomodation/sync", token);
    debug("Scraping url", poi_id);
    const result: ShopeeResult = await cluster.execute(
      { poi_id, language, country, check_in, check_out, adults, step_id: undefined, priority: 1 },
      req.user,
      tiktokAccomodationWorker,
    );
    debug("Scraped response", result);
    const totalTime = Date.now() - startTimer;
    debug("Total time", totalTime);
    if (role !== "developer") {
      try {
        await Promise.all([
          // req.user.addTokenUsage(1),
          req.user.logResult(
            "SUCCESS",
            poi_id,
            undefined,
            result.ip,
            result.proxy_id,
          ),
        ]);
      } catch (error) {
        // console.error(`Failed to update token usage`, error);
      }
    }
    return successResponse(res, "URL scrapped", result);
  } catch (error: any) {
    debug("Error", error);
    if (error instanceof TiktokError) {
      try {
        console.error(`Shopee Error: `, error);
        await req.user.logResult(
          error.status,
          poi_id,
          error.responseBody ?? error.message,
          error.ip,
          error.proxy_id,
        );

        console.error(`Scraping Error: `, error);
        return errorResponse(res, error.status, error.message, 500);
      } catch (error: any) {
        console.error(`Failed to log result`, error);
        return errorResponse(res, "Internal server error", error.message, 500);
      }
    } else {
      try {
        await req.user.logResult("ERROR", poi_id, error.message);
      } catch (error) {
        console.error(`Failed to log result`, error);
      }
    }
    console.error(`Scraping Error: `, error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}

const TEST_COOKIE_LOG_URL = "tiktok:test-cookie";

export async function testCookieTiktok(req: Request, res: Response) {
  const token = req.headers.authorization as string;
  const role = req.headers["X-USER-ROLE"] as string;
  const { cookie } = req.body as TestCookieTiktokRequest;
  try {
    const startTimer = Date.now();
    debug("POST /test-cookie-tiktok/sync", token);
    const status = (await cluster.execute(
      { cookie, step_id: undefined, priority: 1 },
      req.user,
      testCookieTiktokWorker,
    )) as "success" | "failed";
    debug("Cookie probe", status);
    debug("Total time", Date.now() - startTimer);
    if (role !== "developer") {
      try {
        await req.user.logResult(
          status === "success" ? "SUCCESS" : "FAILED",
          TEST_COOKIE_LOG_URL,
          undefined,
          "api-sr",
          undefined,
        );
      } catch {
        /* ignore log failure */
      }
    }
    res.status(200).json({ status });
  } catch (error: any) {
    debug("Error", error);
    if (error instanceof TiktokError) {
      try {
        console.error("Tiktok cookie test error:", error);
        await req.user.logResult(
          error.status,
          TEST_COOKIE_LOG_URL,
          error.responseBody ?? error.message,
          error.ip,
          error.proxy_id,
        );
        errorResponse(res, error.status, error.message, 500);
        return;
      } catch (logErr: any) {
        console.error("Failed to log result", logErr);
        errorResponse(res, "Internal server error", logErr.message, 500);
        return;
      }
    }
    try {
      await req.user.logResult("ERROR", TEST_COOKIE_LOG_URL, error.message);
    } catch {
      /* ignore */
    }
    console.error("Cookie test error:", error);
    errorResponse(res, "Internal server error", error.message, 500);
  }
}

export async function scrapeTiktokShopSearchProductSync(req: Request, res: Response) {
  const token = req.headers.authorization as string;
  const role = req.headers["X-USER-ROLE"] as string;
  const { country_code,
    end_product_rating,
    keyword,
    limit,
    page: pageNumber,
    start_product_rating,
    shop_key_word,
  } = req.body as TiktokShopSearchProductsRequest;

  try {
    const startTimer = Date.now();
    debug("POST /tiktok/shop/search/sync", token);
    debug("Scraping url", JSON.stringify(req.body));
    const result: ShopeeResult = await cluster.execute(
      {
        keyword,
        country_code,
        end_product_rating,
        start_product_rating,
        limit,
        page: pageNumber,
        shop_key_word,
        step_id: undefined,
        priority: 1
      },
      req.user,
      tiktokShopSearchProductsWorker,
    );
    debug("Scraped response", result);
    const totalTime = Date.now() - startTimer;
    debug("Total time", totalTime);
    if (role !== "developer") {
      try {
        await Promise.all([
          req.user.addTokenUsage(1),
          req.user.logResult(
            "SUCCESS",
            JSON.stringify(req.body),
            undefined,
            result.ip,
            result.proxy_id,
          ),
        ]);
      } catch (error) {
        // console.error(`Failed to update token usage`, error);
      }
    }
    return successResponse(res, "URL scrapped", result.result);
  } catch (error: any) {
    debug("Error", error);
    if (error instanceof TiktokError) {
      try {
        console.error(`Shopee Error: `, error);
        await req.user.logResult(
          error.status,
          JSON.stringify(req.body),
          error.responseBody ?? error.message,
          error.ip,
          error.proxy_id,
        );

        console.error(`Scraping Error: `, error);
        return errorResponse(res, error.status, error.message, 500);
      } catch (error: any) {
        console.error(`Failed to log result`, error);
        return errorResponse(res, "Internal server error", error.message, 500);
      }
    } else {
      try {
        await req.user.logResult("ERROR", JSON.stringify(req.body), error.message);
      } catch (error) {
        console.error(`Failed to log result`, error);
      }
    }
    console.error(`Scraping Error: `, error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}

export async function scrapeShopeeAsync(req: Request, res: Response) {
  try {
    debug("POST /shopee/batch");
    const { url } = req.body as ShopeeBatchBodyRequest;

    let job;
    if (serverConfig.dataMode === "api") {
      try {
        // Make the API call to create the job
        const response = await axios.post(
          `${apiUrl}/${apiEndpoints.createJob}`,
          {
            status: "PENDING",
          },
          {
            headers: {
              "X-Api-Key": apiKey,
            },
          },
        );

        job = response.data;

        // Validate the response and log the result
        if (job?.id) {
          debug("Job created with ID:", job.id);
        } else {
          debug("Invalid job response:", job);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          debug("Error creating job via API:", error.message);
        } else {
          debug("Error creating job via API:", error);
        }
      }
    } else {
      try {
        // Create the job in the database
        job = await db.job.create({
          data: {
            status: "PENDING",
          },
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          debug("Error creating job via database:", error.message);
        } else {
          debug("Error creating job via database:", error);
        }
      }
    }

    // const orderUrls = urls.sort((a, b) => a.priority - b.priority);
    // for (const { url, step_id, priority } of orderUrls) {
    const originalUrl = revertToOriginalUrl(url);
    // results.push(
    const result = await cluster.queue(
      { url: originalUrl, step_id: undefined, priority: 1 },
      req.user,
      job.id,
      undefined,
      1,
      shopeeWorker,
    );
    // );
    // }
    // (results = await Promise.all(results));
    debug("Scraping url", url);
    debug("Scraped response", result);
    return successResponse(res, "URLs saved to queue", {
      result_id: result.id,
    });
  } catch (error: any) {
    debug("Error", error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}
export async function scrapeShopeeAsyncResult(req: Request, res: Response) {
  try {
    const { id } = req.params;
    debug("GET /shopee/async/result");
    let results: Result | null = null;

    if (serverConfig.dataMode === "api") {
      try {
        // Make the API call to get the job
        const response = await axios.post(
          `${apiUrl}/${apiEndpoints.getJob}/${id}`,
          {},
          {
            headers: {
              "X-Api-Key": apiKey,
            },
          },
        );

        results = response.data;

        // Validate the response and log the result
        if (results?.id) {
          debug("Result found with ID:", results.id);
        } else {
          debug("Invalid result response:", results);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          debug("Error fetching result via API:", error.message);
        } else {
          debug("Error fetching result via API:", error);
        }
      }
    } else {
      try {
        // Get the job in the database
        results = await db.result.findUnique({
          where: {
            id: parseInt(id),
          },
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          debug("Error fetching result via database:", error.message);
        } else {
          debug("Error fetching result via database:", error);
        }
      }
    }

    if (!results) {
      return errorResponse(res, "Not found", "Result not found", 404);
    }
    const s3 = new S3Storage("mrscraper-coupang");
    if (results.status == "PENDING") {
      return errorResponse(
        res,
        "Result still in pending status, try again later",
        { url: results.url, status: results.status },
        404,
      );
    } else if (results.status !== "SUCCESS") {
      return errorResponse(res, "Internal Server Error", results.error, 500);
    }
    // let datas = [];
    // for (const r of results) {
    // if (r.status == "SUCCESS") {
    const data = await getDataFromS3(s3, results);
    // datas.push(data);
    // }
    // }
    // datas = await Promise.all(datas);
    // console.log(datas);
    // await db.job.update({
    //   where: {
    //     id: parseInt(id),
    //   },
    //   data: {
    //     status: "SUCCESS",
    //   },
    // });

    debug("Scraped response", results);
    return successResponse(res, `urls successfully netted`, data);
  } catch (error: any) {
    debug("Error", error);
    return errorResponse(res, "Internal server error", error.message, 500);
  }
}

async function getDataFromS3(s3: S3Storage, result: Result) {
  const data = await s3.getObject(result.s3_url!);
  // return {
  //   url: result.url,
  //   step_id: result.stepId,
  //   priority: result.priority,
  //   data,
  // };
  return data;
}
