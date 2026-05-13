import debug, * as Debug from "debug";
export function debugGenerator(namespace: string): Debug.IDebugger {
  const d = debug(`mrscraper-browser:${namespace}`);
  return d;
}

const logToConsole = debug("mrscraper-cluster:log");
logToConsole.log = console.error.bind(console);

export function log(msg: string): void {
  logToConsole(msg);
}

export const blackList = [
  // "*.css",
  "*.jpg",
  "*.jpeg",
  "*.png",
  "*.gif",
  "*.ico",
  "*.otf",
  "*.woff*",
  "*.ttf",
  "*.svg",
  "*.mp4",
  "*.webm",
  "*.webp",
  "*doubleclick.net*",
  "*optimizationguide-pa.googleapis.com*",
  "*youtube.com*",
  // "*down-tx-sg.vod.susercontent.com*",
  // "*down-tw.img.susercontent.com*",
  // "*down-aka-sg.vod.susercontent.com*",
  "*googletagmanager.com*",
  "*connect.facebook.net*",
  // "*down-aka-sg.img.susercontent.com*",
  "*fonts.gstatic.com*",
  "*content-autofill.googleapis.com*",
  "*ampcid.google.com*",
  "*adservice.google.com*",
  "*i.ytimg.com*",
  "*jnn-pa.googleapis.com*",
  "*play.google.com*",
  "*ads.pubmatic.com*",
  "*image2.pubmatic.com*",

  // "*chateasy*",
  // "*shoprating*",
  // "*assets/sws*",
  // "*get_ft_v2*",

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
export const assert: (value: unknown, message?: string) => asserts value = (
  value,
  message,
) => {
  if (!value) {
    throw new Error(message);
  }
};

/**
 * @license
 * Copyright 2023 Google Inc.
 * SPDX-License-Identifier: Apache-2.0
 */

declare global {
  interface SymbolConstructor {
    /**
     * A method that is used to release resources held by an object. Called by
     * the semantics of the `using` statement.
     */
    readonly dispose: unique symbol;

    /**
     * A method that is used to asynchronously release resources held by an
     * object. Called by the semantics of the `await using` statement.
     */
    readonly asyncDispose: unique symbol;
  }

  interface Disposable {
    [Symbol.dispose](): void;
  }

  interface AsyncDisposable {
    [Symbol.asyncDispose](): PromiseLike<void>;
  }
}

(Symbol as any).dispose ??= Symbol("dispose");
(Symbol as any).asyncDispose ??= Symbol("asyncDispose");

/**
 * @internal
 */
export const disposeSymbol: typeof Symbol.dispose = Symbol.dispose;

/**
 * @internal
 */
export const asyncDisposeSymbol: typeof Symbol.asyncDispose =
  Symbol.asyncDispose;

/**
 * @internal
 */
export class DisposableStack {
  #disposed = false;
  #stack: Disposable[] = [];

  /**
   * Returns a value indicating whether this stack has been disposed.
   */
  get disposed(): boolean {
    return this.#disposed;
  }

  /**
   * Disposes each resource in the stack in the reverse order that they were added.
   */
  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    for (const resource of this.#stack.reverse()) {
      resource[disposeSymbol]();
    }
  }

  /**
   * Adds a disposable resource to the stack, returning the resource.
   *
   * @param value - The resource to add. `null` and `undefined` will not be added,
   * but will be returned.
   * @returns The provided `value`.
   */
  use<T extends Disposable | null | undefined>(value: T): T {
    if (value) {
      this.#stack.push(value);
    }
    return value;
  }

  /**
   * Adds a value and associated disposal callback as a resource to the stack.
   *
   * @param value - The value to add.
   * @param onDispose - The callback to use in place of a `[disposeSymbol]()`
   * method. Will be invoked with `value` as the first parameter.
   * @returns The provided `value`.
   */
  adopt<T>(value: T, onDispose: (value: T) => void): T {
    this.#stack.push({
      [disposeSymbol]() {
        onDispose(value);
      },
    });
    return value;
  }

  /**
   * Adds a callback to be invoked when the stack is disposed.
   */
  defer(onDispose: () => void): void {
    this.#stack.push({
      [disposeSymbol]() {
        onDispose();
      },
    });
  }

  /**
   * Move all resources out of this stack and into a new `DisposableStack`, and
   * marks this stack as disposed.
   *
   * @example
   *
   * ```ts
   * class C {
   *   #res1: Disposable;
   *   #res2: Disposable;
   *   #disposables: DisposableStack;
   *   constructor() {
   *     // stack will be disposed when exiting constructor for any reason
   *     using stack = new DisposableStack();
   *
   *     // get first resource
   *     this.#res1 = stack.use(getResource1());
   *
   *     // get second resource. If this fails, both `stack` and `#res1` will be disposed.
   *     this.#res2 = stack.use(getResource2());
   *
   *     // all operations succeeded, move resources out of `stack` so that
   *     // they aren't disposed when constructor exits
   *     this.#disposables = stack.move();
   *   }
   *
   *   [disposeSymbol]() {
   *     this.#disposables.dispose();
   *   }
   * }
   * ```
   */
  move(): DisposableStack {
    if (this.#disposed) {
      throw new ReferenceError("a disposed stack can not use anything new"); // step 3
    }
    const stack = new DisposableStack(); // step 4-5
    stack.#stack = this.#stack;
    this.#disposed = true;
    return stack;
  }

  [disposeSymbol] = this.dispose;

  readonly [Symbol.toStringTag] = "DisposableStack";
}

