import Job, { ExecuteResolve, ExecuteReject, ExecuteCallbacks } from "./Job.js";
import Display from "./Display.js";
import * as util from "./util.js";
import Worker, { WorkResult } from "./Worker.js";

import * as builtInConcurrency from "./concurrency/builtinConcurrency.js";

import type {
  Page,
  PuppeteerNodeLaunchOptions,
  ConnectOptions,
} from "puppeteer";
import Queue from "./Queue.js";
import SystemMonitor from "./SystemMonitor.js";
import { EventEmitter } from "events";
import ConcurrencyImplementation, {
  WorkerInstance,
  ConcurrencyImplementationClassType,
} from "./concurrency/ConcurrencyImplementation.js";
import UserRepository from "../../repositories/UserRepository.js";
import {
  TiktokError,
  shopeeListWorker,
  shopeeProductWorker,
  shopeeReviewsWorker,
  shopeeSearchWorker,
  tiktokShopSearchProductsWorker,
} from "../../utils/scraper.utils.js";
import { Connection } from "../mrscraper-browser/cdp/Connection.js";
import { CdpShopeeError } from "../mrscraper-browser/index.js";
import scraperConfig from "../../config/scraper.cofig.js";
import { db } from "../../config/databases/sql.config.js";
import { S3Storage } from "../../utils/storage.utils.js";
import { URLsRequest } from "../../modules/scraper/scraper.interface.js";
import { Result } from "@prisma/client";
import { BrowserTypeLaunchOptions } from "@protocol/channels.js";
import { FFSession } from "../mrscraper-browser/firefox/ffConnection.js";
import serverConfig from "../../config/server.config.js";
import axios from "axios";
import { JSONValue } from "../../types.js";

const { apiUrl, apiKey } = serverConfig;

const debug = util.debugGenerator("Cluster");

const apiEndpoints = {
  updateJob: "update-job",
};

interface ClusterOptions {
  concurrency: number | ConcurrencyImplementationClassType;
  maxConcurrency: number;
  workerCreationDelay: number;
  puppeteerOptions: PuppeteerNodeLaunchOptions;
  puppeteerConnectOptions: ConnectOptions;
  perBrowserOptions:
    | PuppeteerNodeLaunchOptions[]
    | BrowserTypeLaunchOptions[]
    | undefined;
  monitor: boolean;
  timeout: number;
  retryLimit: number;
  retryDelay: number;
  skipDuplicateUrls: boolean;
  sameDomainDelay: number;
  puppeteer: any;
  restartFunction: () => Promise<any>;
  perRestartFunction: (() => Promise<string>)[] | undefined;
  autoClose: number;
  s3Bucket?: string;
}

type Partial<T> = {
  [P in keyof T]?: T[P];
};

type ClusterOptionsArgument = Partial<ClusterOptions>;

const DEFAULT_OPTIONS: ClusterOptions = {
  concurrency: 2, // CONTEXT
  maxConcurrency: 1,
  workerCreationDelay: 0,
  puppeteerOptions: {
    // headless: false, // just for testing...
  },
  puppeteerConnectOptions: {},
  perBrowserOptions: undefined,
  monitor: false,
  timeout: 30 * 1000,
  retryLimit: 0,
  retryDelay: 0,
  skipDuplicateUrls: false,
  sameDomainDelay: 0,
  puppeteer: undefined,
  restartFunction: () => Promise.resolve(""),
  perRestartFunction: undefined,
  autoClose: 0,
  s3Bucket: "mrscraper-enterprise",
};

export interface TaskFunctionArguments<JobData> {
  page?: Page | Connection | FFSession;
  data: JobData;
  worker: {
    id: number;
  };
  type: "scraper" | "api";
}

export type TaskFunction<JobData, ReturnData> = (
  arg: TaskFunctionArguments<JobData>,
) => Promise<ReturnData>;

const MONITORING_DISPLAY_INTERVAL = 500;
const CHECK_FOR_WORK_INTERVAL = 100;
const CHECK_FOR_CLEAR_EXPIRED_JOBS = 10 * 1000; // every 1min
const CHECK_FOR_NEW_PROXY_CONFIG = 10 * 1000; // every 1min
const WORK_CALL_INTERVAL_LIMIT = 10;

export default class Cluster<
  JobData = any,
  ReturnData = any,
