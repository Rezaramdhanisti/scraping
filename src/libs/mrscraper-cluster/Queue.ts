import { EventEmitter } from "events";

interface QueueOptions {
  delayUntil?: number;
}

export default class Queue<T> {
  private list: T[] = [];
  private delayedItems: number = 0;

  public remove(item: T): void {
    this.list = this.list.filter((i) => i !== item);
  }

  public getAll(): T[] {
    return this.list;
  }

  public size(): number {
    return this.list.length + this.delayedItems;
  }

  public push(item: T, options: QueueOptions = {}): void {
    if (options && options.delayUntil && options.delayUntil > Date.now()) {
      console.log("Delaying item");
      this.delayedItems += 1;
      setTimeout(() => {
        this.delayedItems -= 1;
        this.list.push(item);
        console.log("Item delayed");
      }, options.delayUntil - Date.now());
    } else {
      this.list.push(item);
    }
  }

  // Care, this function might actually return undefined even though size() returns a value > 0
  // Reason is, that there might be delayedItems (checkout QueueOptions.delayUntil)
  public shift(): T | undefined {
    return this.list.shift();
  }
}
