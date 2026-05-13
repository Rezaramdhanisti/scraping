import { Page } from "puppeteer";
import { inspect } from "util";
import { Connection } from "../mrscraper-browser/cdp/Connection.js";
import { FFSession } from "../mrscraper-browser/firefox/ffConnection.js";
import {
  debugGenerator,
  log,
  timeoutExecute,
} from "../mrscraper-cluster/util.js";
import Cluster, { TaskFunction } from "../mrscraper-cluster/Cluster.js";
import {
  JobInstance,
  WorkerInstance,
} from "../mrscraper-cluster/concurrency/ConcurrencyImplementation.js";
import Job from "./Job.js";
import { RMQError } from "./RabbitMq.js";
import { TiktokError } from "../../utils/scraper.utils.js";
import { CdpShopeeError } from "../mrscraper-browser/index.js";
import serverConfig from "../../config/server.config.js";
import axios from "axios";
import { db } from "../../config/databases/sql.config.js";
import { S3Storage } from "../../utils/storage.utils.js";

const debug = debugGenerator("Worker");

const apiEndpoints = {
  updateJob: "update-job",
};

interface WorkerOptions {
  args: string[];
  id: number;
  browser: WorkerInstance | null;
  type: WorkerType;
  task: TaskFunction<any, any>;
  s3Bucket: string;
}

const BROWSER_INSTANCE_TRIES = 10;

export interface WorkError {
  type: "error";
  error: Error;
}

export interface WorkData {
  type: "success";
  data: any;
}

export type WorkerType = "scraper" | "api";

export type WorkResult = WorkError | WorkData;

export default class Worker<JobData, ReturnData> implements WorkerOptions {
  type: WorkerType;
  args: string[];
  id: number;
  s3Bucket: string;
  browser: WorkerInstance | null; // null if the type is api
  total: number = 0;
  success: number = 0;
  error: number = 0;
  private s3: S3Storage | null = null;
  task: TaskFunction<JobData, ReturnData>;

  activeTarget: Job<JobData, ReturnData> | null = null;

  public constructor({
    args,
    id,
    browser,
    type,
    task,
    s3Bucket,
  }: WorkerOptions) {
    this.args = args;
    this.id = id;
    this.browser = browser;
    this.type = type;
    this.task = task;
    this.s3Bucket = s3Bucket;
    this.s3 = new S3Storage(s3Bucket);

    debug(`Starting #${this.id}`);
  }

  private async apiHandle(
    task: TaskFunction<JobData, ReturnData>,
    job: Job<JobData, ReturnData>,
    timeout: number,
  ): Promise<WorkResult> {
    this.activeTarget = job;

    let result: any;
    let errorState: Error | null = null;
    try {
      result = await timeoutExecute(
        timeout,
        task({
          data: job.data as JobData,
          worker: {
            id: this.id,
          },
          type: "api",
        }),
      );
    } catch (error: any) {
      errorState = error || new Error("asf");
      log(`Error crawling ${inspect(job.data)} // message: ${error.message}`);
    }

    this.activeTarget = null;

    if (errorState) {
      return {
        type: "error",
        error: errorState || new Error("asf"),
      };
    }
    return {
      data: result,
      type: "success",
    };
  }

  private async scraperHandle(
    task: TaskFunction<JobData, ReturnData>,
    job: Job<JobData, ReturnData>,
    timeout: number,
  ): Promise<WorkResult> {
    if (!this.browser) {
      throw new Error("Scraper handle need a browser to execute");
    }
    this.activeTarget = job;

    let jobInstance: JobInstance | null = null;
    let page: Page | null | Connection | FFSession = null;

    let tries = 0;

    while (jobInstance === null) {
      try {
        jobInstance = await this.browser.jobInstance();
        page = jobInstance.resources.page;
      } catch (err: any) {
        debug(
          `Error getting browser page (try: ${tries}), message: ${err.message}`,
        );
        await this.browser.repair(this.browser.proxy);
        tries += 1;
        if (tries >= BROWSER_INSTANCE_TRIES) {
          throw new Error("Unable to get browser page");
        }
      }
    }

    // We can be sure that page is set now, otherwise an exception would've been thrown
    let errorState: Error | null = null;
    if (page instanceof Page) {
      page = page as Page; // this is just for TypeScript

      page.on("error", (err) => {
        errorState = err;
        log(
          `Error (page error) crawling ${inspect(job.data)} // message: ${err.message}`,
        );
      });
    } else {
      page = page as Connection;
    }

    debug(
      `Executing task on worker #${this.id} with data: ${inspect(job.data)}`,
    );

    let result: any;
    try {
      result = await timeoutExecute(
        timeout,
        task({
          page,
          // data might be undefined if queue is only called with a function
          // we ignore that case, as the user should use Cluster<undefined> in that case
          // to get correct typings
          data: job.data as JobData,
          worker: {
            id: this.id,
          },
          type: "scraper",
        }),
      );
    } catch (err: any) {
      errorState = err;
      log(`Error crawling ${inspect(job.data)} // message: ${err.message}`);
    }

    debug(`Finished executing task on worker #${this.id}`);

    try {
      await jobInstance.close();
    } catch (e: any) {
      debug(
        `Error closing browser instance for ${inspect(job.data)}: ${e.message}`,
      );
      await this.browser.repair();
    }

    this.activeTarget = null;

    if (errorState) {
      return {
        type: "error",
        error: errorState || new Error("asf"),
      };
    }
    return {
      data: result,
      type: "success",
    };
  }

