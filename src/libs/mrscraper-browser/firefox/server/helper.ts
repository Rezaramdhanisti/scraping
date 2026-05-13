/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { EventEmitter } from "events";
import type * as types from "./types.js";
import type { Progress } from "./progress.js";
import { debugLogger } from "../utils.js";
import type { RegisteredListener } from "../utils.js";
import { eventsHelper } from "../utils.js";

const MAX_LOG_LENGTH = process.env.MAX_LOG_LENGTH
  ? +process.env.MAX_LOG_LENGTH
  : Infinity;

class Helper {
  static blackList = [
    "*.css",
    "*.jpg",
    "*.png",
    "*.gif",
    "*.ico",
    "*.otf",
    "*.woff",
    "*.ttf",
    "*.svg",
    "*.mp4",
    "*.webm",
    "*doubleclick.net*",
    "*optimizationguide-pa.googleapis.com*",
    "*youtube.com*",
    "*down-tx-sg.vod.susercontent.com*",
    "*down-tw.img.susercontent.com*",
    "*down-aka-sg.vod.susercontent.com*",
    "*googletagmanager.com*",
    "*connect.facebook.net*",
    "*down-aka-sg.img.susercontent.com*",
    "*fonts.gstatic.com*",
    "*content-autofill.googleapis.com*",
    "*ampcid.google.com*",
    "*adservice.google.com*",
    "*i.ytimg.com*",
    "*jnn-pa.googleapis.com*",
    "*play.google.com*",
    "*ads.pubmatic.com*",
    "*image2.pubmatic.com*",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/0f809488d5de0535ce4e.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/webpack-runtime.7ab34ae5ed7c3ff5.js",
    // "https://deo.shopeemobile.com/shopee/shopee-trackingsdk-live-sg/amd/@shopee/tracking-core@8d6cd7d.min.js",
    // "https://dem.shopee.com/dem/kose/v1/apps/pc-pdp/configs/_fetch",
    // "https://ubt.tracking.shopee.co.id/v4/event_batch",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col178.1731569174.json",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/NormalPdpMain.b77270cbf82c1565872c.js",
    // "https://deo.shopeemobile.com/shopee/modules-federation/live/0/stardust__focus-trap/2.0.1.js",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col63.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/shopee-trackingsdk-live-sg/amd/@shopee/tracking-algo@8d6cd7d.min.js",
    // "https://deo.shopeemobile.com/shopee/shopee-trackingsdk-live-sg/amd/@shopee/tracking-ubt@8d6cd7d.min.js",
    // "https://deo.shopeemobile.com/shopee/shopee-trackingsdk-live-sg/require-trackingsdk.js",
    // "https://shopee.co.id/api/v4/account/report_client_info",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/1104.c998ce18820195c4ec8d.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/6542.0fcc7de8ca24ee822e0a.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/6116.e7e1a9bace3359dab3ff.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/6487.6306239c711dcba1479b.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/b4fffc5b419c2be64117.tr.js",
    // "data:image*",
    //
    // "https://df.infra.sz.shopee.co.id/v2/shpsec/web/report",
    // "https://df.infra.shopee.tw/v2/shpsec/web/report",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/14d2aa61f4adc9d10cdc.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/ee7010f8ea48092db564.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/e7950508cd053d55650c.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/5badef1325e3b1975452.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/8d993460137c85867510.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/b4b05138cef887bfc6b2.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/e8e65c61d62afd04.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/08daa21d909332f18a96.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/3783.12da4743a3bd5a18.js", // login
    // "*content.garena.com*",
    // "https://deo.shopeemobile.com/shopee/modules-federation/live/0/shopee__language/1.1.19.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/60128832cef445a2.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/PageAuthentication.3787b1175039a212.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/9513.e6ecbadeb2ee4d26.js",
    // "https://dem.shopee.com/dem/kose/v1/apps/pc-platform/configs/_fetch",
    // "https://shopee.tw/api/v4/account/basic/get_payment_info",
    // "https://deo.shopeemobile.com/shopee/shopee-trackingsdk-live-sg/@shopee/tracking-loader@1.1.23.min.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/6e45ec1f3adbeb7a.tr.js",
    // // "https://deo.shopeemobile.com/shopee/stm-sg-live/32931/asset-TW-live.b60c0f615409444f4d383c835f82b87a.json",
    // // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/pcmall-productdetailspage.c6ea976a547add4d183f.js",
    // // "https://deo.shopeemobile.com/shopee/modules-federation/live/0/shopee_common__time/2.3.2.js",
    // // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/pcmall-productdetailspage.c6ea976a547add4d183f.js", // 111k
    // // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/bundle.9beaad99f354ff18.js",
    // // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.*.json",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/3c0ad9eee0f5cacd41be.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/9fda73ee3e42c75c322d.tr.js",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/dc814ed996218140166a.tr.js",
    // // tw
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col63.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col59.1731664907.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col44.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col58.1729949736.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col178.1732522343.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col134.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col61.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col119.1729872493.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col115.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col60.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col22.1715652753.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col46.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col45.1731571552.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col34.1719371099.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col159.1732169154.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col35.1732188568.json",
    // // id
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col59.1731657048.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col58.1729949736.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col178.1732522343.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col61.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col119.1729872493.json",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col46.1711520003.json",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/productdetailspage/5d9c0603ee257e89c7e3.tr.js",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/id.col119.1729872493.json",
    // "https://deo.shopeemobile.com/shopee/modules-federation/live/0/shopee__web_enhance_sap/2.21.13.js",
    // "https://dem.shopee.com/dem/janus/v1/app-auth/login",
    // "https://deo.shopeemobile.com/shopee/modules-federation/live/0/react-helmet-async/1.0.10--shopee.3.js'",
    // "https://deo.shopeemobile.com/shopee/shopee-pcmall-live-sg/assets/8695.1655f562d7acdd75.js",
    // "https://deo.shopeemobile.com/shopee/stm-sg-live/shopee-pcmall-live-sg/zh-hant.col179.1711520003.json",
  ];
  static completeUserURL(urlString: string): string {
    if (urlString.startsWith("localhost") || urlString.startsWith("127.0.0.1"))
      urlString = "http://" + urlString;
    return urlString;
  }

