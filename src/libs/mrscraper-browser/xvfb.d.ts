declare module "xvfb" {
  interface XvfbOptions {
    displayNum?: number; // Display number to use
    reuse?: boolean; // Whether to reuse an existing Xvfb instance
    timeout?: number; // Timeout for starting/stopping
    silent?: boolean; // Suppress stderr output from Xvfb
    xvfb_args?: string[]; // Additional arguments to pass to the Xvfb process
  }

  class Xvfb {
    constructor(options?: XvfbOptions);

    /**
     * Start the Xvfb instance asynchronously.
     * @param cb - Callback function called when the Xvfb instance starts or fails.
     */
    start(cb?: (error: Error | null, process?: any) => void): void;

    /**
     * Start the Xvfb instance synchronously.
     * @returns The process instance.
     */
    startSync(): any;

    /**
     * Stop the Xvfb instance asynchronously.
     * @param cb - Callback function called when the Xvfb instance stops or fails.
     */
    stop(cb?: (error: Error | null) => void): void;

    /**
     * Stop the Xvfb instance synchronously.
     */
    stopSync(): void;

    /**
     * Get the display used by Xvfb.
     * @returns The display number (e.g., ":99").
     */
    display(): string;
  }

  export = Xvfb;
}
