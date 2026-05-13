import { readFileSync } from "fs";

import {
  BrowserFingerprintWithHeaders,
  Fingerprint,
  FingerprintGenerator,
  FingerprintGeneratorOptions,
} from "./fingerprint-generator.js";
import { Page, Browser as PPBrowser } from "puppeteer";
import { __dirname } from "../../../index.js";
import { Connection } from "../cdp/Connection.js";
import scraperConfig from "../../../config/scraper.cofig.js";

interface EnhancedFingerprint extends Fingerprint {
  userAgent: string;
  historyLength: number;
}

declare function overrideInstancePrototype<T>(
  instance: T,
  overrideObj: Partial<T>,
): void;
declare function overrideDeviceMemory(deviceMemory: number): void;
declare function overrideUserAgentData(
  userAgentData: Record<string, string>,
): void;
declare function overrideDocumentDimensionsProps(
  props: Record<string, number>,
): void;
declare function overrideWindowDimensionsProps(
  props: Record<string, number>,
): void;
declare function overrideBattery(
  batteryInfo?: Record<string, string | number>,
): void;
declare function overrideCodecs(
  audioCodecs: Record<string, string>,
  videoCodecs: Record<string, string>,
): void;
declare function overrideWebGl(webGlInfo: Record<string, string>): void;
declare function overrideIntlAPI(language: string): void;
declare function overrideStatic(): void;
declare function runHeadlessFixes(): void;
declare function blockWebRTC(): void;

/**
 * Fingerprint injector class.
 * @class
 */
export class FingerprintInjector {
  private utilsJs = this._loadUtils();

  /**
   * Some HTTP headers depend on the request (for example Accept (with values application/json, image/png) etc.).
   *  This function filters out those headers and leaves only the browser-wide ones.
   * @param headers Headers to be filtered.
   * @returns Filtered headers.
   */
  private onlyInjectableHeaders(
    headers: Record<string, string>,
    browserName?: string,
  ): Record<string, string> {
    const requestHeaders = [
      "accept-encoding",
      "accept",
      "cache-control",
      "pragma",
      "sec-fetch-dest",
      "sec-fetch-mode",
      "sec-fetch-site",
      "sec-fetch-user",
      "upgrade-insecure-requests",
    ];

    const filteredHeaders = { ...headers };

    requestHeaders.forEach((header) => {
      delete filteredHeaders[header];
    });

    // Chromium-based controlled browsers do not support `te` header.
    // Probably needs more investigation, but for now, we can just remove it.
    // if (!(browserName?.toLowerCase().includes("firefox") ?? false)) {
    //   delete filteredHeaders.te;
    // }

    return filteredHeaders;
  }

  /**
   * Adds script that is evaluated before every document creation.
   * Sets User-Agent and viewport using native puppeteer interface
   * @param page Puppeteer `Page` object to be injected with the fingerprint.
   * @param fingerprint Fingerprint from [`fingerprint-generator`](https://github.com/apify/fingerprint-generator).
   */
  async attachFingerprintToPuppeteer(
    cdpConnection: Connection,
    browserFingerprintWithHeaders: BrowserFingerprintWithHeaders,
  ): Promise<void> {
    let { fingerprint, headers } = browserFingerprintWithHeaders;
    const enhancedFingerprint = this._enhanceFingerprint(fingerprint);
    const {
      battery,
      navigator: {
        extraProperties,
        userAgentData,
        webdriver,
        ...navigatorProps
      },
      screen: allScreenProps,
      videoCard,
      historyLength,
      audioCodecs,
      videoCodecs,
      mockWebRTC,
      slim,
    } = enhancedFingerprint;

    const {
      // window screen props
      outerHeight,
      outerWidth,
      devicePixelRatio,
      innerWidth,
      innerHeight,
      screenX,
      pageXOffset,
      pageYOffset,

      // Document screen props
      clientWidth,
      clientHeight,
      // Ignore hdr for now.

      hasHDR,
      // window.screen props
      ...newScreen
    } = allScreenProps;

    const windowScreenProps = {
      innerHeight,
      outerHeight,
      outerWidth,
      innerWidth,
      screenX,
      pageXOffset,
      pageYOffset,
      devicePixelRatio,
    };
    const documentScreenProps = {
      clientHeight,
      clientWidth,
    };
    console.log("Screen props: ", newScreen);
    console.log("Window screen props: ", windowScreenProps);
    console.log("Document screen props: ", documentScreenProps);

    const browserVersion = await cdpConnection.send("Browser.getVersion");

    if (
      !browserVersion?.product?.toLowerCase().includes("firefox") ||
      !browserVersion?.product?.toLowerCase().includes("opera")
    ) {
      await cdpConnection.send("Page.enable");

      await cdpConnection.send("Emulation.setDeviceMetricsOverride", {
        // screenHeight: 1050,
        // screenWidth: 1680,
        // width: 1680,
        // height: 1050,
        // mobile: false,
        // screenOrientation:
        //   newScreen.height > newScreen.width
        //     ? { angle: 0, type: "portraitPrimary" }
        //     : { angle: 90, type: "landscapePrimary" },
        // deviceScaleFactor: 1,
        // screenHeight: newScreen.height,
        // screenWidth: newScreen.width
        width: newScreen.width,
        height: newScreen.height,
        mobile: false,
        screenOrientation:
          newScreen.height > newScreen.width
            ? { angle: 0, type: "portraitPrimary" }
            : { angle: 90, type: "landscapePrimary" },
        deviceScaleFactor: windowScreenProps.devicePixelRatio,
      });

      console.log("Setting Headers", headers);
      // headers = {
      //   "sec-ch-ua":
      //     '"Chromium";v="131", "Google Chrome";v="131", "Not?A_Brand";v="99"',
      //   "sec-ch-ua-mobile": "?0",
      //   "sec-ch-ua-platform": '"Windows"',
      //   "upgrade-insecure-requests": "1",
      //   "user-agent":
      //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0   Safari/537.36",
      //   accept:
      //     "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      //   "sec-fetch-site": "same-site",
      //   "sec-fetch-mode": "navigate",
      //   "sec-fetch-user": "?1",
      //   "sec-fetch-dest": "document",
      //   "accept-encoding": "gzip, deflate, br, zstd",
      //   "accept-language": "zh-TW",
      // };
      await cdpConnection.send("Network.setExtraHTTPHeaders", {
        headers: this.onlyInjectableHeaders(headers, browserVersion.product),
      });
      await cdpConnection.send("Emulation.setEmulatedMedia", {
        features: [
          {
            name: "prefers-color-scheme",
            value: "dark",
          },
        ],
      });
    }

    await cdpConnection.send("Page.addScriptToEvaluateOnNewDocument", {
      source: this.getInjectableScript(browserFingerprintWithHeaders),
    });
  }

