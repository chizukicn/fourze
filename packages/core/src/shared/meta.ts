import { isObject } from "../utils";

export interface MetaInstance<This, Meta = Record<string, any>> {
  readonly meta: Meta;
  setMeta: ((key: string, value: any) => This) & ((meta: Meta) => This);
  getMeta: <T = any>(key: string) => T | undefined;
}

export function injectMeta<This extends MetaInstance<This>>(instance: This, meta: This["meta"] = {}): MetaInstance<This> {
  instance.setMeta = function (this: This, ...args: [string, any] | [typeof instance.meta]) {
    if (isObject(args[0])) {
      Object.assign(instance.meta, args[0]);
    } else {
      instance.meta[args[0]] = args[1];
    }
    return this;
  };
  instance.getMeta = function<T = any>(this: This, key: string): T | undefined {
    return instance.meta[key];
  };
  Object.defineProperty(instance, "meta", {
    get() {
      return meta;
    },
    enumerable: true
  });
  return instance;
}

export interface FourzeAppMeta extends Record<string, any> {}

export interface FourzeRouterMeta extends FourzeAppMeta {}

export interface FourzeRouteMeta extends FourzeRouterMeta {}
