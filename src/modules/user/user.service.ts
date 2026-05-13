import { Request, Response } from "express";
import { errorResponse, successResponse } from "../../utils/request.utils.js";
import { db } from "../../config/databases/sql.config.js";
import { SetTokenBodyRequest } from "./user.interface.js";
import { debugGenerator } from "../../libs/mrscraper-cluster/util.js";
import { getAccountInfo } from "../../utils/platform.utils.js";
const debug = debugGenerator("user-service");
export async function getUsage(req: Request, res: Response) {
  try {
    let start: string | undefined | Date = req.get("start");
    let end: string | undefined | Date = req.get("end");
    if (start) start = new Date(start as string);
    if (end) end = new Date(end as string);
    const usage = await req.user.usage(start as Date, end as Date);

    debug("GET /user/usage", usage);
    return successResponse(res, "Token usage", usage);
  } catch (error: any) {
    console.error("Usage Error:", error);
    return errorResponse(res, "Internal server error", error?.message, 500);
  }
}

export async function resetTokenUsage(req: Request, res: Response) {
  try {
    await req.user.resetTokenUsage();
    return successResponse(res, "Token usage reset successfully", null, 200);
  } catch (error: any) {
    console.error("Reset Token Usage Error:", error);
    return errorResponse(res, "Internal server error", error?.message, 500);
  }
}

export async function createUser(req: Request, res: Response) {
  try {
    debug("POST /user/token", req.body);
    const { token, limit_token } = req.body as SetTokenBodyRequest;
    const account = await db.account.findUnique({
      where: {
        id: req.account.id,
      },
    });
    if (!account) {
      debug("Account not found, registering: ", req.account);
      await db.account.create({
        data: {
          id: req.account.id,
          token_limit: req.account.token_limit,
          token_usage: 0,
          subscription_plan: req.account.subscription_plan,
          updatedAt: new Date(),
          User: {
            create: {
              id: token,
              limit_token,
            },
          },
        },
      });
    } else {
      debug("Account found, updating token: ", account);
      await db.user.updateMany({
        where: {
          account_id: req.account.id,
        },
        data: {
          expiredAt: new Date(),
        },
      });

      await db.user.create({
        data: {
          id: token,
          limit_token,
          Account: {
            connect: {
              id: req.account.id,
            },
          },
        },
      });
    }
    return successResponse(res, "Token registered successfully", null, 201);
  } catch (error: any) {
    console.error("Create User Error:", error);
    return errorResponse(res, "Internal server error", error?.message, 500);
  }
}