  static enclosingIntRect(rect: types.Rect): types.Rect {
    const x = Math.floor(rect.x + 1e-3);
    const y = Math.floor(rect.y + 1e-3);
    const x2 = Math.ceil(rect.x + rect.width - 1e-3);
    const y2 = Math.ceil(rect.y + rect.height - 1e-3);
    return { x, y, width: x2 - x, height: y2 - y };
  }

  static enclosingIntSize(size: types.Size): types.Size {
    return {
      width: Math.floor(size.width + 1e-3),
      height: Math.floor(size.height + 1e-3),
    };
  }

  static getViewportSizeFromWindowFeatures(
    features: string[],
  ): types.Size | null {
    const widthString = features.find((f) => f.startsWith("width="));
    const heightString = features.find((f) => f.startsWith("height="));
    const width = widthString ? parseInt(widthString.substring(6), 10) : NaN;
    const height = heightString ? parseInt(heightString.substring(7), 10) : NaN;
    if (!Number.isNaN(width) && !Number.isNaN(height)) return { width, height };
    return null;
  }

  static waitForEvent(
    progress: Progress | null,
    emitter: EventEmitter,
    event: string | symbol,
    predicate?: Function,
  ): { promise: Promise<any>; dispose: () => void } {
    const listeners: RegisteredListener[] = [];
    const promise = new Promise((resolve, reject) => {
      listeners.push(
        eventsHelper.addEventListener(emitter, event, (eventArg) => {
          try {
            console.log("eventArg", eventArg);
            if (predicate && !predicate(eventArg)) return;
            eventsHelper.removeEventListeners(listeners);
            resolve(eventArg);
          } catch (e) {
            eventsHelper.removeEventListeners(listeners);
            reject(e);
          }
        }),
      );
    });
    const dispose = () => eventsHelper.removeEventListeners(listeners);
    if (progress) progress.cleanupWhenAborted(dispose);
    return { promise, dispose };
  }

  static secondsToRoundishMillis(value: number): number {
    return ((value * 1000000) | 0) / 1000;
  }

  static millisToRoundishMillis(value: number): number {
    return ((value * 1000) | 0) / 1000;
  }

  static debugProtocolLogger(
    protocolLogger?: types.ProtocolLogger,
  ): types.ProtocolLogger {
    return (direction: "send" | "receive", message: object) => {
      if (protocolLogger) protocolLogger(direction, message);
      if (debugLogger.isEnabled("protocol")) {
        let text = JSON.stringify(message);
        if (text.length > MAX_LOG_LENGTH)
          text =
            text.substring(0, MAX_LOG_LENGTH / 2) +
            " <<<<<( LOG TRUNCATED )>>>>> " +
            text.substring(text.length - MAX_LOG_LENGTH / 2);
        debugLogger.log(
          "protocol",
          (direction === "send" ? "SEND ► " : "◀ RECV ") + text,
        );
      }
    };
  }

  static formatBrowserLogs(logs: string[], disconnectReason?: string) {
    if (!disconnectReason && !logs.length) return "";
    return (
      "\n" + (disconnectReason ? disconnectReason + "\n" : "") + logs.join("\n")
    );
  }
}

export const helper = Helper;
