import Job from "./Job.js";
import type Cluster from "./Cluster.js";
import type { TaskFunction } from "./Cluster.js";
import { Page } from "puppeteer";
import { timeoutExecute, debugGenerator, log } from "./util.js";
import { inspect } from "util";
import {
  WorkerInstance,
  JobInstance,
} from "./concurrency/ConcurrencyImplementation.js";
import { Connection } from "../mrscraper-browser/cdp/Connection.js";
import { FFSession } from "../mrscraper-browser/firefox/ffConnection.js";

const debug = debugGenerator("Worker");

interface WorkerOptions {
  cluster: Cluster;
  args: string[];
  id: number;
  browser: WorkerInstance | null;
  type: WorkerType;
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
  cluster: Cluster;
  args: string[];
  id: number;
  browser: WorkerInstance | null; // null if the type is api
  total: number = 0;
  success: number = 0;
  error: number = 0;

  activeTarget: Job<JobData, ReturnData> | null = null;

  public constructor({ cluster, args, id, browser, type }: WorkerOptions) {
    this.cluster = cluster;
    this.args = args;
    this.id = id;
    this.browser = browser;
    this.type = type;

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
    task: TaskFunction<JobData, ReturnData>,
    job: Job<JobData, ReturnData>,
    timeout: number,
    type: WorkerType = this.type,
  ): Promise<WorkResult> {
    if (type === "scraper") {
      return await this.scraperHandle(task, job, timeout);
    } else {
      return await this.apiHandle(task, job, timeout);
    }
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
