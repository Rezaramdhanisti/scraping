/**
 * @license
 * Copyright 2018 Google Inc.
 * SPDX-License-Identifier: Apache-2.0
 */
import WebSocket from "ws";

import type { ConnectionTransport } from "../common/ConnectionTransport.js";
import { blackList } from "../utils.js";

/**
 * @internal
 */
export class NodeWebSocketTransport implements ConnectionTransport {
  static create(
    url: string,
    // headers?: Record<string, string>,
  ): Promise<NodeWebSocketTransport> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);

      ws.addEventListener("open", () => {
        console.log("Open");
        ws.send(
          JSON.stringify({
            id: 1,
            method: "Fetch.enable",
            params: {
              handleAuthRequests: true,
            },
          }),
        );

        ws.send(
          JSON.stringify({
            id: 2,
            method: "Network.enable",
            params: {},
          }),
        );

        ws.send(
          JSON.stringify({
            id: 4,
            method: "Network.setBlockedURLs",
            params: {
              urls: blackList,
            },
          }),
        );
        return resolve(new NodeWebSocketTransport(ws));
      });
      ws.addEventListener("error", reject);
    });
  }

  #ws: WebSocket;
  onmessage?: (message: WebSocket.Data) => void;
  onclose?: () => void;

  constructor(
    ws: WebSocket,
    onmessage?: (message: WebSocket.Data) => void,
    onclose?: () => void,
  ) {
    this.#ws = ws;
    this.onmessage = onmessage;
    this.onclose = onclose;
    this.#ws.addEventListener("message", (event) => {
      if (this.onmessage) {
        this.onmessage.call(null, event.data);
      }
    });
    this.#ws.addEventListener("close", () => {
      if (this.onclose) {
        this.onclose.call(null);
      }
    });
    // Silently ignore all errors - we don't know what to do with them.
    this.#ws.addEventListener("error", () => {});
  }

  send(message: string): void {
    this.#ws.send(message);
  }

  close(): void {
    this.#ws.close();
  }
}
