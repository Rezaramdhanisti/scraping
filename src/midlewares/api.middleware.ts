import type { NextFunction, Request, Response } from "express";
import { serverConfig } from "../config/index.js";
import { errorResponse, validateToken } from "../utils/request.utils.js";
import { debugGenerator } from "../libs/mrscraper-cluster/util.js";
import { db } from "../config/databases/sql.config.js";
import UserRepository from "../repositories/UserRepository.js";

const debug = debugGenerator("api-middleware");
const apiKey = async (req: Request, res: Response, next: NextFunction) => {
  let apiKey = req.headers.authorization as string;
  if (!apiKey) return errorResponse(res, "API Key is required", null, 401);
  apiKey = apiKey.split(" ")[1]; // bearer format
  if (apiKey === serverConfig.apiKey) {
    debug("using default api key");
    req.headers["X-USER-ID"] = "1";
    req.headers["X-USER-ROLE"] = "developer";
    return next();
  } else {
    const validation = await validateToken(apiKey);
    debug("validation result", validation);
    if (validation.isValid && validation.user) {
      const user = validation.user;
      req.headers["X-USER-ID"] = user.id;
      req.headers["X-USER-ROLE"] = "user";
      req.user = new UserRepository(user, db);
      return next();
    } else {
      return errorResponse(res, validation.message, null, 401);
    }
  }
};

export default apiKey;
