import type { MaybePromise } from "maybe-types";
import type {
  DefineFourzeHook,
  FourzeBaseHook,
  FourzeBaseRoute,
  FourzeHandle,
  FourzeHook,
  FourzeInstance,
  ObjectProps,
  RequestMethod
} from "./shared";
import {
  FOURZE_METHODS,
  defineFourzeHook,
  defineRoute,
  isFourzeHook
} from "./shared";
import {
  createSingletonPromise,
  isFunction,
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
  fourze: Fourze
) => MaybePromise<void | FourzeBaseRoute[] | FourzeInstance>;

export type FourzeRequestFunctions<This> = {
  [K in RequestMethod]: {
    <Props extends ObjectProps = ObjectProps, Meta = Record<string, any>>(
      path: string,
      props: Props,
      meta: Meta,
      handle: FourzeHandle<Props, Meta>
    ): This
    <Props extends ObjectProps = ObjectProps>(
      path: string,
      props: Props,
      handle: FourzeHandle<Props>
    ): This
    (path: string, handle: FourzeHandle): This
  };
};

const FOURZE_SYMBOL = Symbol("FourzeInstance");
export interface Fourze extends FourzeRequestFunctions<Fourze>, FourzeInstance {
  <
    Method extends RequestMethod,
    Props extends ObjectProps = ObjectProps,
    Meta = Record<string, any>
  >(
    path: string,
    method: Method,
    meta: Meta,
    props: Props,
    handle: FourzeHandle<Props, Meta>
  ): this
  <Method extends RequestMethod, Props extends ObjectProps = ObjectProps>(
    path: string,
    method: Method,
    props: Props,
    handle: FourzeHandle<Props>
  ): this
  <Props extends ObjectProps = ObjectProps, Meta = Record<string, any>>(
    path: string,
    props: Props,
    meta: Meta,
    handle: FourzeHandle<Props, Meta>
  ): this
  <Props extends ObjectProps = ObjectProps>(
    path: string,
    props: Props,
    handle: FourzeHandle<Props>
  ): this
  <Props extends ObjectProps = ObjectProps, Meta = Record<string, any>>(
    route: FourzeBaseRoute<Props, Meta>
  ): this
  (path: string, handle: FourzeHandle): this

  (routes: FourzeBaseRoute<any>[]): this

  hook(hook: FourzeHook): this
  hook(hook: FourzeBaseHook): this
  hook(hook: DefineFourzeHook): this
  hook(base: string, hook: FourzeBaseHook): this
  apply(fourze: FourzeInstance): this

  setup(): Promise<void>
  readonly [FOURZE_SYMBOL]: true
  readonly name: string
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

  const name = isOption ? options.name : "anonymous";

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
    } else if (typeof param0 === "object") {
      routes.push(param0);
    } else {
      routes.push(
        overload(
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
        )
      );
    }
    return fourze;
  } as Fourze;

  fourze.hook = function (
    ...args:
      | [string, FourzeBaseHook]
      | [FourzeBaseHook]
      | [DefineFourzeHook]
      | [FourzeHook]
  ) {
    if (args.length === 1 && isFourzeHook(args[0])) {
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

  Object.defineProperties(fourze, {
    routes: {
      get() {
        return routes.map((e) => {
          return defineRoute({
            ...e,
            base: _base
          });
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
      FOURZE_METHODS.map((method) => [
        method,
        {
          get() {
            return function (this: Fourze, path: string, ...others: any[]) {
              const args = [
                path,
                method,
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
        return name;
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
