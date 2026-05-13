import { z } from "zod";
export type ZodObjectAny = z.ZodObject<any, any, any, any>;
export type JSONPrimitive = string | number | boolean | null | undefined;

export type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | {
      [key: string]: JSONValue;
    };
