import { Proxy } from "@prisma/client";
import { db } from "../../config/databases/sql.config.js";

const defaultUser = [
  {
    account_id: 1,
    id: "943|Jj68208fsTFYZn1Y3A0xUOoPfyCUI6cE0I74z9Cjd079ed01",
    token_usage: 0,
    limit_token: 100000000,
  },
];

const defaultProxyVendor = [
  {
    provider: "proxys5",
    hostname: "f.proxys5.net",
    port: 6200,
    username: "37277983-zone-custom-region-TW",
    password: "THH6kD6Q",
  },
  {
    provider: "911proxy",
    hostname: "us.911proxy.com",
    port: 2600,
    username: "qjnbv6a2a3sv_area-TW",
    password: "CLCVEvRflJgK0SeV",
  },
  {
    provider: "pyproxy",
    hostname: "4d34cfeb3742706b.wpu.as.pyproxy.io",
    port: 16666,
    username: "J1JDKAJD1293JSA-zone-resi-region-tw",
    password: "Penapenapena1",
  },
  {
    provider: "dataimpulse",
    hostname: "gw.dataimpulse.com",
    port: 823,
    username: "adfe2d236e68d12049b6__cr.tw",
    password: "172f345899ab8476",
  },
  {
    provider: "proxyshare",
    hostname: "proxy.proxyshare.com",
    port: 5959,
    username: "ps-mrscraper_area-TW",
    password: "Penapenapena1",
  },
  {
    provider: "lunaproxy",
    hostname: "as.8e4yvuq6.lunaproxy.net",
    port: 12233,
    username: "user-mrscraper_D1jvV-region-tw",
    password: "Penapenapena1",
  },
];
async function main() {
  const now = new Date();
  await db.proxy.createMany({
    data: defaultProxyVendor.map((p) => ({ ...p, updatedAt: now })),
  });
  await db.account.create({
    data: {
      token_usage: 0,
      token_limit: 100000000,
      subscription_plan: "enterprise",
      updatedAt: now,
    },
  });
  await db.user.createMany({
    data: defaultUser,
  });
}

main()
  .then(async () => {
    console.log("Seed complete");
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed error", error);
    await db.$disconnect();
    process.exit(1);
  });
