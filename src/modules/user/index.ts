import * as express from "express";
import { getUsageValidation, setTokenValidation } from "./user.validation.js";
import { createUser, getUsage, resetTokenUsage } from "./user.service.js";
import apiKey from "../../midlewares/api.middleware.js";
const userRouter = express.Router();

userRouter.get("/user/usage", apiKey, getUsageValidation, getUsage);
userRouter.post("/user/reset-token", apiKey, resetTokenUsage);

userRouter.post("/user/token", setTokenValidation, createUser);

export default userRouter;
