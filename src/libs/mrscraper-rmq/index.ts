import { BrowserTypeLaunchOptions } from "@protocol/channels.js";
import { PuppeteerNodeLaunchOptions } from "puppeteer";
import { Worker as Thread, isMainThread, workerData } from "worker_threads";
import scraperConfig from "../../config/scraper.cofig.js";
import { WorkerInstance } from "../mrscraper-cluster/concurrency/ConcurrencyImplementation.js";
import {
  generateWeightedProxies,
  weightedBrowser,
  weightedProxies,
} from "../mrscraper-cluster/util.js";
import { CdpConnection } from "../mrscraper-cluster/concurrency/builtinConcurrency.js";
import puppeteer from "puppeteer-core";
import Worker from "./Worker.js";
import { shopeeWorker } from "../../utils/scraper.utils.js";
import { DEFAULT_OPTIONS } from "../mrscraper-browser/index.js";
import { RabbitMq } from "./RabbitMq.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

interface ConsumerOptions {
  maxConcurrency: number;
  perBrowserOptions:
    | PuppeteerNodeLaunchOptions[]
    | BrowserTypeLaunchOptions[]
    | undefined;
  timeout: number;
  retryLimit: number;
  restartFunction?: () => Promise<any>;
  perRestartFunction?: (() => Promise<string>)[] | undefined;
  s3Bucket: string;
}
export default async function startConsumer(opt: ConsumerOptions) {
  try {
    console.log("[CONSUMER] Starting consumer");
    const threads = [];
    for (let i = 0; i < opt.maxConcurrency; i++) {
      let nextWorkerOption;
      if (opt.perBrowserOptions && opt.perBrowserOptions.length > 0) {
        nextWorkerOption = opt.perBrowserOptions.shift();
      }
      let nextWorkerRestartFunction;
      if (opt.perRestartFunction && opt.perRestartFunction.length > 0) {
        nextWorkerRestartFunction = opt.perRestartFunction.shift();
      }
      if (nextWorkerOption) {
        const usedProxy =
          weightedProxies[Math.floor(Math.random() * weightedProxies.length)];
        console.log(`[CONSUMER] Using proxy: ${usedProxy}`);
        // @ts-ignore
        nextWorkerOption.proxy = {
          id: usedProxy.id,
          server: `${usedProxy.hostname}:${usedProxy.port}`,
          username: `${usedProxy.username}`,
          password: `${usedProxy.password}`,
        };
      }

      const workerId = i + 1;

      const workerFile = __filename;
      const thread = new Thread(workerFile, {
        workerData: {
          name: "shopee-scraper",
          opt,
          nextWorkerOption,
          workerId,
        },
      });
      threads.push(thread);

      console.log(`[CONSUMER] Worker ${workerId} started`);

      thread.on("error", (err) => {
        console.error(`[CONSUMER] Worker ${workerId} error: ${err}`);
      });

      thread.on("exit", (code) => {
        if (code !== 0) {
          console.error(
            `[CONSUMER] Worker ${workerId} stopped with exit code ${code}`,
          );
        }
      });
    }
  } catch (error: any) {
    console.error(`[CONSUMER] Error: ${error.message}`);
  }
}

if (isMainThread) {
  await generateWeightedProxies();
  if (weightedProxies.length === 0) {
    throw new Error("No proxies available");
  }
  const concurrency = parseInt(scraperConfig.concurrency);
  const perBrowserOptions = [];

  for (let i = 0; i < concurrency; i++) {
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
  await startConsumer({
    maxConcurrency: concurrency,
    perBrowserOptions,
    retryLimit: 8,
    timeout: 900 * 1000,
    s3Bucket: "mrscraper-coupang",
  });
} else {
  const { name, opt, workerId, nextWorkerOption } = workerData;
  const browserConcurrency = new CdpConnection({}, puppeteer); // ignore the parameters for now
  let workerBrowserInstance: WorkerInstance | null = null;
  const percentage = opt.maxConcurrency / parseInt(scraperConfig.browserWeight);
  if (workerId <= percentage) {
    // scraper worker
    try {
      workerBrowserInstance =
        await browserConcurrency.workerInstance(nextWorkerOption);
    } catch (err: any) {
      console.error(err);
      throw new Error(
        `Unable to launch browser for worker, error message: ${err.message}`,
      );
    }
  } else {
    // api worker
  }
  const worker = new Worker<any, any>({
    args: [""], // this.options.args,
    browser: workerBrowserInstance,
    id: workerId,
    type: workerId <= percentage ? "scraper" : "api",
    // type: "api",
    task: shopeeWorker,
    s3Bucket: opt.s3Bucket,
  });
  const rabbitmq = await RabbitMq.connect({
    hostname: "ec2-34-220-185-40.us-west-2.compute.amazonaws.com",
    password: "W3q9L8Np4Tz7X2Y",
    username: "mrscraper",
    port: 5672,
  });
  try {
    rabbitmq.consume(name, worker.callback.bind(worker));
  } catch (error) {}
}
