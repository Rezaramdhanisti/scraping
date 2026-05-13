import {
  PrismaClient,
  User as PrismaUser,
  Account,
  Result,
} from "@prisma/client";
import { debugGenerator } from "../libs/mrscraper-cluster/util.js";
import { ShopeeAPIStatus } from "../utils/scraper.utils.js";
import serverConfig from "../config/server.config.js";
import axios from "axios";

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export interface UserAccount {
  id: string;
  account: Account;
}

export interface UserUsage {
  token_usage: number;
  limit_token: number;
  successful_requests: number;
  failed_requests: number;
}

export const selectUserAccount = {
  id: true,
  account: true,
};

export default class UserRepository {
  account: UserAccount;
  debug = debugGenerator("user-repository");
  db: PrismaClient;
  constructor(user: UserAccount, db: PrismaClient) {
    this.db = db;
    this.account = user;
  }

  async addTokenUsage(tokenUsage: number) {
    try {
      if (serverConfig.dataMode === "db") {
        await this.db.$transaction(
          async (tx) => {
            await tx.$executeRawUnsafe(
              `SELECT "token_usage" FROM "Account" WHERE "id" = $1 FOR UPDATE`,
              this.account.account.id,
            );

            await tx.$executeRawUnsafe(
              `UPDATE "Account" SET "token_usage" = "token_usage" + $1 WHERE "id" = $2`,
              tokenUsage,
              this.account.account.id,
            );
          },
          {
            maxWait: 10000,
            timeout: 15000,
          },
        );

        this.account = (await this.db.user.findUnique({
          where: { id: this.account.id },
          select: selectUserAccount,
        })) as UserAccount;
      } else {
        const response = await axios.post(
          serverConfig.apiUrl + "/add-token-usage",
          {
            tokenUsage,
            accountId: this.account.account.id,
            userId: this.account.id,
          },
          {
            headers: {
              "X-Api-Key": serverConfig.apiKey,
            },
          },
        );

        this.account = response.data;
      }

      this.debug("Token usage updated", this.account.account.token_usage);
      return { success: true, message: "Token usage updated" };
    } catch (error) {
      this.debug("Add Token Usage Error:", error);
      throw new UserError("Failed to update token usage");
    }
  }

  async createJob(status: ShopeeAPIStatus) {
    try {
      const job = await this.db.job.create({
        data: {
          status,
        },
      });
      return job;
    } catch (error) {
      this.debug("Create Job Error:", error);
      throw new UserError("Failed to create job");
    }
  }
  async createResult(
    status: ShopeeAPIStatus,
    url: string,
    error?: string,
    ip?: string,
    proxy_id?: number,
    job_id?: number,
    step_id?: string,
    priority?: number,
  ): Promise<Result> {
    try {
      let result: Result;
      if (serverConfig.dataMode === "db") {
        result = await this.db.result.create({
          data: {
            url,
            status,
            error,
            user_id: this.account.id,
            ip,
            proxy_id,
            job_id,
            stepId: step_id,
            priority,
            updatedAt: new Date(),
          },
        });
      } else {
        const response = await axios.post(
          serverConfig.apiUrl + "/create-result",
          {
            url,
            status,
            error,
            userId: this.account.id,
            ip,
            proxyId: proxy_id,
            jobId: job_id,
            stepId: step_id,
            priority,
          },
          {
            headers: {
              "X-Api-Key": serverConfig.apiKey,
            },
          },
        );
        result = response.data;
      }
      return result;
    } catch (error) {
      this.debug("Create Result Error:", error);
      throw new UserError("Failed to create result");
    }
  }

  async logResult(
    status: ShopeeAPIStatus,
    url: string,
    error?: string,
    ip?: string,
    proxy_id?: number,
  ): Promise<Result> {
    try {
      let result: Result;
      if (serverConfig.dataMode === "db") {
        result = await this.db.result.create({
          data: {
            url,
            status,
            error,
            type: "SYNC",
            user_id: this.account.id,
            ip,
            proxy_id,
            updatedAt: new Date(),
          },
        });
      } else {
        const response = await axios.post(
          serverConfig.apiUrl + "/log-result",
          {
            url,
            status,
            error,
            type: "SYNC",
            userId: this.account.id,
            ip,
            proxyId: proxy_id,
          },
          {
            headers: {
              "X-Api-Key": serverConfig.apiKey,
            },
          },
        );
        result = response.data;
      }
      return result;
    } catch (error) {
      this.debug("Log Result Error:", error);
      throw new UserError("Failed to log result");
    }
  }

  async resetTokenUsage() {
    try {
      await this.db.account.update({
        where: {
          id: this.account.account.id,
        },
        data: {
          token_usage: 0,
        },
      });
    } catch (error) {
      this.debug("Reset Token Usage Error:", error);
      throw new UserError("Failed to reset token");
    }
  }

  async usage(
    start: Date | undefined = new Date(
      new Date().getTime() - 24 * 60 * 60 * 1000,
    ), // 24 hours ago
    end: Date | undefined = new Date(),
  ) {
    try {
      const user = await this.db.account.findUnique({
        where: {
          id: this.account.account.id,
        },
        select: {
          token_usage: true,
          token_limit: true,
          User: {
            select: {
              Result: {
                where: {
                  createdAt: { gte: start, lte: end },
                  status: { not: "PENDING" },
                },
              },
            },
          },
        },
      });
      let successful_requests = 0;
      let failed_requests = 0;
      for (const token of user!.User) {
        successful_requests += token.Result.filter(
          (result: { status: string }) => result.status === "SUCCESS",
        ).length;
        failed_requests += token.Result.filter(
          (result: { status: string }) => result.status !== "SUCCESS",
        ).length;
      }
      const data: UserUsage = {
        token_usage: user!.token_usage,
        limit_token: user!.token_limit,
        successful_requests,
        failed_requests,
      };

      return data;
    } catch (error) {
      this.debug("Get User Usage Error:", error);
      throw new UserError("Failed to get user usage");
    }
  }
}
