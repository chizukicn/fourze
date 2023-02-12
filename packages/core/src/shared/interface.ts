import type { IncomingMessage, OutgoingMessage } from "http";
import type { MaybePromise, MaybeRegex } from "maybe-types";
import { overload } from "../utils";
import type { FourzeContext, FourzeContextOptions } from "./context";
import type { FourzeAppMeta, FourzeRouteMeta, MetaInstance } from "./meta";
import type { ObjectProps, PropType } from "./props";
import type { FourzeRequest } from "./request";
import type { FourzeResponse } from "./response";

const FOURZE_MIDDLEWARE_SYMBOL = Symbol("FOURZE_MIDDLEWARE_SYMBOL");

export type FourzeNext<T = any> = () => MaybePromise<T>;

export type FourzeHandle<
  R = unknown, Props extends ObjectProps = ObjectProps, Meta = FourzeRouteMeta
> = (
  request: FourzeRequest<Props, Meta>,
  response: FourzeResponse
) => MaybePromise<R>;

export interface CommonMiddleware {
  (
    req: IncomingMessage,
    res: OutgoingMessage,
    next?: FourzeNext
  ): MaybePromise<void>
}

export interface FourzeMiddlewareHandler<T = any> {
  (
    req: FourzeRequest,
    res: FourzeResponse,
    next: FourzeNext<T>
  ): MaybePromise<T>
}

export interface FourzeMiddleware<T = any> extends FourzeMiddlewareHandler<T> {
  name?: string
  setup?: (app?: FourzeApp) => MaybePromise<void>
  readonly order?: number
}

export function defineMiddleware(name: string, order: number, handler: FourzeMiddlewareHandler): FourzeMiddleware;

export function defineMiddleware(name: string, handler: FourzeMiddlewareHandler): FourzeMiddleware;

export function defineMiddleware(handler: FourzeMiddlewareHandler): FourzeMiddleware;

export function defineMiddleware(...args: [string, number, FourzeMiddlewareHandler] | [string, FourzeMiddlewareHandler] | [FourzeMiddlewareHandler]): FourzeMiddleware {
  const { name, order, handler } = overload({
    name: String,
    order: Number,
    handler: {
      type: Function as PropType<FourzeMiddlewareHandler>,
      required: true
    }
  }, args);

  Object.defineProperties(handler, {
    name: {
      value: name,
      configurable: true,
      enumerable: true
    },
    order: {
      value: order,
      configurable: true,
      enumerable: true
    },
    [FOURZE_MIDDLEWARE_SYMBOL]: {
      get() {
        return true;
      },
      configurable: true,
      enumerable: true
    }
  });
  return handler;
}

export function isFourzeMiddleware(obj: any): obj is FourzeMiddleware {
  return obj && obj[FOURZE_MIDDLEWARE_SYMBOL];
}

export interface FourzeApp extends FourzeMiddleware, MetaInstance<FourzeApp, FourzeAppMeta> {
  use(path: string, ...middlewares: FourzeMiddleware[]): this

  use(...modules: FourzeModule[]): this

  remove(name: string): this

  /**
   *  是否允许
   * @param url
   */
  isAllow(url: string): boolean

  allow(...rules: MaybeRegex[]): this

  deny(...rules: MaybeRegex[]): this

  relative(url: string): string | null

  match(url: string): [string, FourzeMiddleware][]

  service(context: FourzeContextOptions, fallback?: FourzeHandle): Promise<FourzeContext>

  ready(): Promise<void>

  reset(): Promise<void>

  readonly meta: FourzeAppMeta

  readonly base: string

  readonly middlewares: FourzeMiddleware[]

  readonly isReady: boolean

  readonly isReadying: boolean

}

export type FourzeModule = FourzePlugin | FourzeMiddleware;

const FOURZE_PLUGIN_SYMBOL = Symbol("FOURZE_PLUGIN_SYMBOL");
export interface FourzePluginInstall {
  (app: FourzeApp): MaybePromise<void>
}

export interface FourzePlugin {
  name?: string
  install: FourzePluginInstall
  readonly [FOURZE_PLUGIN_SYMBOL]: boolean
}

export function definePlugin(install: FourzePluginInstall): FourzePlugin;
export function definePlugin(name: string, install: FourzePluginInstall): FourzePlugin;

export function definePlugin(...args: [FourzePluginInstall] | [string, FourzePluginInstall]): FourzePlugin {
  const { name, install } = overload({
    name: {
      type: String,
      required: false
    },
    install: {
      type: Function as PropType<FourzePluginInstall>,
      required: true
    }
  }, args);
  return {
    name,
    install,
    get [FOURZE_PLUGIN_SYMBOL]() {
      return true;
    }
  };
}

export function isFourzePlugin(obj: any): obj is FourzePlugin {
  return !!obj && !!obj[FOURZE_PLUGIN_SYMBOL];
}

export function isFourzeModule(obj: any): obj is FourzeModule {
  return isFourzePlugin(obj) || isFourzeMiddleware(obj);
}
