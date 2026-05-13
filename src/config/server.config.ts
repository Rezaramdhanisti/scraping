import bodyParser from "body-parser";
import "dotenv/config";
import { Application } from "express";
import cors from "cors";
export const serverConfig = {
  apiKey: process.env.API_KEY,
  port: process.env.PORT,
  dataMode: process.env.DATA_MODE,
  proxyUrl: process.env.PROXY_URL,
  apiUrl: process.env.API_URL,
  rmqHost: process.env.RMQ_HOSTNAME,
  rmqPort: process.env.RMQ_PORT,
  rmqUser: process.env.RMQ_USERNAME,
  rmqPass: process.env.RMQ_PASSWORD,
};

export const configureServer = (app: Application) => {
  app.use(bodyParser.json({ limit: "50mb" }));
  app.use(cors());
  app.use(
    bodyParser.urlencoded({
      extended: true,
    }),
  );
  // cors
  app.use(
    cors({
      credentials: true,
      origin: ["*", "http://localhost:3000"],
    }),
  );
};

export default serverConfig;
