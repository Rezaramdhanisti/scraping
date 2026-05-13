import "dotenv/config";
export interface ScraperConfig {
  proxyUrl: string;
  browserWSEndpoint: string;
  sessionTimeout: string;
  concurrency: string;
  browserWeight: string;
  chromePath: string;
  bravePath: string;
  firefoxWeight: string;
  operaPath: string;
  isOnlyChrome: string;
  isUseFirefox: string;
  chromeWeight: string;
  braveWeight: string;
  operaWeight: string;
  fingerprintPath: string;
  fingerprintUtilPath: string;
  firefoxLibPath: string;
  jobTimeoutMins: string;
  solutionId: number;
  thirdParty: {
    thirdPartyApi: string;
    thirdPartyToken: string;
    thirdPartyOpt: string;
  };
}
export const scraperConfig: ScraperConfig = {
  solutionId: Number(process.env.SOLUTION_ID),
  proxyUrl: process.env.PROXY_URL!,
  browserWSEndpoint: process.env.BROWSER_WS_ENDPOINT!,
  sessionTimeout: process.env.BROWSER_WS_TTL!,
  concurrency: process.env.BROWSER_WS_CONCURRENCY!,
  browserWeight: process.env.BROWSER_WEIGHT!,
  chromePath: process.env.CHROME_PATH!,
  operaPath: process.env.OPERA_PATH!,
  firefoxLibPath: process.env.FIREFOX_LIBRARY_PATH!,
  fingerprintPath: process.env.FINGERPRINT_PATH!,
  fingerprintUtilPath: process.env.FINGERPRINT_UTIL_PATH!,
  isOnlyChrome: process.env.ONLY_CHROME!,
  isUseFirefox: process.env.USE_FIREFOX!,
  chromeWeight: process.env.CHROME_WEIGHT!,
  braveWeight: process.env.BRAVE_WEIGHT!,
  firefoxWeight: process.env.FIREFOX_WEIGHT!,
  jobTimeoutMins: process.env.JOB_TIMEOUT!,
  operaWeight: process.env.OPERA_WEIGHT!,
  bravePath: process.env.BRAVE_PATH!,
  thirdParty: {
    thirdPartyApi: process.env.THIRD_PARTY_API!,
    thirdPartyToken: process.env.THIRD_PARTY_TOKEN!,
    thirdPartyOpt: process.env.THIRD_PARTY_OPT!
  },
};

export default scraperConfig;
