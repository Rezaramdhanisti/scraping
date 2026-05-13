import ampq, { Channel, Connection } from "amqplib";
import { TiktokError } from "../../utils/scraper.utils.js";
export class RMQError extends Error {
  name: string;
  layer: string;
  constructor(layer: string, message: string) {
    super(message);
    this.name = "RMQError";
    this.layer = layer;
  }
}
export class RabbitMq {
  connection: Connection | null = null;
  channel: Channel | null = null;
  consumers = new Map<string, string>();

  constructor(connection: Connection, channel: Channel) {
    this.connection = connection;
    this.channel = channel;
  }

  static async connect(
    opts: ampq.Options.Connect,
    prefetch: number = 1,
  ): Promise<RabbitMq> {
    return await new Promise(async (resolve, reject) => {
      try {
        const connect = await ampq.connect(opts);
        const channel = await connect.createChannel();
        await channel.prefetch(prefetch);
        resolve(new RabbitMq(connect, channel));
      } catch (error) {
        reject(error);
      }
    });
  }

  publish(queue: string, message: string) {
    if (!this.channel) {
      throw new RMQError("Constructor", "Connection or channel is null");
    }
    this.channel.assertQueue(queue, { durable: true });
    this.channel.sendToQueue(queue, Buffer.from(message), {
      persistent: true,
      expiration: 30 * 60 * 1000, // 30 minutes
    }); // persistent: true will make sure that the message is not lost even if the RabbitMQ server crashes
    console.log(" [x] Sent %s", message);
  }

  async consume(queue: string, callback: (msg: string) => Promise<void>) {
    if (!this.channel) {
      throw new RMQError("Constructor", "Connection or channel is null");
    }
    this.channel.assertQueue(queue, { durable: true });
    console.log(" [*] Waiting for messages in %s. To exit press CTRL+C", queue);
    const consumer = await this.channel.consume(queue, async (msg) => {
      if (!this.channel) throw new RMQError("Consumer", "Channel is null");
      try {
        if (!msg) throw new RMQError("Consumer", "Message is null");
        const content = msg.content.toString();
        console.log(" [x] Received:", content);
        try {
          await callback(content);
        } catch (error: any) {
          if (error instanceof TiktokError) {
            // just ack the message if it's a ShopeeError
          } else {
            throw new RMQError("Consumer", error.message);
          }
        }
        this.channel.ack(msg);
        console.log(" [x] Done");
      } catch (error: any) {
        if (!msg) return console.trace(`[CONSUMER] Message is null`);
        this.channel.nack(msg); // requeue the message
        console.trace(
          `[CONSUMER ERROR] Error consuming message: ${error.message}`,
        );
      }
    });
    this.consumers.set(queue, consumer.consumerTag);
    return consumer;
  }
}
