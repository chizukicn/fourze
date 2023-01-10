import type { MaybePromise } from "maybe-types";
import type {
  FourzeBaseHook,
  FourzeBaseRoute,
  FourzeHook,
  FourzeInstance,
  FourzeMiddleware,
  FourzeRouteFunction,
  FourzeRouteGenerator
} from "./shared";
import {
  FOURZE_METHODS,
  defineFourzeHook,
  defineRoute,
  isFourzeHook
} from "./shared";
import {
  createSingletonPromise,
  isDef,
  isFunction,
  isObject,
  isString,
  overload,
  resolvePath
} from "./utils";
export interface FourzeOptions {
  name?: string
  base?: string
  setup?: FourzeSetup
  routes?: FourzeBaseRoute[]
  hooks?: FourzeBaseHook[]
}

export type FourzeSetup = (
  route: Fourze
) => MaybePromise<void | FourzeBaseRoute[] | FourzeInstance>;

const FOURZE_SYMBOL = Symbol("FourzeInstance");
export interface Fourze
  extends FourzeRouteGenerator<Fourze>,
  FourzeRouteFunction<Fourze>,
  FourzeInstance {
  (routes: FourzeBaseRoute<any>[]): this

  hook<R = any>(hook: FourzeHook<R>): this
  hook<R = any>(handle: FourzeMiddleware<R>): this
  hook<R = any>(path: string, handle: FourzeMiddleware<R>): this
  apply(fourze: FourzeInstance): this

  setup(): Promise<void>

  setMeta(name: string, value: any): this
  setMeta(meta: Record<string, any>): this
  getMeta<T = any>(name: string): T | undefined

  readonly meta: Record<string, any>
  readonly name?: string
  readonly [FOURZE_SYMBOL]: true
}

export function defineFourze(routes: FourzeBaseRoute[]): Fourze;

export function defineFourze(options: FourzeOptions): Fourze;

export function defineFourze(setup: FourzeSetup): Fourze;

export function defineFourze(base: string, setup: FourzeSetup): Fourze;

export function defineFourze(): Fourze;

export function defineFourze(
  options: FourzeOptions | FourzeBaseRoute[] | FourzeSetup | string = {},
  setupFn?: FourzeSetup
): Fourze {
  const isBase = isString(options);
  const isRoutes = Array.isArray(options);
  const isSetup = isFunction(options);
  const isOption = !isRoutes && !isSetup && !isBase;

  let _base = isBase ? options : isOption ? options.base : undefined;
  const setup = isBase
    ? setupFn
    : isOption
      ? options.setup
      : isSetup
        ? options
        : undefined;

  const _name = isOption ? options.name : undefined;

  const routes = Array.from(
    (isOption ? options.routes : isRoutes ? options : []) ?? []
  );
  const hooks: FourzeHook[] = [];

  const fourze = function (
    this: Fourze,
    param0: string | FourzeBaseRoute | FourzeBaseRoute[],
    ...args: any[]
  ) {
    if (isFourze(param0)) {
      routes.push(...param0.routes.map(defineRoute));
      hooks.push(...param0.hooks);
    } else if (Array.isArray(param0)) {
      routes.push(...param0.map(defineRoute));
    } else if (isObject(param0)) {
      routes.push(param0);
    } else {
      const route = overload(
        [
          {
            type: "string",
            name: "path",
            required: true
          },
          {
            type: "string",
            name: "method"
          },
          {
            type: "object",
            name: "props"
          },
          {
            type: "object",
            name: "meta"
          },
          {
            type: "function",
            name: "handle",
            required: true
          }
        ],
        [param0, ...args]
      );
      if (isDef(route)) {
        routes.push(route);
      }
    }
    return fourze;
  } as Fourze;

  fourze.hook = function (
    ...args: [string, FourzeMiddleware] | [FourzeMiddleware] | [FourzeHook]
  ) {
    if (isFourzeHook(args[0])) {
      hooks.push(args[0]);
    } else {
      const hook = defineFourzeHook(
        ...(args as Parameters<typeof defineFourzeHook>)
      );
      hooks.push(hook);
    }
    return this;
  };

  fourze.apply = function (instance: FourzeInstance) {
    routes.push(...instance.routes);
    hooks.push(...instance.hooks);
    return this;
  };

  const _meta: Record<string, any> = {};

  fourze.setMeta = function (name: string | Record<string, any>, value?: any) {
    if (isString(name)) {
      _meta[name] = value;
    } else {
      Object.assign(_meta, value ?? {});
    }
    return this;
  };

  fourze.getMeta = function<T>(name: string) {
    return _meta[name] as T;
  };

  Object.defineProperties(fourze, {
    routes: {
      get() {
        return routes.map((e) => {
          return defineRoute(e);
        });
      }
    },
    hooks: {
      get() {
        return hooks.map((e) => {
          return {
            ...e,
            path: resolvePath(e.path, _base)
          };
        });
      }
    },
    base: {
      get() {
        return _base;
      },
      set(value) {
        _base = value;
      }
    },

    ...Object.fromEntries(
      [...FOURZE_METHODS, "all" as const].map((method) => [
        method,
        {
          get() {
            return function (this: Fourze, path: string, ...others: any[]) {
              const args = [
                path,
                method === "all" ? undefined : method,
                ...others
              ] as unknown as Parameters<Fourze>;
              return this(...args);
            };
          }
        }
      ])
    ),
    name: {
      get() {
        return _name ?? _meta.name;
      },
      configurable: true
    },

    meta: {
      get() {
        return _meta;
      }
    },

    [FOURZE_SYMBOL]: {
      get() {
        return true;
      }
    }
  });

  fourze.setup = createSingletonPromise(async () => {
    const extra = (await setup?.(fourze)) ?? [];

    if (Array.isArray(extra)) {
      routes.push(...extra);
    } else if (extra) {
      fourze.apply(extra);
    }
  });

  return fourze;
}

export function isFourze(fourze: any): fourze is Fourze {
  return !!fourze && fourze[FOURZE_SYMBOL];
}
