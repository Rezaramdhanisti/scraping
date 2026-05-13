import platformConfig from "../config/platform.config.js";
import { AccountInfo } from "../interfaces/platform.interface.js";
import { debugGenerator } from "../libs/mrscraper-cluster/util.js";

const apiUrl = platformConfig.platformApiUrl + "/account";
const debug = debugGenerator("platform-utils");
export async function getAccountInfo(token: string) {
  debug("Validate API URL:", apiUrl);
  const bearer = "Bearer " + token;
  debug("Bearer:", bearer);

  const res = await fetch(apiUrl, {
    headers: {
      Authorization: bearer,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    debug("response:", res);
    return null;
  }

  const data: { data: AccountInfo } = await res.json();
  debug("result:", JSON.stringify(data, null, 2));
  return data.data;
}