> extends EventEmitter {
  static CONCURRENCY_PAGE = 1; // shares cookies, etc.
  static CONCURRENCY_CONTEXT = 2; // no cookie sharing (uses contexts)
  static CONCURRENCY_BROWSER = 3; // no cookie sharing and individual processes (uses contexts)
  static CONCURRENCY_BROWSERWS = 4; // no cookie sharing and individual processes (uses contexts) with browserWSEndpoint
  static CONCURRENCY_CDP = 5; // no cookie sharing and individual processes (uses contexts) with CDP
  static CONCURRENCY_FIREFOX = 6; // no cookie sharing and individual processes (uses contexts) with CDP

  private options: ClusterOptions;
  private perBrowserOptions:
    | PuppeteerNodeLaunchOptions[]
    | BrowserTypeLaunchOptions[]
    | null = null;
  private workers: Worker<JobData, ReturnData>[] = [];
  private workersAvail: Worker<JobData, ReturnData>[] = [];
  private workersBusy: Worker<JobData, ReturnData>[] = [];
  private workersStarting = 0;
  private s3: S3Storage | null = null;

  private allTargetCount = 0;
  private jobQueue: Queue<Job<JobData, ReturnData>> = new Queue<
    Job<JobData, ReturnData>
  >();
  private errorCount = 0;

  private taskFunction: TaskFunction<JobData, ReturnData> | null = null;
  private idleResolvers: (() => void)[] = [];
  private waitForOneResolvers: ((data: JobData) => void)[] = [];
  private browser: ConcurrencyImplementation | null = null;

  public isClosed = false;
  private startTime = Date.now();
  private nextWorkerId = -1;

  private monitoringInterval: NodeJS.Timeout | null = null;
  private display: Display | null = null;

  private duplicateCheckUrls: Set<string> = new Set();
  private lastDomainAccesses: Map<string, number> = new Map();
  private perRestartFunction: (() => Promise<string>)[] | null = null;

  private systemMonitor: SystemMonitor = new SystemMonitor();

  private checkForWorkInterval: NodeJS.Timeout | null = null;

  private autoCloseTimeout: NodeJS.Timeout | null = null;
  private lastJobTimestamp: number | null = null;
  private autoCloseTime: number = 0;
  private clearExpiredJobsInterval: NodeJS.Timeout | null = null;
  private loadProxyConfigInterval: NodeJS.Timeout | null = null;

  public static async launch(options: ClusterOptionsArgument) {
    debug("Launching");
    const cluster = new Cluster<URLsRequest, any>(options);
    await cluster.init();
    console.log("launch");

    return cluster;
  }

  private constructor(options: ClusterOptionsArgument) {
    super();

    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };

    if (this.options.monitor) {
      this.monitoringInterval = setInterval(
        () => this.monitor(),
        MONITORING_DISPLAY_INTERVAL,
      );
    }
  }

  private async init() {
    let browserOptions = this.options.puppeteerOptions;
    const restartFunction = this.options.restartFunction;
    let puppeteer = this.options.puppeteer;
    this.autoCloseTime = this.options.autoClose;

    if (this.options.puppeteer == null) {
      // check for null or undefined
      puppeteer = require("puppeteer");
    } else {
      debug("Using provided (custom) puppteer object.");
    }

    if (this.options.concurrency === Cluster.CONCURRENCY_PAGE) {
      this.browser = new builtInConcurrency.Page(browserOptions, puppeteer);
    } else if (this.options.concurrency === Cluster.CONCURRENCY_CONTEXT) {
      this.browser = new builtInConcurrency.Context(browserOptions, puppeteer);
    } else if (this.options.concurrency === Cluster.CONCURRENCY_BROWSER) {
      this.browser = new builtInConcurrency.Browser(browserOptions, puppeteer);
    } else if (this.options.concurrency === Cluster.CONCURRENCY_BROWSERWS) {
      if (!this.options.puppeteerConnectOptions.browserWSEndpoint) {
        throw new Error(
          "browserWSEndpoint is required for Cluster.CONCURRENCY_BROWSERWS",
        );
      }
      browserOptions = this.options.puppeteerConnectOptions;
      this.browser = new builtInConcurrency.BrowserWs(
        browserOptions,
        puppeteer,
        restartFunction,
      );
    } else if (this.options.concurrency === Cluster.CONCURRENCY_CDP) {
      this.browser = new builtInConcurrency.CdpConnection(
        browserOptions,
        puppeteer,
        restartFunction,
      );
    } else if (this.options.concurrency === Cluster.CONCURRENCY_FIREFOX) {
      this.browser = new builtInConcurrency.FireFoxConnection(
        browserOptions,
        puppeteer,
      );
    } else if (typeof this.options.concurrency === "function") {
      this.browser = new this.options.concurrency(browserOptions, puppeteer);
    } else {
      throw new Error(
        `Unknown concurrency option: ${this.options.concurrency}`,
      );
    }

    if (typeof this.options.maxConcurrency !== "number") {
      throw new Error("maxConcurrency must be of number type");
    }
    if (
      this.options.perBrowserOptions &&
      this.options.perBrowserOptions.length !== this.options.maxConcurrency
    ) {
      throw new Error("perBrowserOptions length must equal maxConcurrency");
    }
    if (this.options.perBrowserOptions) {
      // @ts-ignore
      this.perBrowserOptions = [...this.options.perBrowserOptions];
    }

    if (
      this.options.perRestartFunction &&
      this.options.perRestartFunction.length !== this.options.maxConcurrency
    ) {
      throw new Error("perRestartFunction length must equal maxConcurrency");
    }
    if (this.options.perRestartFunction) {
      this.perRestartFunction = [...this.options.perRestartFunction];
    }

    if (this.options.s3Bucket) {
      this.s3 = new S3Storage(this.options.s3Bucket);
    }

    try {
      await this.browser.init();
    } catch (err: any) {
      throw new Error(
        `Unable to launch browser, error message: ${err.message}`,
      );
    }

    if (this.options.monitor) {
      await this.systemMonitor.init();
    }

    this.clearExpiredJobsInterval = setInterval(
      () => this.clearExpiredJobs(),
      CHECK_FOR_CLEAR_EXPIRED_JOBS,
    );

    this.loadProxyConfigInterval = setInterval(
      () => this.loadProxyConfig(),
      CHECK_FOR_NEW_PROXY_CONFIG,
    );

    // needed in case resources are getting free (like CPU/memory) to check if
    // can launch workers
    this.checkForWorkInterval = setInterval(
      () => this.work(),
      CHECK_FOR_WORK_INTERVAL,
    );
  }

  private async loadProxyConfig() {
    try {
      debug("Loading proxy config");
      const isUpdated = await util.generateWeightedProxies();
      if (isUpdated) {
        for (const worker of this.workers) {
          const usedProxy =
            util.weightedProxies[
              Math.floor(Math.random() * util.weightedProxies.length)
            ];

          if (!worker.browser) return;
          worker.browser.proxy_id = usedProxy.id;
          worker.browser.proxy = {
            id: usedProxy.id,
            server: `${usedProxy.hostname}:${usedProxy.port}`,
            username: `${usedProxy.username}`,
            password: `${usedProxy.password}`,
          };
        }
        console.log("Proxies updated");
      }
    } catch (error) {
      console.error("Error updating proxies", error);
    }
  }

  private async clearExpiredJobs() {
    const now = Date.now();
    debug("Checking for expired jobs", now);
    const jobs = this.jobQueue.getAll();
    const expiredJobs = [];
    for (const job of jobs) {
      if (job.expiredAt && job.expiredAt.getTime() < now) {
        const data = job.data as URLsRequest;
        debug("Removing expired job", job.id);
        if (job.id) expiredJobs.push(job);
        if (job.executeCallbacks)
          job.executeCallbacks.reject(
            new TiktokError("JOB TIMEOUT", data.url, "CANCELLED"),
          );
        this.jobQueue.remove(job);
        this.errorCount += 1;
      }
    }

    // if (expiredJobs.length > 0) {
    //   try {
    //     debug("Removed ", expiredJobs.length, " expired");
    //
    //     if (serverConfig.dataMode === "db") {
    //       await db.result.updateMany({
    //         where: {
    //           id: {
    //             in: expiredJobs.map((job) => job.id!),
    //           },
    //         },
    //         data: {
    //           status: "CANCELED",
    //           error: "EXPIRED JOB",
    //         },
    //       });
    //     } else {
    //       await axios.post(
    //         serverConfig.apiUrl + "/cancel-jobs",
    //         {
    //           jobIds: expiredJobs.map((job) => job.id!),
    //         },
    //         {
    //           headers: {
    //             "X-Api-Key": serverConfig.apiKey,
    //           },
    //         },
    //       );
    //     }
    //   } catch (error) {
    //     console.error("Unable to update expired jobs", error);
    //   }
    // }
  }

  private async launchWorker() {
    // signal, that we are starting a worker
    this.workersStarting += 1;
    this.nextWorkerId += 1;
    this.lastLaunchedWorkerTime = Date.now();

    let nextWorkerOption;
    if (this.perBrowserOptions && this.perBrowserOptions.length > 0) {
      nextWorkerOption = this.perBrowserOptions.shift();
    }
    let nextWorkerRestartFunction;
    if (this.perRestartFunction && this.perRestartFunction.length > 0) {
      nextWorkerRestartFunction = this.perRestartFunction.shift();
    }

    const workerId = this.nextWorkerId;

    let workerBrowserInstance: WorkerInstance | null = null;
    const percentage =
      this.options.maxConcurrency / parseInt(scraperConfig.browserWeight);
    if (workerId <= percentage) {
      // scraper worker
      // try {
      //   if (nextWorkerOption) {
      //     const usedProxy =
      //       util.weightedProxies[
      //         Math.floor(Math.random() * util.weightedProxies.length)
      //       ];
      //     // @ts-ignore
      //     nextWorkerOption.proxy = {
      //       id: usedProxy.id,
      //       server: `${usedProxy.hostname}:${usedProxy.port}`,
      //       username: `${usedProxy.username}`,
      //       password: `${usedProxy.password}`,
      //     };
      //   }
      //   workerBrowserInstance = await (
      //     this.browser as ConcurrencyImplementation
      //   ).workerInstance(nextWorkerOption, nextWorkerRestartFunction);
      // } catch (err: any) {
      //   console.error(err);
      //   throw new Error(
      //     `Unable to launch browser for worker, error message: ${err.message}`,
      //   );
      // }
    } else {
      // api worker
    }

    const worker = new Worker<JobData, ReturnData>({
      cluster: this,
      args: [""], // this.options.args,
      browser: workerBrowserInstance,
      id: workerId,
      // type: workerId <= percentage ? "scraper" : "api",
      type: "api",
    });
    this.workersStarting -= 1;

    if (this.isClosed) {
      // cluster was closed while we created a new worker (should rarely happen)
      worker.close();
    } else {
      this.workersAvail.push(worker);
      this.workers.push(worker);
    }
  }

  public async task(taskFunction: TaskFunction<JobData, ReturnData>) {
    this.taskFunction = taskFunction;
  }

  private nextWorkCall: number = 0;
  private workCallTimeout: NodeJS.Timeout | null = null;

  // check for new work soon (wait if there will be put more data into the queue, first)
  private async work() {
    // make sure, we only call work once every WORK_CALL_INTERVAL_LIMIT (currently: 10ms)
    if (this.workCallTimeout === null) {
      const now = Date.now();

      // calculate when the next work call should happen
      this.nextWorkCall = Math.max(
        this.nextWorkCall + WORK_CALL_INTERVAL_LIMIT,
        now,
      );
      const timeUntilNextWorkCall = this.nextWorkCall - now;

      this.workCallTimeout = setTimeout(() => {
        this.workCallTimeout = null;
        this.doWork();
      }, timeUntilNextWorkCall);
    }
  }

  private async doWork() {
    if (this.jobQueue.size() === 0) {
      // no jobs available
      if (this.workersBusy.length === 0) {
        // debug("No jobs available");
        this.idleResolvers.forEach((resolve) => resolve());
        if (this.autoCloseTime > 0) {
          this.autoClose(this.autoCloseTime); // auto close in n seconds if there are still no jobs available
        }
      }
      return;
    }

    this.updateLastJobTimestamp();
    if (this.workersAvail.length === 0) {
      // no workers available
      if (this.allowedToStartWorker()) {
        await this.launchWorker();
        this.work();
      }
      return;
    }

    const job = this.jobQueue.shift();

    if (job === undefined) {
      // skip, there are items in the queue but they are all delayed
      return;
    }

    const url = job.getUrl();
    const domain = job.getDomain();

    // Check if URL was already crawled (on skipDuplicateUrls)
    if (
      this.options.skipDuplicateUrls &&
      url !== undefined &&
      this.duplicateCheckUrls.has(url)
    ) {
      // already crawled, just ignore
      debug(`Skipping duplicate URL: ${job.getUrl()}`);
      this.work();
      return;
    }

    // Check if the job needs to be delayed due to sameDomainDelay
    if (this.options.sameDomainDelay !== 0 && domain !== undefined) {
      const lastDomainAccess = this.lastDomainAccesses.get(domain);
      if (
        lastDomainAccess !== undefined &&
        lastDomainAccess + this.options.sameDomainDelay > Date.now() &&
        !job.isRetry
      ) {
        console.log("delayed", domain, this.options.sameDomainDelay);
        this.jobQueue.push(job, {
          delayUntil: lastDomainAccess + this.options.sameDomainDelay,
        });
        this.work();
        return;
      }
    }

    // Check are all positive, let's actually run the job
    if (this.options.skipDuplicateUrls && url !== undefined) {
      this.duplicateCheckUrls.add(url);
    }
    if (this.options.sameDomainDelay !== 0 && domain !== undefined) {
      this.lastDomainAccesses.set(domain, Date.now());
    }

    this.workersAvail.sort((a, b) => b.getSuccesRate() - a.getSuccesRate());

    const worker = this.workersAvail.shift() as Worker<JobData, ReturnData>;
    worker.total += 1;
    this.workersBusy.push(worker);

    if (this.workersAvail.length !== 0 || this.allowedToStartWorker()) {
      // we can execute more work in parallel
      this.work();
    }

    let jobFunction;
    if (job.taskFunction !== undefined) {
      jobFunction = job.taskFunction;
    } else if (this.taskFunction !== null) {
      jobFunction = this.taskFunction;
    } else {
      throw new Error("No task function defined!");
    }

    const result: WorkResult = await worker.handle(
      jobFunction as TaskFunction<JobData, ReturnData>,
      job,
      this.options.timeout,
    );

    if (result.type === "error") {
      if (job.executeCallbacks) {
        if (
          result.error instanceof TiktokError ||
          result.error instanceof CdpShopeeError
        ) {
          if (worker.browser) {
            try {
              await worker.browser.repair(worker.browser.proxy); // if shoppee error, repair browser to rotate IP and Fingerprint
            } catch (error: any) {
              console.error(
                "----------------SKIP REPAIR------------------",
                error.message,
              );
            }
          }
          const jobWillRetry = job.tries <= this.options.retryLimit;
          debug("Job tries", job.tries);
          // console.log("error", result);
          this.emit("taskerror", result.error, job.data, jobWillRetry);
          if (jobWillRetry) {
            let delayUntil = undefined;
            if (this.options.retryDelay !== 0) {
              delayUntil = Date.now() + this.options.retryDelay;
            }
            job.isRetry = true;
            this.jobQueue.push(job, {
              delayUntil,
            });
            job.tries += 1;
          } else {
            if (job.type === "async")
              await this.updateJobStatusAndError(job, result, worker);
            job.executeCallbacks.reject(result.error);
            this.errorCount += 1;
          }
        } else {
          const newError = new TiktokError(
            "Failed to many times",
            url,
            "BLOCKED_TOO_MANY_TIMES",
            result.error.message,
            "api-demo",
          );
          worker.error += 1;
          if (job.type === "async")
            await this.updateJobStatusAndError(job, result, worker);
          job.executeCallbacks.reject(newError);
          this.errorCount += 1;
        }
      } else {
        // ignore retryLimits in case of executeCallbacks
        if (
          (result.error instanceof TiktokError ||
            result.error instanceof CdpShopeeError) &&
          worker.browser
        ) {
          debug("Shopee error, repairing browser");
          try {
            await worker.browser.repair(worker.browser.proxy); // if shoppee error, repair browser to rotate IP and Fingerprint
          } catch (error: any) {
            console.error(
              "----------------SKIP REPAIR------------------",
              error.message,
            );
          }
          const jobWillRetry = job.tries <= this.options.retryLimit;
          debug("Job tries", job.tries);
          this.emit("taskerror", result.error, job.data, jobWillRetry);
          if (jobWillRetry) {
            let delayUntil = undefined;
            if (this.options.retryDelay !== 0) {
              delayUntil = Date.now() + this.options.retryDelay;
            }

            job.isRetry = true;
            this.jobQueue.push(job, {
              delayUntil,
            });
            job.tries += 1;
          } else {
            // try {
            //   debug("Retrying job with API worker");
            //   const apiResult = await worker.handle(
            //     jobFunction,
            //     job,
            //     this.options.timeout,
            //     "api",
            //   );
            //   if (apiResult.type == "error") {
            //     debug("API worker error", apiResult.error);
            //     job.executeCallbacks.reject(apiResult.error);
            //     this.errorCount += 1;
            //   } else if (apiResult.type == "success") {
            //     debug("API worker success", apiResult.data);
            //     job.executeCallbacks.resolve(apiResult.data);
            //   }
            // } catch (error) {
            job.addError(result.error);

            await this.updateJobStatusAndError(job, result, worker);

            this.errorCount += 1;
            this.emit("taskerror", result.error, job.data, false);
            // }
          }
        } else {
          worker.error += 1;
          job.addError(result.error);

          await this.updateJobStatusAndError(job, result, worker);

          this.errorCount += 1;
          this.emit("taskerror", result.error, job.data, false);
        }
      }
    } else if (result.type === "success") {
      // if (worker.browser) {
      //   try {
      //     await worker.browser.repair(worker.browser.proxy); // always repair browser to rotate IP and Fingerprint and avoid banning
      //   } catch (error: any) {
      //     console.error(
      //       "----------------SKIP REPAIR------------------",
      //       error.message,
      //     );
      //   }
      // }
      worker.success += 1;

      if (job.executeCallbacks) job.executeCallbacks.resolve(result.data);

      if (!job.executeCallbacks || job.type === "async") {
        const dealId = job.getSDealId();
        let res: any = result.data?.result;
        if (dealId) {
          res = this.checkResultQuality(result.data?.result, dealId);
        }
        const url = await this.s3?.upload(
          JSON.stringify(res),
          "data.json",
          job.id!,
          "application/json",
          "result",
        );

        if (serverConfig.dataMode === "api") {
          try {
            // Make the API call to update the job
            const response = await Promise.all([
              axios.post(
                serverConfig.apiUrl + "/add-token-usage",
                {
                  tokenUsage: 1,
                  accountId: job.userId,
                  userId: job.tokenId,
                },
                {
                  headers: {
                    "X-Api-Key": serverConfig.apiKey,
                  },
                },
              ),
              axios.post(
                `${apiUrl}/${apiEndpoints.updateJob}`,
                {
                  id: job.id,
                  ip: worker.browser?.ip || result.data?.ip,
                  proxy_id: worker.browser?.proxy_id || result?.data?.proxy_id,
                  type: "ASYNC",
                  s3_url: url,
                  error: null, // Assuming there is no error.
                  solution_id: scraperConfig.solutionId || null,
                },
                {
                  headers: {
                    "X-Api-Key": apiKey,
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
                  ip: worker.browser?.ip,
                  type: "ASYNC",
                  proxy_id: worker.browser?.proxy_id,
                  solution_id: scraperConfig.solutionId || null,
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
    }

    this.waitForOneResolvers.forEach((resolve) => resolve(job.data as JobData));
    this.waitForOneResolvers = [];

    // add worker to available workers again
    const workerIndex = this.workersBusy.indexOf(worker);
    this.workersBusy.splice(workerIndex, 1);

    this.workersAvail.push(worker);

    this.work();
  }

  private lastLaunchedWorkerTime: number = 0;

  private allowedToStartWorker(): boolean {
    const workerCount = this.workers.length + this.workersStarting;
    return (
      // option: maxConcurrency
      (this.options.maxConcurrency === 0 ||
        workerCount < this.options.maxConcurrency) &&
      // just allow worker creaton every few milliseconds
      (this.options.workerCreationDelay === 0 ||
        this.lastLaunchedWorkerTime + this.options.workerCreationDelay <
          Date.now())
    );
  }

  // Type Guard for TypeScript
  private isTaskFunction(
    data: JobData | TaskFunction<JobData, ReturnData>,
  ): data is TaskFunction<JobData, ReturnData> {
    return typeof data === "function";
  }

  private queueJob(
    data: JobData | TaskFunction<JobData, ReturnData>,
    id?: number,
    batchId?: number,
    userId?: number,
    tokenId?: string,
    type?: "async" | "sync",
    taskFunction?: TaskFunction<JobData, ReturnData>,
    callbacks?: ExecuteCallbacks,
  ): void {
    if (this.isClosed) {
      this.isClosed = false;
      this.checkForWorkInterval = setInterval(
        () => this.work(),
        CHECK_FOR_WORK_INTERVAL,
      );
      this.clearExpiredJobsInterval = setInterval(
        () => this.clearExpiredJobs(),
        CHECK_FOR_CLEAR_EXPIRED_JOBS,
      );
      this.loadProxyConfigInterval = setInterval(
        () => this.loadProxyConfig(),
        CHECK_FOR_NEW_PROXY_CONFIG,
      );
    }
    let realData: JobData | undefined;
    let realFunction: TaskFunction<JobData, ReturnData> | undefined;
    if (this.isTaskFunction(data)) {
      realFunction = data;
    } else {
      realData = data;
      realFunction = taskFunction;
    }
    const job = new Job<JobData, ReturnData>(
      id,
      batchId,
      userId,
      tokenId,
      realData,
      type,
      realFunction,
      callbacks,
    );

    this.allTargetCount += 1;
    this.jobQueue.push(job);
    this.emit("queue", realData, realFunction);
    this.work();
  }

  public async queue(
    data: JobData,
    user: UserRepository,
    job_id?: number,
    step_id?: string,
    priority?: number,
    taskFunction?: TaskFunction<JobData, ReturnData>,
  ): Promise<Result>;
  public async queue(
    data: JobData,
    user: UserRepository,
    job_id: number,
    step_id: string,
    priority: number,
    taskFunction: TaskFunction<JobData, ReturnData>,
  ): Promise<Result>;
  public async queue(
    data: JobData | TaskFunction<JobData, ReturnData>,
    user: UserRepository,
    job_id?: number,
    step_id?: string,
    priority?: number,
    taskFunction?: TaskFunction<JobData, ReturnData>,
  ): Promise<Result> {
    const realData = data as unknown as URLsRequest;
    const queue = await user.createResult(
      "PENDING",
      realData.url,
      undefined,
      undefined,
      undefined,
      job_id,
      step_id,
      priority,
    );
    this.queueJob(
      data,
      queue.id,
      job_id,
      user.account.account.id,
      user.account.id,
      "async",
      taskFunction,
    );
    return queue;
  }

  public async callback(msg: string): Promise<ReturnData> {
    return new Promise<ReturnData>(
      async (resolve: ExecuteResolve, reject: ExecuteReject) => {
        try {
          const {
            id,
            data,
            batchId,
            userId,
            token,
            targetType = "sp_get_pc",
          } = JSON.parse(msg);
          const callbacks = {
            resolve,
            reject,
          };
          let taskFunction: TaskFunction<any, any> | undefined;
          switch (targetType) {
            case "sp_get_pc":
              taskFunction = undefined;
              break;
            case "sp_get_list":
              taskFunction = shopeeListWorker;
              break;
            case "sp_rcmd_list":
              taskFunction = shopeeProductWorker;
              break;
            case "sp_search_items":
              taskFunction = shopeeSearchWorker;
              break;
            case "sp_get_ratings":
              taskFunction = shopeeReviewsWorker;
              break;
            case "tk_shop_search":
              taskFunction = tiktokShopSearchProductsWorker
              break;
            default:
              taskFunction = undefined;
              break;
          }
          console.log(
            `[INFO] Processing task for ${targetType} with worker: ${taskFunction?.name || "shopeeWorker"}`,
          );
          this.queueJob(
            data,
            id,
            batchId,
            userId,
            token,
            "async",
            taskFunction,
            callbacks,
          );
        } catch (error) {
          console.error(`Error processing callback: ${error}`);
        }
      },
    );
  }

  public execute(
    data: JobData,
    user: UserRepository,
    taskFunction?: TaskFunction<JobData, ReturnData>,
  ): Promise<ReturnData>;
  public execute(
    data: JobData,
    user: UserRepository,
    taskFunction: TaskFunction<JobData, ReturnData>,
  ): Promise<ReturnData>;
  public execute(
    data: JobData | TaskFunction<JobData, ReturnData>,
    user: UserRepository,
    taskFunction?: TaskFunction<JobData, ReturnData>,
  ): Promise<ReturnData> {
    return new Promise<ReturnData>(
      async (resolve: ExecuteResolve, reject: ExecuteReject) => {
        const realData = data as unknown as URLsRequest;
        // const queue = await user.createResult(
        //   "PENDING",
        //   realData.url,
        //   undefined,
        //   undefined,
        //   undefined,
        //   undefined,
        //   undefined,
        //   1,
        // );
        const callbacks = { resolve, reject };
        this.queueJob(
          data,
          undefined,
          undefined,
          undefined,
          undefined,
          "sync",
          taskFunction,
          callbacks,
        );
      },
    );
  }

  public autoClose(ttl: number | undefined = 30): NodeJS.Timeout {
    this.autoCloseTimeout = setTimeout(async () => {
      await this.idle();
      if (this.jobQueue.size() === 0) {
        if (
          this.lastJobTimestamp &&
          Date.now() - this.lastJobTimestamp >= ttl * 1000
        ) {
          debug(`Closing browser due to inactivity after ${ttl} seconds`);
          clearTimeout(this.autoCloseTimeout as NodeJS.Timeout);
          await this.close();
          this.autoCloseTimeout = null;
        }
      } else {
        this.updateLastJobTimestamp();
      }
    }, ttl * 1000);

    return this.autoCloseTimeout;
  }

  private updateLastJobTimestamp() {
    this.lastJobTimestamp = Date.now();
    if (this.autoCloseTimeout) {
      debug("Clearing autoCloseTimeout");
      clearTimeout(this.autoCloseTimeout as NodeJS.Timeout);
      this.autoCloseTimeout = null;
    }
  }

  public idle(): Promise<void> {
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  public waitForOne(): Promise<JobData> {
    return new Promise((resolve) => this.waitForOneResolvers.push(resolve));
  }

  public async close(): Promise<void> {
    this.isClosed = true;

    clearInterval(this.checkForWorkInterval as NodeJS.Timeout);
    clearInterval(this.loadProxyConfigInterval as NodeJS.Timeout);
    clearTimeout(this.workCallTimeout as NodeJS.Timeout);
    clearInterval(this.clearExpiredJobsInterval as NodeJS.Timeout);
    if (this.autoCloseTimeout) {
      clearTimeout(this.autoCloseTimeout as NodeJS.Timeout);
      this.autoCloseTimeout = null;
    }

    // close workers
    await Promise.all(this.workers.map((worker) => worker.close()));

    try {
      await (this.browser as ConcurrencyImplementation).close();
    } catch (err: any) {
      debug(`Error: Unable to close browser, message: ${err.message}`);
    }

    if (this.monitoringInterval) {
      debug("Should close monitoring, but not implemented yet.");
      // this.monitor();
      // clearInterval(this.monitoringInterval);
    }

    if (this.display) {
      // this.display.close();
    }

    // this.systemMonitor.close();

    debug("Closed");
  }

  private monitor(): void {
    if (!this.display) {
      this.display = new Display();
    }
    const display = this.display;

    const now = Date.now();
    const timeDiff = now - this.startTime;

    const doneTargets =
      this.allTargetCount - this.jobQueue.size() - this.workersBusy.length;
    const donePercentage =
      this.allTargetCount === 0 ? 1 : doneTargets / this.allTargetCount;
    const donePercStr = (100 * donePercentage).toFixed(2);

    const errorPerc =
      doneTargets === 0
        ? "0.00"
        : ((100 * this.errorCount) / doneTargets).toFixed(2);

    const timeRunning = util.formatDuration(timeDiff);

    let timeRemainingMillis = -1;
    if (donePercentage !== 0) {
      timeRemainingMillis = timeDiff / donePercentage - timeDiff;
    }
    const timeRemining = util.formatDuration(timeRemainingMillis);

    const cpuUsage = this.systemMonitor.getCpuUsage().toFixed(1);
    const memoryUsage = this.systemMonitor.getMemoryUsage().toFixed(1);

    const pagesPerSecond =
      doneTargets === 0 ? "0" : ((doneTargets * 1000) / timeDiff).toFixed(2);

    display.log(`== Start:     ${util.formatDateTime(this.startTime)}`);
    display.log(
      `== Now:       ${util.formatDateTime(now)} (running for ${timeRunning})`,
    );
    display.log(
      `== Progress:  ${doneTargets} / ${this.allTargetCount} (${donePercStr}%)` +
        `, errors: ${this.errorCount} (${errorPerc}%)`,
    );
    display.log(
      `== Remaining: ${timeRemining} (@ ${pagesPerSecond} pages/second)`,
    );
    display.log(`== Sys. load: ${cpuUsage}% CPU / ${memoryUsage}% memory`);
    display.log(`== Workers:   ${this.workers.length + this.workersStarting}`);

    // this.workers.forEach((worker, i) => {
    //   const isIdle = this.workersAvail.indexOf(worker) !== -1;
    //   const workType =
    //     worker.type === "scraper"
    //       ? `${worker.browser?.browser?.toUpperCase() ?? "SCRAPER"}-${worker.browser?.proxy?.server}:${worker.getSuccesRate()}`
    //       : `API:${worker.getSuccesRate()}`;
    //   let workOrIdle;
    //   let workerUrl = "";
    //   if (this.isClosed) {
    //     workOrIdle = "CLOSED";
    //   } else if (isIdle) {
    //     workOrIdle = "IDLE";
    //   } else {
    //     workOrIdle = "WORK";
    //     if (worker.activeTarget) {
    //       workerUrl = worker.activeTarget.getUrl() || "UNKNOWN TARGET";
    //     } else {
    //       workerUrl = "NO TARGET (should not be happening)";
    //     }
    //   }

    //   display.log(`   #${i}  ${workType} ${workOrIdle} ${workerUrl}`);
    // });
    // for (let i = 0; i < this.workersStarting; i += 1) {
    //   display.log(`   #${this.workers.length + i} STARTING...`);
    // }

    display.resetCursor();
  }

  private checkResultQuality(
    result: JSONValue,
    dealId: { shopId: string; itemId: string },
  ) {
    if (!result) {
      throw new Error("Result is empty");
    }
    const res = result as any;
    if (!res.data?.item && res.error == 266900002) return result;
    if (
      res.data?.item?.item_id !== parseInt(dealId.itemId) &&
      res.data?.item?.shop_id !== parseInt(dealId.shopId)
    ) {
      console.log(
        res.data?.item?.item_id,
        res.data?.item?.shop_id,
        dealId.itemId,
        dealId.shopId,
      ); // debug
      throw new Error("Result itemId or shopId does not match");
    }

    return result;
  }

  private async updateJobStatusAndError(
    job: any,
    result: any,
    worker: any,
  ): Promise<void> {
    const jobUpdateData = {
      id: job.id,
      ip:
        result.error instanceof TiktokError
          ? result.error.ip
          : worker.browser?.ip,
      proxy_id:
        result.error instanceof TiktokError
          ? result.error.proxy_id
          : worker.browser?.proxy_id,
      type: "ASYNC",
      error:
        result.error instanceof TiktokError ||
        result.error instanceof CdpShopeeError
          ? {
              status: result.error.status,
              message: result.error.message,
            }
          : null,
      solution_id: scraperConfig.solutionId || null,
    };

    if (serverConfig.dataMode === "api") {
      try {
        // Make the API call to update the job
        const response = await axios.post(
          `${apiUrl}/${apiEndpoints.updateJob}`,
          jobUpdateData,
          {
            headers: {
              "X-Api-Key": apiKey,
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
            ip: worker.browser?.ip,
            proxy_id: worker.browser?.proxy_id,
            solution_id: scraperConfig.solutionId || null,
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
  }
}
