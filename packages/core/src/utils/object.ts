import { isBoolean, isFunction, isString, isTruthy } from "./is";

/**
 * @see https://github.com/antfu/utils/blob/main/src/object.ts
 */
export function objectMap<K extends string, V, NK = K, NV = V>(
  obj: Record<K, V>,
  fn: (key: K, value: V) => [NK, NV] | undefined
): Record<K, V> {
  return Object.fromEntries(
    Object.entries(obj)
      .map(([k, v]) => fn(k as K, v as V))
      .filter(isTruthy)
  );
}

/**
 * @see https://github.com/antfu/utils/blob/main/src/object.ts
 */
export function isKeyOf<T extends object>(
  obj: T,
  key: keyof any
): key is keyof T {
  return key in obj;
}

export type Alias<T extends Record<string, any>> = string | Record<string, any> | ((obj: T) => any);

export type Keys<T extends Record<string, any>> = (keyof T)[];

export function aliasObjectMap<R = any, T extends Record<string, any> = Record<string, any>>(obj: T, alias: Record<string, Alias<T>>, inherit: Keys<T> | boolean = false) {
  const rs = Object.keys(alias).reduce((prev, key) => {
    const propKey = alias[key];
    if (isString(propKey)) {
      if (isKeyOf(obj, propKey)) {
        prev[key] = obj[propKey];
      }
    } else if (isFunction(propKey)) {
      prev[key] = propKey(obj);
    } else {
      prev[key] = aliasObjectMap(obj, propKey, inherit);
    }
    return prev;
  }, {} as Record<string, any>);

  const inheritKeys = (isBoolean(inherit) ? (inherit ? Object.keys(obj) : []) : inherit) as string[];
  inheritKeys.forEach((key) => {
    rs[key] = rs[key] ?? obj[key];
  });

  return rs as R;
}