/**
 * @internal
 */
export class AsyncDisposableStack {
  #disposed = false;
  #stack: AsyncDisposable[] = [];

  /**
   * Returns a value indicating whether this stack has been disposed.
   */
  get disposed(): boolean {
    return this.#disposed;
  }

  /**
   * Disposes each resource in the stack in the reverse order that they were added.
   */
  async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    for (const resource of this.#stack.reverse()) {
      await resource[asyncDisposeSymbol]();
    }
  }

  /**
   * Adds a disposable resource to the stack, returning the resource.
   *
   * @param value - The resource to add. `null` and `undefined` will not be added,
   * but will be returned.
   * @returns The provided `value`.
   */
  use<T extends AsyncDisposable | null | undefined>(value: T): T {
    if (value) {
      this.#stack.push(value);
    }
    return value;
  }

  /**
   * Adds a value and associated disposal callback as a resource to the stack.
   *
   * @param value - The value to add.
   * @param onDispose - The callback to use in place of a `[disposeSymbol]()`
   * method. Will be invoked with `value` as the first parameter.
   * @returns The provided `value`.
   */
  adopt<T>(value: T, onDispose: (value: T) => Promise<void>): T {
    this.#stack.push({
      [asyncDisposeSymbol]() {
        return onDispose(value);
      },
    });
    return value;
  }

  /**
   * Adds a callback to be invoked when the stack is disposed.
   */
  defer(onDispose: () => Promise<void>): void {
    this.#stack.push({
      [asyncDisposeSymbol]() {
        return onDispose();
      },
    });
  }

  /**
   * Move all resources out of this stack and into a new `DisposableStack`, and
   * marks this stack as disposed.
   *
   * @example
   *
   * ```ts
   * class C {
   *   #res1: Disposable;
   *   #res2: Disposable;
   *   #disposables: DisposableStack;
   *   constructor() {
   *     // stack will be disposed when exiting constructor for any reason
   *     using stack = new DisposableStack();
   *
   *     // get first resource
   *     this.#res1 = stack.use(getResource1());
   *
   *     // get second resource. If this fails, both `stack` and `#res1` will be disposed.
   *     this.#res2 = stack.use(getResource2());
   *
   *     // all operations succeeded, move resources out of `stack` so that
   *     // they aren't disposed when constructor exits
   *     this.#disposables = stack.move();
   *   }
   *
   *   [disposeSymbol]() {
   *     this.#disposables.dispose();
   *   }
   * }
   * ```
   */
  move(): AsyncDisposableStack {
    if (this.#disposed) {
      throw new ReferenceError("a disposed stack can not use anything new"); // step 3
    }
    const stack = new AsyncDisposableStack(); // step 4-5
    stack.#stack = this.#stack;
    this.#disposed = true;
    return stack;
  }

  [asyncDisposeSymbol] = this.dispose;

  readonly [Symbol.toStringTag] = "AsyncDisposableStack";
}
