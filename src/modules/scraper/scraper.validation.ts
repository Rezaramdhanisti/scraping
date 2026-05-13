import { z } from "zod";
import { validate } from "../../utils/request.utils.js";
import { pack } from "tar-fs";
const ScrapeSyncSchema = z.object({
  body: z.object({
    url: z.string().url({ message: "Invalid URL" }),
    intercept_endpoint: z.string().optional(),
  }),
});
const TiktokSyncSchema = z.object({
  body: z.object({
    poi_id: z.string(),
    language: z.string().optional(),
    country: z.string().optional(),
    checkinDate: z.string().optional(),
    checkoutDate: z.string().optional(),
    adult: z.string().optional(),
  }),
});
const TestCookieSyncSchema = z.object({
  body: z.object({
    cookie: z.string(),
  }),
});
const ScrapeBatchSchema = z.object({
  body: z.object({
    urls: z.array(
      z.object({
        url: z.string().url({ message: "Invalid URL" }),
        step_id: z.string().optional(),
        priority: z.number().optional(),
      }),
    ),
  }),
});
const ScrapeBatchResultSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});
const UpdateProxySchema = z.object({
  body: z.object({
    provider: z.string(),
    hostname: z.string(),
    port: z.number(),
    username: z.string(),
    password: z.string(),
    weight: z.number(),
  }),
  params: z.object({
    id: z.string(),
  }),
});
const DeleteProxySchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

const ShopeeProxiesConfigSchema = z.object({
  body: z.array(
    z.object({
      provider: z.string(),
      hostname: z.string(),
      port: z.number(),
      username: z.string(),
      password: z.string(),
      weight: z.number(),
    }),
  ),
});

export const deleteProxyValidation = validate(DeleteProxySchema);
export const updateProxyValidation = validate(UpdateProxySchema);
export const shoppeProxiesConfigValidation = validate(
  ShopeeProxiesConfigSchema,
);
export const scrapeBatchResultValidation = validate(ScrapeBatchResultSchema);

export const scrapeBatchValidation = validate(ScrapeBatchSchema);
export const scrapeSyncValidation = validate(ScrapeSyncSchema);
export const TiktokSyncValidation = validate(TiktokSyncSchema);
export const TestCookieValidation = validate(TestCookieSyncSchema);
