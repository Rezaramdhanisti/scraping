import { RabbitMq } from "./RabbitMq.js";
import { readFile } from "fs/promises";
import path from "path";

async function publishUrls(){
  try {
    const filePath = path.resolve("./api_urls_10k.json"); // Update with your actual file path
    const urls = JSON.parse(await readFile(filePath, "utf-8"));

    const rabbitmq = await RabbitMq.connect({
      hostname: "localhost",
      password: "guest",
      username: "guest",
      port: 5672,
    });    

    const batchSize = 1000;
    const totalBatches = Math.ceil(urls.length / batchSize);

    const queueName = "shopee-scraper";

    for (let i = 0; i < totalBatches; i++) {
      const batchUrls = urls.slice(i * batchSize, (i + 1) * batchSize);

      // @ts-ignore
      batchUrls.forEach((url, index) => {
        const payload = {
          id: i * batchSize + index + 1, // Unique ID for each message
          batchId: undefined,
          userId: 1,
          token: "943|Jj68208fsTFYZn1Y3A0xUOoPfyCUI6cE0I74z9Cjd079ed01",
          data: {
            url: url,
            step_id: undefined,
            priority: 1,
          },
          type: "api",
        };

        rabbitmq.publish(queueName, JSON.stringify(payload));
      });

      console.log(`✅ Published batch ${i + 1}/${totalBatches}`);
    }

    console.log("🎉 All URLs have been published!");

    

  } catch (error) {
    console.error(error);
  }
}


publishUrls()