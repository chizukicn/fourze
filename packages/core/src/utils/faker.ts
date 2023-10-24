import type { MaybeArray, MaybeNumeric } from "maybe-types";
import { isPrimitive, isString } from "./is";
import { randomInt, randomItem } from "./random";

export type BaseValueType = number | string | boolean | null | undefined;

/**
 *
 * @example  "100-500" => randomInt(100, 500)
 * @example  "100" => 100
 * @example  300 => 300
 * @example  [100, 500,"600-900"] => randomItem([100,500,randomInt(600,900)])
 * @returns
 */
export function parseFakerNumber(num: MaybeArray<MaybeNumeric>): number {
  if (Array.isArray(num)) {
    return parseFakerNumber(randomItem(num));
  }
  if (isString(num)) {
    if (num.match(/^\d+-\d+$/g)) {
      return randomInt(num);
    }
    return Number.parseInt(num);
  }
  return Number(num);
}

export interface MockObjectOption {
  deep?: boolean
  context?: Record<string, any>
}

const transformSign = ["|", "-", "{", "}", "$"];

export function getContextValue(context: any, key: string): any {
  const keys = key.split(".");
  let value = context;
  for (const k of keys) {
    if (value === undefined) {
      return undefined;
    }
    value = value[k];
  }
  return value;
}

export function parseFakerDynamic(
  val: string,
  context: Record<string, any>
): BaseValueType {
  if (/^\d+(-\d+)?$/g.test(val)) {
    return parseFakerNumber(val);
  }
  if (val === "true") {
    return true;
  }
  if (val === "false") {
    return false;
  }
  if (val === "null") {
    return null;
  }
  if (val === "undefined") {
    return undefined;
  }
  if (/(\w+)(\|(\w+))+/g.test(val)) {
    const value = val.split("|");
    return parseFakerDynamic(randomItem(value), context);
  }
  if (val.startsWith("$")) {
    const field = getContextValue(context, val.slice(1));
    return field;
  }

  if (/^'[^']*'$/g.test(val)) {
    return val.slice(1, -1);
  }

  if (/^"[^"]*"$/g.test(val)) {
    return val.slice(1, -1);
  }

  if (/^`[^`]*`$/g.test(val)) {
    return val.slice(1, -1);
  }

  return val;
}

export function parseFakerValue(
  val: string | number | boolean,
  context: any = {}
) {
  if (isString(val)) {
    if (val.match(/^{[^}]*}$/g)) {
      return parseFakerDynamic(val.slice(1, -1), context);
    }

    const matches = val.match(/{[^}]*}/g);
    if (matches) {
      for (const match of matches) {
        const matchValue = match.slice(1, -1);
        val = val.replace(
          match,
          String(parseFakerDynamic(matchValue, context))
        );
      }
    }
    val = transformSign.reduce((rs, keyword) => {
      return rs.replaceAll(`\\${keyword}`, keyword);
    }, val);
  }
  return val;
}

/**
 *
 *  {
 *    a :"{100}",
 *    b :"{300-600}",
 *    c : "{8799}",
 *    d : ["100",30,"400-900"],
 *    e : {
 *       a :"{100-300}"
 *    }
 *  }
 *
 * @param obj
 * @param options
 */
export function parseFakerObject(
  obj: MaybeArray<MaybeNumeric | Record<string, any>>,
  options: MockObjectOption = {}
): any {
  options.context = options.context ?? {};

  if (Array.isArray(obj)) {
    return obj.map((v) => parseFakerObject(v, options));
  }

  if (isPrimitive(obj)) {
    return parseFakerValue(obj, options.context);
  }

  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (Array.isArray(v)) {
        return [k, v.map((f) => parseFakerObject(f, options))];
      }
      return [k, parseFakerObject(v, options)];
    })
  );
}
