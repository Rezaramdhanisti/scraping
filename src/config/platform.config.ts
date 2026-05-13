import "dotenv/config";
export const platformConfig = {
  platformApiUrl: process.env.PLATFORM_API_URL,
  platformWebhookSecret: process.env.PLATFORM_WEBHOOK_SECRET,
};

export default platformConfig;