  /**
   * Gets the override script that should be evaluated in the browser.
   */
  getInjectableScript(
    browserFingerprintWithHeaders: BrowserFingerprintWithHeaders,
  ): string {
    const { fingerprint } = browserFingerprintWithHeaders;
    const enhancedFingerprint = this._enhanceFingerprint(fingerprint);

    return this.getInjectableFingerprintFunction(enhancedFingerprint);
  }

  /**
   * Create injection function string.
   * @param fingerprint Enhanced fingerprint.
   * @returns Script overriding browser fingerprint.
   */
  private getInjectableFingerprintFunction(
    fingerprint: EnhancedFingerprint,
  ): string {
    function inject() {
      const {
        battery,
        navigator: {
          extraProperties,
          userAgentData,
          webdriver,
          ...navigatorProps
        },
        screen: allScreenProps,
        videoCard,
        historyLength,
        audioCodecs,
        videoCodecs,
        mockWebRTC,
        slim,
        // @ts-expect-error internal browser code
      } = fp as EnhancedFingerprint;

      const {
        // window screen props
        outerHeight,
        outerWidth,
        devicePixelRatio,
        innerWidth,
        innerHeight,
        screenX,
        pageXOffset,
        pageYOffset,

        // Document screen props
        clientWidth,
        clientHeight,
        // Ignore hdr for now.

        hasHDR,
        // window.screen props
        ...newScreen
      } = allScreenProps;

      const windowScreenProps = {
        innerHeight,
        outerHeight,
        outerWidth,
        innerWidth,
        screenX,
        pageXOffset,
        pageYOffset,
        devicePixelRatio,
      };
      const documentScreenProps = {
        clientHeight,
        clientWidth,
      };

      // runHeadlessFixes();

      // if (mockWebRTC) blockWebRTC();

      // if (slim) {
      //   // @ts-expect-error internal browser code
      //   // eslint-disable-next-line dot-notation
      //   window["slim"] = true;
      // }

      // overrideIntlAPI(navigatorProps.language);
      // overrideStatic();

      // if (userAgentData) {
      // overrideUserAgentData(userAgentData);
      // }

      // if (window.navigator.webdriver) {
      //   (navigatorProps as any).webdriver = false;
      // }
      // overrideInstancePrototype(window.navigator, navigatorProps);
      //
      // overrideInstancePrototype(window.screen, newScreen);
      //overrideWindowDimensionsProps(windowScreenProps);
      // overrideDocumentDimensionsProps(documentScreenProps);
      //
      // overrideInstancePrototype(window.history, { length: historyLength });
      // window.outerWidth = 1680;
      // window.innerWidth = 1680;
      // window.outerHeight = 1014;
      // window.innerHeight = 875;
      // Object.defineProperty(window, "visualViewport", {
      //   value: {
      //     height: 875,
      //     width: window.visualViewport?.width,
      //     offsetLeft: 0,
      //     offsetTop: 0,
      //     pageLeft: 0,
      //     pageTop: window.visualViewport?.pageTop,
      //     scale: 1,
      //   },
      //   configurable: true,
      // });
      overrideDeviceMemory(navigatorProps.deviceMemory || 8);
      overrideWebGl(videoCard);
      overrideCodecs(audioCodecs, videoCodecs);
      overrideBattery(battery);
    }

    const mainFunctionString: string = inject.toString();

    return `(()=>{
function overrideScreenByReassigning(target, newProperties) {
  for (const [prop, value] of Object.entries(newProperties)) {
    if (value > 0) {
      // The 0 values are introduced by collecting in the hidden iframe.
      // They are document sizes anyway so no need to test them or inject them.
      target[prop] = value;
    }
  }
}

// eslint-disable-next-line no-unused-vars
function overrideWindowDimensionsProps(props) {
  try {
    overrideScreenByReassigning(window, props);
  } catch (e) {
    console.warn(e);
  }
}

function overrideDeviceMemory(memory) {
  try {
    Object.defineProperty(navigator, 'deviceMemory', {
      get: function() {
        return memory;
      },
      configurable: true,
      enumerable: true
    });

    // Note: Since deviceMemory is a getter property, there’s no function to mimic.
    // The native appearance is in the property descriptor itself.

    console.log("DeviceMemory overridden successfully.");
  } catch (err) {
    console.warn("Failed to override deviceMemory:", err);
  }
}

function overrideCodecs(audioCodecs, videoCodecs) {
  try {
    const originalCanPlayType = HTMLMediaElement.prototype.canPlayType;

    HTMLMediaElement.prototype.canPlayType = function(type) {
      if (typeof type !== 'string') {
        return originalCanPlayType.call(this, type);
      }

      // Handle audio codecs
      if (type.toLowerCase().startsWith('audio/')) {
        // Extract the format: e.g., "audio/ogg" -> "ogg"
        let format = type.split('/')[1].split(';')[0].trim().toLowerCase();
        if (audioCodecs.hasOwnProperty(format)) {
          return audioCodecs[format];
        }
      }
      // Handle video codecs
      else if (type.toLowerCase().startsWith('video/')) {
        let format = type.split('/')[1].split(';')[0].trim().toLowerCase();
        if (videoCodecs.hasOwnProperty(format)) {
          return videoCodecs[format];
        }
      }
      return originalCanPlayType.call(this, type);
    };

    // Mimic native function appearance
    Object.defineProperty(HTMLMediaElement.prototype.canPlayType, 'toString', {
      value: function() {
        return "function canPlayType() { [native code] }";
      },
      configurable: true,
    });

    console.log("Codecs overridden successfully.");
  } catch (err) {
    console.warn("Failed to override codecs:", err);
  }
}

function overrideBattery(battery) {
  try {
    navigator.getBattery = function() {
      return Promise.resolve({
        charging: battery.charging,
        chargingTime: battery.chargingTime,
        dischargingTime: battery.dischargingTime,
        level: battery.level,
        // Minimal stub for event listeners if needed
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      });
    };

    // Mimic native function appearance
    Object.defineProperty(navigator.getBattery, 'toString', {
      value: function() {
        return "function getBattery() { [native code] }";
      },
      configurable: true,
    });

    console.log("Battery overridden successfully.");
  } catch (err) {
    console.warn("Failed to override battery:", err);
  }
}

function overrideWebGl(webGl) {
  try {
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    const spoofedVendor = webGl.vendor; // Replace with a valid vendor
    const spoofedRenderer = webGl.renderer; // Replace with a valid renderer

    // Helper to override WebGL contexts
    const overrideContext = (contextPrototype) => {
      const originalGetParameter = contextPrototype.getParameter;

      contextPrototype.getParameter = function(parameter) {
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 37445) {
          return spoofedVendor;
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 37446) {
          return spoofedRenderer;
        }
        // Default behavior
        return originalGetParameter.call(this, parameter);
      };

      // Match native function appearance
      Object.defineProperty(contextPrototype.getParameter, 'toString', {
        value: function() {
          return "function getParameter() { [native code] }";
        },
        configurable: true,
      });
    };

    // Apply to WebGL and WebGL2
    if (typeof WebGLRenderingContext !== "undefined") {
      overrideContext(WebGLRenderingContext.prototype);
    }
    if (typeof WebGL2RenderingContext !== "undefined") {
      overrideContext(WebGL2RenderingContext.prototype);
    }

    console.log("WebGL injected successfully.");
  } catch (err) {
    console.warn("Failed to inject WebGL:", err);
  }
}

const fp=${JSON.stringify(fingerprint)};

(${mainFunctionString})()

})()`;
  }

  private _enhanceFingerprint(fingerprint: Fingerprint): EnhancedFingerprint {
    const { navigator, ...rest } = fingerprint;

    return {
      ...rest,
      navigator,
      userAgent: navigator.userAgent,
      historyLength: this._randomInRange(2, 6),
    };
  }

  /**
   * Loads the contents of the `utils.js` file, which contains the helper functions for the fingerprinting script.
   *
   * Loading this file dynamically bypasses the TypeScript compiler, which would otherwise mangle the code,
   * causing errors when executing it in the browser.
   */
  private _loadUtils(): string {
    // path.join would be better here, but Vercel's build system doesn't like it (https://github.com/apify/fingerprint-suite/issues/135)
    const utilsJs = readFileSync(scraperConfig.fingerprintUtilPath);
    return `\n${utilsJs}\n`;
  }

  private _randomInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min) + min);
  }
}
