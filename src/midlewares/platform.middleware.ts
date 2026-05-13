import type { NextFunction, Request, Response } from "express";
import { serverConfig } from "../config/index.js";
import { errorResponse } from "../utils/request.utils.js";
import { debugGenerator } from "../libs/mrscraper-cluster/util.js";
import { getAccountInfo } from "../utils/platform.utils.js";
import { db } from "../config/databases/sql.config.js";
import UserRepository, {
  selectUserAccount,
} from "../repositories/UserRepository.js";

const debug = debugGenerator("platform-middleware");
const platformKey = async (req: Request, res: Response, next: NextFunction) => {
  debug("platform middleware", req.headers);
  let apiKey = req.headers["x-platform-key"] as string;
  debug("platform key", apiKey);
  if (!apiKey) return errorResponse(res, "Unauthorized", null, 401);

  const accountInfo = await getAccountInfo(apiKey);
  if (!accountInfo) {
    return errorResponse(res, "Unauthorized", null, 401);
  }

  req.account = accountInfo;

  return next();
};

export default platformKey;
