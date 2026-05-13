import type { NextFunction, Request, Response } from "express";
import { errorResponse, validateToken } from "../utils/request.utils.js";
import { debugGenerator } from "../libs/mrscraper-cluster/util.js";

const debug = debugGenerator("api-middleware");
const limitToken = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user.account.account;
  if (!user) throw new Error("User not found");
  if (user.token_usage < user.token_limit) {
    return next();
  } else {
    debug("User limit exceeded", user);

    return errorResponse(res, "Token limit reached", null, 401);
  }
};

export default limitToken;