  public async handle(
    job: Job<JobData, ReturnData>,
    timeout: number,
    type: WorkerType = this.type,
  ): Promise<WorkResult> {
    if (type === "scraper") {
      return await this.scraperHandle(this.task, job, timeout);
    } else {
      return await this.apiHandle(this.task, job, timeout);
    }
  }

  public async callback(msg: string) {
    try {
      console.log(`[x] Processing job: ${msg}`);
      const data = JSON.parse(msg);
      const job = new Job(
        data.id,
        data.batchId,
        data.userId,
        data.token,
        data.data,
      );
      while (job.tries < 3) {
        const result = await this.handle(job, 30000, data.type);
        if (result.type == "error") {
          this.error += 1;
          job.addError(result.error);
          await this.updateJobStatusAndError(job, result);
          return;
        }
        const url = await this.s3?.upload(
          JSON.stringify(result.data?.result),
          "data.json",
          job.id!,
          "application/json",
          "result",
        );
        if (!url) {
          throw new Error("Error uploading to S3");
        }
        await this.updateJobStatus(job, url);
        break;
      }
    } catch (error: any) {
      console.error(`[Callback] Error: ${error.message}`);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(error);
    }
  }

  private async updateJobStatus(job: Job<JobData, ReturnData>, url: string) {
    if (serverConfig.dataMode === "api") {
      try {
        // Make the API call to update the job
        const response = await Promise.all([
          axios.post(
            serverConfig.apiUrl + "/add-token-usage",
            {
              tokenUsage: 1,
              accountId: job.userId,
              userId: job.token,
            },
            {
              headers: {
                "X-Api-Key": serverConfig.apiKey,
              },
            },
          ),
          axios.post(
            `${serverConfig.apiUrl}/${apiEndpoints.updateJob}`,
            {
              id: job.id,
              ip: this.browser?.ip,
              proxy_id: this.browser?.proxy_id,
              type: "ASYNC",
              s3_url: url,
              error: null, // Assuming there is no error.
            },
            {
              headers: {
                "X-Api-Key": serverConfig.apiKey,
              },
            },
          ),
        ]);
        const updatedJob = response[1].data;

        // Validate the response and log the result
        if (updatedJob) {
          debug("Job updated successfully with ID:", job.id);
        } else {
          debug("Invalid update job response:", updatedJob);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          debug("Error updating job via API:", error.message);
        } else {
          debug("Error updating job via API:", error);
        }
      }
    } else {
      try {
        // Update the job in the database
        await Promise.all([
          db.$transaction(
            async (tx) => {
              await tx.$executeRawUnsafe(
                `SELECT "token_usage" FROM "Account" WHERE "id" = $1 FOR UPDATE`,
                job.userId,
              );

              await tx.$executeRawUnsafe(
                `UPDATE "Account" SET "token_usage" = "token_usage" + $1 WHERE "id" = $2`,
                1,
                job.userId,
              );
            },
            {
              maxWait: 10000,
              timeout: 15000,
            },
          ),
          db.result.update({
            where: {
              id: job.id!,
            },
            data: {
              status: "SUCCESS",
              s3_url: url,
              ip: this.browser?.ip,
              type: "ASYNC",
              proxy_id: this.browser?.proxy_id,
            },
          }),
        ]);
      } catch (error: unknown) {
        if (error instanceof Error) {
          debug("Error updating job via database:", error.message);
        } else {
          debug("Error updating job via database:", error);
        }
      }
    }
  }

  private async updateJobStatusAndError(
    job: Job<JobData, ReturnData>,
    result: WorkResult,
  ) {
    if (result.type === "success")
      throw new Error(
        "Result is not an error, please use updateJobStatus instead",
      );
    const jobUpdateData = {
      id: job.id,
      ip: this.browser?.ip,
      proxy_id: this.browser?.proxy_id,
      type: "ASYNC",
      error:
        result.error instanceof TiktokError ||
        result.error instanceof CdpShopeeError
          ? {
              status: result.error.status,
              message: result.error.message,
            }
          : null,
    };

    if (serverConfig.dataMode === "api") {
      try {
        // Make the API call to update the job
        const response = await axios.post(
          `${serverConfig.apiUrl}/${apiEndpoints.updateJob}`,
          jobUpdateData,
          {
            headers: {
              "X-Api-Key": serverConfig.apiKey,
            },
          },
        );

        const updatedJob = response.data;

        // Validate the response and log the result
        if (updatedJob) {
          debug("Job updated successfully with ID:", job.id);
        } else {
          debug("Invalid update job response:", updatedJob);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          debug("Error updating job via API:", error.message);
        } else {
          debug("Error updating job via API:", error);
        }
      }
    } else {
      try {
        // Update the job in the database
        await db.result.update({
          where: {
            id: job.id!,
          },
          data: {
            status:
              result.error instanceof TiktokError ||
              result.error instanceof CdpShopeeError
                ? result.error.status
                : "ERROR",

            error:
              result.error instanceof TiktokError ||
              result.error instanceof CdpShopeeError
                ? result.error.message
                : "UNHANDLED ERROR",
            type: "ASYNC",
            ip: this.browser?.ip,
            proxy_id: this.browser?.proxy_id,
          },
        });
      } catch (error: unknown) {
        if (error instanceof Error) {
          debug("Error updating job via database:", error.message);
        } else {
          debug("Error updating job via database:", error);
        }
      }
    }
    throw result.error;
  }

  public getSuccesRate(): number {
    return Math.floor((this.success / this.total) * 100);
  }

  public async close(): Promise<void> {
    if (!this.browser) {
      return;
    }
    try {
      await this.browser.close();
    } catch (err: any) {
      debug(`Unable to close worker browser. Error message: ${err.message}`);
    }
    debug(`Closed #${this.id}`);
  }
}
