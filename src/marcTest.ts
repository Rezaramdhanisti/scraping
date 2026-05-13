import axios from "axios";
import scraperConfig from "./config/scraper.cofig.js";
import fs from "fs";

const getProxyConfigs = async () => {
  const url = "https://continuous-scraper.common.chartedapi.com/proxy-configs";
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${scraperConfig.thirdParty.thirdPartyToken}`,
      },
    });
    console.log("Response data:", JSON.stringify(response.data));
  } catch (error) {
    console.error("Error fetching proxy configs:", error);
  }
};

const postProxyConfigs = async () => {
  try {
    const data = [
      {
        scraper: "SHOPEE",
        proxySettings: [
          {
            type: "RESIDENTIAL",
            urls: [
              "http://user-mrscraper_marc_Y7ndC-region-${country(case=LOWER)}-sessid-${country(case=LOWER)}b9lx7f413mv3${rand(len=4,use=[digit])}-sesstime-10:Mrscraper123@yh7sb5eu.as.piaproxy.co:5000",
              "http://td-customer-MrscraperMarc-country-${country(case=LOWER)}-sessid-${country(case=LOWER)}xb2x93hso2pe${rand(len=3,use=[digit])}-sesstime-10:Mrscraper123@6n8xhsmh.as.thordata.net:9999",
              "http://mrscrapermarc1-zone-resi-region-${country(case=LOWER)}-session-${rand(len=12,use=[lowerCaseChar,digit])}-sessTime-10:Mrscraper123@4d34cfeb3742706b.wpu.as.pyproxy.io:16666",
              "http://mpuSMHbGJM-country-${country(case=LOWER)}-type-common-session-${rand(len=6,use=[upperCaseChar,digit])}-sessionttl-10:JoIawiGZ1UUxhO21dv3n@network.joinmassive.com:65534",
              "http://mrscrapermarc-zone-custom-region-${country(case=UPPER)}-sessid-${rand(len=8,use=[upperCaseChar, lowerCaseChar, digit])}-sessTime-10:Mrscraper123@as.proxys5.net:6200",
            ],
          },
          {
            type: "RESIDENTIAL",
            country: "TW",
            urls: [
              "http://user-mrscraper_marc_Y7ndC-region-tw-sessid-twb9lx7f413mv3${rand(len=4,use=[digit])}-sesstime-10:Mrscraper123@yh7sb5eu.as.piaproxy.co:5000",
              "http://td-customer-MrscraperMarc-country-tw-sessid-twxb2x93hso2pe${rand(len=3,use=[digit])}-sesstime-10:Mrscraper123@6n8xhsmh.as.thordata.net:9999",
              "http://mrscrapermarc1-zone-resi-region-tw-session-${rand(len=12,use=[lowerCaseChar,digit])}-sessTime-10:Mrscraper123@4d34cfeb3742706b.wpu.as.pyproxy.io:16666",
              "http://mpuSMHbGJM-country-tw-type-common-session-${rand(len=6,use=[upperCaseChar,digit])}-sessionttl-10:JoIawiGZ1UUxhO21dv3n@network.joinmassive.com:65534",
              "http://mrscrapermarc-zone-custom-region-tw-sessid-${rand(len=8,use=[upperCaseChar, lowerCaseChar, digit])}-sessTime-10:Mrscraper123@as.proxys5.net:6200",
              "http://user-mrscraper_marc_Y7ndC-region-kr-sessid-krb9lx7f413mv3${rand(len=4,use=[digit])}-sesstime-10:Mrscraper123@yh7sb5eu.as.piaproxy.co:5000",
              "http://td-customer-MrscraperMarc-country-kr-sessid-twxb2x93hso2pe${rand(len=3,use=[digit])}-sesstime-10:Mrscraper123@6n8xhsmh.as.thordata.net:9999",
              "http://mrscrapermarc1-zone-resi-region-kr-session-${rand(len=12,use=[lowerCaseChar,digit])}-sessTime-10:Mrscraper123@4d34cfeb3742706b.wpu.as.pyproxy.io:16666",
              "http://mpuSMHbGJM-country-kr-type-common-session-${rand(len=6,use=[upperCaseChar,digit])}-sessionttl-10:JoIawiGZ1UUxhO21dv3n@network.joinmassive.com:65534",
              "http://mrscrapermarc-zone-custom-region-kr-sessid-${rand(len=8,use=[upperCaseChar, lowerCaseChar, digit])}-sessTime-10:Mrscraper123@as.proxys5.net:6200",
              "http://user-mrscraper_marc_Y7ndC-region-jp-sessid-jpb9lx7f413mv3${rand(len=4,use=[digit])}-sesstime-10:Mrscraper123@yh7sb5eu.as.piaproxy.co:5000",
              "http://td-customer-MrscraperMarc-country-jp-sessid-jpxb2x93hso2pe${rand(len=3,use=[digit])}-sesstime-10:Mrscraper123@6n8xhsmh.as.thordata.net:9999",
              "http://mrscrapermarc1-zone-resi-region-jp-session-${rand(len=12,use=[lowerCaseChar,digit])}-sessTime-10:Mrscraper123@4d34cfeb3742706b.wpu.as.pyproxy.io:16666",
              "http://mpuSMHbGJM-country-jp-type-common-session-${rand(len=6,use=[upperCaseChar,digit])}-sessionttl-10:JoIawiGZ1UUxhO21dv3n@network.joinmassive.com:65534",
              "http://mrscrapermarc-zone-custom-region-jp-sessid-${rand(len=8,use=[upperCaseChar, lowerCaseChar, digit])}-sessTime-10:Mrscraper123@as.proxys5.net:6200",
            ],
          },
        ],
      },
    ];
    const url =
      "https://continuous-scraper.common.chartedapi.com/proxy-configs";
    const response = await axios.put(url, data, {
      headers: {
        Authorization: "Bearer " + scraperConfig.thirdParty.thirdPartyToken,
      },
    });
    console.log("Response data:", response.data);
  } catch (error) {
    console.error("Error posting proxy configs:", error);
  }
};

const postScraper = async (keyword: string) => {
  try {
    const data = {
      url: "https://shopee.co.id/api/v4/search/search_items?keyword=" + keyword,
    };
    const url =
      "https://continuous-scraper.common.chartedapi.com/scraping-tasks/shopee/run-single?autoCancelAfterSec=1200";
    const response = await axios.post(url, data, {
      headers: {
        Authorization: "Bearer " + scraperConfig.thirdParty.thirdPartyToken,
      },
    });
    console.log("Response data:", response.data);
  } catch (error) {
    console.error("Error posting scraper:", error);
  }
};
const getListProduct = async () => {
  try {
    const data = {
      requests: [
        {
          url: "https://shopee.co.id/api/v4/item/get_list",
          method: "POST",
          payload: {
            source: "microsite_individual_product",
            shop_item_ids: [{ item_id: 28524613529, shop_id: 1458346143 }],
          },
        },
      ],
    };
    const url =
      "https://continuous-scraper.common.chartedapi.com/scraping-tasks/shopee/run?autoCancelAfterSec=1200";
    const response = await axios.post(url, data, {
      headers: {
        Authorization: "Bearer " + scraperConfig.thirdParty.thirdPartyToken,
      },
    });
    const responseBody = JSON.parse(response.data[0].responseBody);
    console.log("Response data:", response.data);
    fs.writeFileSync("response.json", JSON.stringify(responseBody, null, 2));
  } catch (error) {
    console.error("Error posting scraper:", error);
  }
};
await getListProduct();
// await postProxyConfigs();
// await getProxyConfigs();
// postScraper("shoes");
// postScraper("tshirt");
// postScraper("iphone 14 pro max");
// postScraper("samsung");
// postScraper("mac");
// postScraper("jeans");
// postScraper("pants");
// postScraper("hoodie");
// postScraper("hat");
