import { URL } from "url";
import { TaskFunction } from "../mrscraper-cluster/Cluster.js";
import scraperConfig from "../../config/scraper.cofig.js";

export type ExecuteResolve = (value?: any) => void;
export type ExecuteReject = (reason?: any) => void;
export interface ExecuteCallbacks {
  resolve: (value?: any) => void;
  reject: ExecuteReject;
}

export default class Job<JobData, ReturnData> {
  public userId: number | undefined;
  public id: number | undefined;
  public batchId: number | undefined;
  public token: string | undefined;
  public data?: JobData;
  public expiredAt: Date | undefined;
  public isRetry: boolean = false;

  private lastError: Error | null = null;
  public tries: number = 0;

  public constructor(
    id?: number,
    batchId?: number,
    userId?: number,
    token?: string,
    data?: JobData,
  ) {
    this.token = token;
    this.userId = userId;
    this.batchId = batchId;
    this.id = id;
    this.data = data;
    this.expiredAt = new Date(
      Date.now() + parseInt(scraperConfig.jobTimeoutMins) * 60 * 1000,
    );
  }

  public getUrl(): string | undefined {
    if (!this.data) {
      return undefined;
    }
    if (typeof this.data === "string") {
      return this.data;
    }
    if (typeof (this.data as any).url === "string") {
      return (this.data as any).url;
    }
    return undefined;
  }

  public getDomain(): string | undefined {
    // TODO use tld.js to restrict to top-level domain?
    const urlStr = this.getUrl();
    if (urlStr) {
      try {
        const url = new URL(urlStr);
        return url.hostname || undefined;
      } catch (e: any) {
        // if urlStr is not a valid URL this might throw
        // but we leave this to the user
        return undefined;
      }
    }
    return undefined;
  }

  public addError(error: Error): void {
    this.tries += 1;
    this.lastError = error;
  }
}
