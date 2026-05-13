import debug, * as Debug from "debug";
import scraperConfig from "../../config/scraper.cofig.js";
import { db } from "../../config/databases/sql.config.js";
import serverConfig from "../../config/server.config.js";
import axios from "axios";

interface TimeUnit {
  step: number;
  name: string;
}

function timeUnit(step: number, name: string): TimeUnit {
  return { step, name };
}
export interface ProxyServer {
  proxy: string;
  weight: number;
}

export interface Proxy {
  id: number;
  provider: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
  weight: number | null;
  active: boolean | null;
}

export interface Browser {
  executablePath: string;
  weight: number;
}

const proxyServers: ProxyServer[] = [
  // { proxy: "uUad2dpnh5B2Blcu:mobile;tw;;;@proxy.froxy.com:9000", weight: 10 },
  // {
  //   proxy:
  //     "df6adf2baa4ded3d7d24__cr.tw:51f4a6d8622b5c1c@gw.dataimpulse.com:823",
  //   weight: 10,
  // },
  // {
  //   proxy: "ps-uxk4vb3rnmvn:6uncHFYwLnbC9uZp@super.proxyshare.com:5959",
  //   weight: 5,
  // },
  // {
  //   proxy: "ps-mrscraper_area-TW:Penapenapena1@proxy.proxyshare.com:5959",
  //   weight: 10,
  // },
  // {
  //   proxy: "fly-mrscraper_area-TW:Penapenapena1@proxy.flyproxy.com:1212",
  //   weight: 10,
  // },
  // {
  //   proxy: "9y7lsGGori6GLLs1:wifi;tw;;;@proxy.soax.com:9000",
  //   weight: 10,
  // },
  {
    proxy:
      "user-mrscraper_D1jvV-region-tw:Penapenapena1@as.8e4yvuq6.lunaproxy.net:12233",
    weight: 25,
  },
  {
    proxy: "ps-mrscraper_area-TW:Penapenapena1@proxy.proxyshare.com:5959",
    weight: 10,
  },
  {
    proxy:
      "adfe2d236e68d12049b6__cr.tw:172f345899ab8476@gw.dataimpulse.com:823",
    weight: 5,
  },
  {
    proxy:
      "J1JDKAJD1293JSA-zone-resi-region-tw:Penapenapena1@4d34cfeb3742706b.wpu.as.pyproxy.io:16666",
    weight: 10,
  },
  {
    proxy: "qjnbv6a2a3sv_area-TW:CLCVEvRflJgK0SeV@us.911proxy.com:2600",
    weight: 20,
  },
  {
    proxy: "37277983-zone-custom-region-TW:THH6kD6Q@f.proxys5.net:6200",
    weight: 30,
  }, // 10%
];

const generateWeightedBrowser = (browsers: Browser[]) => {
  if (!scraperConfig.isUseFirefox) browsers.pop();
  const weightedPath: string[] = [];

  browsers.forEach(({ executablePath, weight }) => {
    for (let i = 0; i < weight; i++) {
      weightedPath.push(executablePath);
    }
  });

  return weightedPath;
};

export let vendors: Proxy[] = [];
export let weightedProxies: Proxy[] = [];

const hasProxyChanges = (a: Proxy[], b: Proxy[]): boolean => {
  const setA = new Set(a.map((item) => JSON.stringify(item)));
  const setB = new Set(b.map((item) => JSON.stringify(item)));

  // Check if setB has any element not in setA or vice versa
  if (setA.size !== setB.size) return true;

  for (const item of setB) {
    if (!setA.has(item)) {
      return true;
    }
  }

  return false;
};
export const generateWeightedProxies = async () => {
  let proxies: Proxy[];
  if (serverConfig.dataMode === "db") {
    proxies = await db.proxy.findMany({
      where: {
        active: true,
      },
    });
  } else {
    const response = await axios.get(serverConfig.apiUrl + "/proxies", {
      headers: {
        "X-Api-Key": serverConfig.apiKey,
      },
    });
    proxies = response.data;
  }
  const isChanges = hasProxyChanges(vendors, proxies);
  if (isChanges) {
    vendors = proxies;
    const temp: Proxy[] = [];

    vendors.forEach((proxy) => {
      for (let i = 0; i < proxy.weight!; i++) {
        temp.push(proxy);
      }
    });

    weightedProxies = proxies;
  }
  return isChanges;
};

const browsers = [
  {
    executablePath: scraperConfig.chromePath,
    weight: parseInt(scraperConfig.chromeWeight),
  },
  {
    executablePath: scraperConfig.bravePath,
    weight: parseInt(scraperConfig.braveWeight),
  },
  {
    executablePath: scraperConfig.operaPath,
    weight: parseInt(scraperConfig.operaWeight),
  },
  {
    executablePath: "firefox",
    weight: parseInt(scraperConfig.firefoxWeight),
  },
];

export const weightedBrowser = generateWeightedBrowser(browsers);

const TIME_UNITS: TimeUnit[] = [
  timeUnit(1, "ms"),
  timeUnit(1000, "seconds"),
  timeUnit(60, "minutes"),
  timeUnit(60, "hours"),
  timeUnit(24, "days"),
  timeUnit(31, "months"),
  timeUnit(365 / 31, "years"),
];

const TIME_UNIT_THRESHOLD = 0.95;

function padDate(value: number | string, num: number): string {
  const str = value.toString();
  if (str.length >= num) {
    return str;
  }
  const zeroesToAdd = num - str.length;
  return "0".repeat(zeroesToAdd) + str;
}

export function formatDateTime(datetime: Date | number): string {
  const date = typeof datetime === "number" ? new Date(datetime) : datetime;

  const dateStr =
    `${date.getFullYear()}` +
    `-${padDate(date.getMonth() + 1, 2)}` +
    `-${padDate(date.getDate(), 2)}`;
  const timeStr =
    `${padDate(date.getHours(), 2)}` +
    `:${padDate(date.getMinutes(), 2)}` +
    `:${padDate(date.getSeconds(), 2)}` +
    `.${padDate(date.getMilliseconds(), 3)}`;

  return `${dateStr} ${timeStr}`;
}

export function formatDuration(millis: number): string {
  if (millis < 0) {
    return "unknown";
  }

  let remaining = millis;
  let nextUnitIndex = 1;
  while (
    nextUnitIndex < TIME_UNITS.length &&
    remaining / TIME_UNITS[nextUnitIndex].step >= TIME_UNIT_THRESHOLD
  ) {
    remaining = remaining / TIME_UNITS[nextUnitIndex].step;
    nextUnitIndex += 1;
  }

  return `${remaining.toFixed(1)} ${TIME_UNITS[nextUnitIndex - 1].name}`;
}

export async function timeoutExecute<T>(
  millis: number,
  promise: Promise<T>,
): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;

  const result = await Promise.race([
    (async () => {
      await new Promise((resolve) => {
        timeout = setTimeout(resolve, millis);
      });
      throw new Error(`Timeout hit: ${millis}`);
    })(),
    (async () => {
      try {
        return await promise;
      } catch (error: any) {
        // Cancel timeout in error case
        clearTimeout(timeout as any as NodeJS.Timeout);
        throw error;
      }
    })(),
  ]);
  clearTimeout(timeout as any as NodeJS.Timeout); // is there a better way?
  return result;
}

export function debugGenerator(namespace: string): Debug.IDebugger {
  const d = debug(`mrscraper:${namespace}`);
  return d;
}

const logToConsole = debug("mrscraper-cluster:log");
logToConsole.log = console.error.bind(console);

export function log(msg: string): void {
  logToConsole(msg);
}
