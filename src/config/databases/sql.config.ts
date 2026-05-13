import "dotenv/config";
import { PrismaClient } from "@prisma/client";
export const sqlConfig = {
  sqlUri: process.env.MONGO_URI,
};

export const db = new PrismaClient();

export default sqlConfig;
