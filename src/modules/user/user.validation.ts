import { z } from "zod";
import { validate } from "../../utils/request.utils.js";
const GetUsageSchema = z.object({
  query: z.object({
    start: z.string().date().optional(),
    end: z.string().date().optional(),
  }),
});

const SetTokenValidation = z.object({
  body: z.object({
    token: z.string(),
    limit_token: z.number(),
  }),
});

export const getUsageValidation = validate(GetUsageSchema);
export const setTokenValidation = validate(GetUsageSchema);
