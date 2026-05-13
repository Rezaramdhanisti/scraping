// dependencies / libraries
import express, { Request, Response } from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  debugGenerator,
  generateWeightedProxies,
  weightedProxies,
} from "./libs/mrscraper-cluster/util.js";
import UserRepository from "./repositories/UserRepository.js";
import { cluster, createCluster, shopeeWorker, tiktokAccomodationWorker } from "./utils/scraper.utils.js";

// configs
import serverConfig, { configureServer } from "./config/server.config.js";

// middlewares
import apiKey from "./midlewares/api.middleware.js";

// routers
import scraperConfig from "./config/scraper.cofig.js";
import { AccountInfo } from "./interfaces/platform.interface.js";
import { RabbitMq } from "./libs/mrscraper-rmq/RabbitMq.js";
import scraperRouter from "./modules/scraper/index.js";
import { successResponse } from "./utils/request.utils.js";

declare global {
  namespace Express {
    interface Request {
      user: UserRepository;
      account: AccountInfo;
    }
  }
}

const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
const port = serverConfig.port || 3000;
const app = express();
configureServer(app);

const debug = debugGenerator("HTPP");
const server = createServer(app);
debug("Server created");

/*
 * REST API
 */
// endpoint
// app.get("/", (req: Request, res: Response) => {
//   debug("GET /");
//   res.send("MrScraper Scraper Service API");
// });
app.get("/concurrency", (_req: Request, res: Response) => {
  debug("GET concurrency /");
  return successResponse(
    res,
    "Healthy",
    { concurrency: parseInt(scraperConfig.concurrency!) },
    200,
  );
});

app.get("/close-channel", async (_req: Request, res: Response) => {
  cluster.emit("close-channel", "tiktok-a-scraper");
  return successResponse(res, "Channel closed", {}, 200);
});

await generateWeightedProxies();
if (weightedProxies.length === 0) {
  throw new Error("No proxies available");
}

await createCluster(8);
if (!cluster) {
  throw new Error("Cluster not created");
}
cluster.on("taskerror", (err, data, willRetry) => {
  if (willRetry) {
    console.error(
      `Error crawling ${data}: ${err.message}, request will be retried`,
    );
  } else {
    console.error(`Error crawling ${data}: ${err.message}`);
  }
});

await cluster.task(tiktokAccomodationWorker);

app.use("/api", apiKey, scraperRouter);
// app.use("/platform", platformKey, userRouter);

let rabbitmq = await RabbitMq.connect(
  {
    hostname: serverConfig.rmqHost,
    password: serverConfig.rmqPass,
    username: serverConfig.rmqUser,
    port: parseInt(serverConfig.rmqPort || "5672"),
  },
  parseInt(scraperConfig.concurrency),
);

await rabbitmq.consume("tiktok-a-scraper", cluster.callback.bind(cluster));

cluster.on("close-channel", async (name) => {
  if (name === "tiktok-a-scraper") {
    const shopeeConsumer = rabbitmq.consumers.get(name);
    if (rabbitmq.channel && shopeeConsumer) {
      rabbitmq.channel.cancel(shopeeConsumer);
      rabbitmq.consumers.delete(name);
      console.log("Shopee consumer cancelled");
      if (rabbitmq.connection) {
        try {
          await cluster.idle();
          await cluster.close();
          // await rabbitmq.connection.close();
          console.log("RMQ connection closed");
        } catch (error) {
          console.error("Error closing RMQ connection", error);
        }
      }
    } else {
      console.log("Shopee consumer not found");
    }
  }
});

app.post("/test", (req: Request, res: Response) => {
  console.log("Test hitted");
  res.status(200).json({
    message: "Success",
  });
});

app.get("/open-channel", async (req: Request, res: Response) => {
  console.log("Hitted Open Channel");
  const consumer = rabbitmq.consumers.get("tiktok-a-scraper");
  if (!consumer) {
    try {
      // rabbitmq = await RabbitMq.connect(
      //   {
      //     hostname: serverConfig.rmqHost,
      //     password: serverConfig.rmqPass,
      //     username: serverConfig.rmqUser,
      //     port: parseInt(serverConfig.rmqPort || "5672"),
      //   },
      //   parseInt(scraperConfig.concurrency),
      // );

      rabbitmq.consume("tiktok-a-scraper", cluster.callback.bind(cluster));

      console.log("RabbitMQ openned Succesfully");

      res.status(200).json({
        message: "Channel Openned",
      });
    } catch (error) {
      res.status(500).json({
        message: "Error Connecting the channel",
      });
    }
  } else {
    res.status(304).json({
      message: "Channel already opened",
    });
  }
});

// /* Error handler */
// app.use((err: any, req: Request, res: Response, next: NextFunction) => {
//   debug("UNHANDLE ERROR", err);
//   console.log(err);
// });
//
// // logger
server.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});
