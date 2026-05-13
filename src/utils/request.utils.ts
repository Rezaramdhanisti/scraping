import { z } from "zod";
import { ObjectAny } from "../interfaces.js";
import { NextFunction, Request, Response } from "express";
import {
  platformConfig,
  scraperConfig,
  serverConfig,
} from "../config/index.js";
import { uploadFile } from "./storage.utils.js";
import { debugGenerator } from "../libs/mrscraper-cluster/util.js";
import axios, { AxiosError, AxiosInstance, CreateAxiosDefaults } from "axios";
import { db } from "../config/databases/sql.config.js";
import { selectUserAccount } from "../repositories/UserRepository.js";

const debug = debugGenerator("request-utils");
// ================== Req/Res Helper ===================
export function errorResponse<T>(
  res: Response,
  message: string,
  data: T,
  code: number = 500,
) {
  res.status(code).json({ success: false, message, data });
}

export function successResponse<T>(
  res: Response,
  message: string,
  data: T,
  code: number = 200,
) {
  res.status(code).json({ success: true, message, data });
}

export function streamResponse<T>(res: Response, data: T) {
  res.write(data);
}

export async function hookResponse<T>(
  result: any | T,
  event: ObjectAny,
  context: ObjectAny,
  error: string | null = null,
) {
  try {
    // let s3 = new S3Client({
    //   region: process.env.AWS_REGION,
    // });

    const response: ObjectAny = {};
    response.type = "leads_generator";
    response.code = event.code;
    response.runtime =
      (event.timeout - context.getRemainingTimeInMillis()) / 1000;
    response.screenshots = [];
    response.recording_path = null;
    response.html_path = null;
    response.data_path = uploadFile(
      JSON.stringify(result.json, null, 2),
      "/assets/results/ai_scraper_result.json",
    );
    response.data = JSON.stringify(result.json, null, 2);
    response.task = result.task;

    if (error) {
      response.error = error;
    }

    await fetch(event.ping, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response),
    });
  } catch (error) {
    console.error(error);
  }
}

export const validateApiUrl = platformConfig.platformApiUrl + "/account";
export async function validateToken(token: string) {
  try {
    let user;

    if (serverConfig.dataMode === "db") {
      user = await db.user.findUnique({
        where: {
          id: token,
        },
        select: {
          ...selectUserAccount,
          expiredAt: true,
        },
      });
    } else {
      const response = await axios.post(
        serverConfig.apiUrl + "/validate-token",
        { token },
        {
          headers: {
            "X-Api-Key": serverConfig.apiKey,
          },
        },
      );
      user = response.data;
    }

    if (!user) {
      return { isValid: false, message: "Invalid token" };
    }
    if (user.expiredAt && user.expiredAt < new Date()) {
      return { isValid: false, message: "Token expired" };
    }
    return { isValid: true, message: "Success", user };
  } catch (error) {
    debug("Validate Token Error:", error);
    return { isValid: false, message: "Internal server error" };
  }
}

export const tokenApiUrl = platformConfig.platformApiUrl + "/token-usage";
export class PrismaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrismaError";
  }
}
export async function addTokenUsage(tokenUsage: number, token: string) {
  token = token.split(" ")[1];

  try {
    await db.$transaction(async (tx) => {
      const user = await tx.$executeRawUnsafe(
        `SELECT "token_usage" FROM "User" WHERE "id" = $1 FOR UPDATE`,
        token,
      );

      await tx.$executeRawUnsafe(
        `UPDATE "User" SET "token_usage" = "token_usage" + $1 WHERE "id" = $2`,
        tokenUsage,
        token,
      );
    });

    const currentToken = await db.user.findUnique({
      where: { id: token },
    });

    debug("Token usage updated", currentToken?.token_usage);
    return { success: true, message: "Token usage updated" };
  } catch (error) {
    debug("Add Token Usage Error:", error);
    return { success: false, message: "Internal server error" };
  }
}

export function validate(scheme: z.ZodSchema<object>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      scheme.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      return next();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.log("Validation Error: ", error);
        return errorResponse(res, error.errors[0].message, null, 400);
      }
      return errorResponse(res, "Internal server error", error?.message, 500);
    }
  };
}
interface BaseRequest {
  baseUrl?: string;
  apiToken?: string;
  maxRetries?: number;
  pollingInterval?: number;
}
export class HttpRequest {
  baseUrl: string;
  apiToken: string;
  client: AxiosInstance;
  maxRetries: number;
  pollingInterval: number;
  constructor(
    { baseUrl, apiToken, maxRetries, pollingInterval }: BaseRequest,
    options: Partial<CreateAxiosDefaults>,
  ) {
    this.apiToken = apiToken || scraperConfig.thirdParty.thirdPartyToken;
    this.baseUrl =
      baseUrl || new URL(scraperConfig.thirdParty.thirdPartyApi).origin;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeout || 60 * 30000, // 30 minutes
      headers: {
        "Content-Type": "application/json",
        "x-api-token": this.apiToken,
      },
      ...options,
    });
    this.maxRetries = maxRetries || 10;
    this.pollingInterval = pollingInterval || 3000;
  }
}
