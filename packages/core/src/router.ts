import type { MaybePromise } from "maybe-types";
import { createLogger } from "./logger";
import type {
  FourzeApp,
  FourzeBaseRoute,
  FourzeMiddleware,
  FourzeNext,
  FourzeRequest,
  FourzeResponse,
  FourzeRoute,
  FourzeRouteFunction,
  FourzeRouteGenerator,
  ObjectProps,
  PropType
} from "./shared";
import {
  FOURZE_METHODS
  , defineMiddleware, defineRoute
} from "./shared";
import {
  createSingletonPromise,
  isConstructor,
  isDef,
  isFunction,
  isObject,
  isUndef,
  normalizeRoute,
  overload,
  relativePath,
  resolvePath
} from "./utils";

export interface FourzeRouter
  extends FourzeMiddleware,
  FourzeRouteGenerator<FourzeRouter> {
  /**
   * 根据url匹配路由
   * @param url
   * @param method
   * @allowed 是否验证路由在允许规则内
   */
  match(
    url: string,
    method?: string,
  ): [FourzeRoute, RegExpMatchArray] | []

  refresh(): void

  route: FourzeRouteFunction<FourzeRouter>

  setup(): MaybePromise<void>

  relative(path: string): string | null

  resolve(path: string): string

  readonly base: string

  readonly name: string

  readonly routes: FourzeRoute[]
}

const FourzeRouterSymbol = Symbol("FourzeRouter");

export type FourzeRouterSetup = (
  router: FourzeRouter,
  app: FourzeApp
) => MaybePromise<FourzeBaseRoute[] | FourzeRouterOptions | void>;

export interface FourzeRouterOptions {
  name?: string
  base?: string
  routes?: FourzeBaseRoute[]
  setup?: FourzeRouterSetup
}

export function defineRouter(): FourzeRouter;
export function defineRouter(options: FourzeRouterOptions): FourzeRouter;

export function defineRouter(modules: FourzeBaseRoute[]): FourzeRouter;

export function defineRouter(setup: FourzeRouterSetup): FourzeRouter;

export function defineRouter(
  params: FourzeBaseRoute[] | FourzeRouterOptions | FourzeRouterSetup = {}
): FourzeRouter {
  const isFunc = isFunction(params);
  const isArray = Array.isArray(params);
  const isOptions = !isFunc && !isArray;

  const options = isOptions ? params : {};

  const setup: FourzeRouterSetup | undefined = isOptions
    ? options.setup
    : isFunc
      ? params
      : () => params;

  const routes: FourzeRoute[] = [];

  const logger = createLogger("@fourze/core");

  const router = defineMiddleware(options.name ?? "Router", async (
    request: FourzeRequest,
    response: FourzeResponse,
    next?: FourzeNext
  ) => {
    request.contextPath = router.base;

    const { path, method } = request;

    await router.setup();

    const [route, matches] = router.match(path, method);

    if (route && matches) {
      for (let i = 0; i < route.pathParams.length; i++) {
        const key = route.pathParams[i].slice(1, -1);
        const value = matches[i + 1];
        request.params[key] = value;
      }

      request.route = route;

      try {
        validateProps(route.props, request.data);
      } catch (error: any) {
        response.sendError(400, error.message);
        return;
      }

      request.meta = {
        ...request.meta,
        ...route.meta
      };

      try {
        const _result = await route.handle(request, response);
        if (_result) {
          response.send(_result);
        }
      } catch (error: any) {
        response.sendError(500, error.message);
      }

      logger.info(
        `Request matched -> ${normalizeRoute(request.path, method)}.`
      );

      if (!response.writableEnded) {
        response.end();
      }
    } else {
      await next?.();
    }

    return response.payload;
  }) as FourzeRouter;

  router.match = function (
    this: FourzeRouter,
    url: string,
    method?: string
  ): [FourzeRoute, RegExpMatchArray] | [] {
    const path = this.relative(url);
    if (path) {
      for (const route of routes) {
        const matches = route.match(path, method);
        if (matches) {
          return [route, matches];
        }
      }
    }
    return [];
  };

  router.route = function (
    this: FourzeRouter,
    ...args: Parameters<typeof router["route"]>
  ) {
    const param0 = args[0];
    if (Array.isArray(param0)) {
      routes.push(...param0.map(defineRoute));
    } else if (isObject(param0)) {
      routes.push(defineRoute(param0) as FourzeRoute);
    } else {
      const { path, method, options, handle } = overload(
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
            name: "options"
          },
          {
            type: "function",
            name: "handle",
            required: true
          }
        ],
        [...args]
      );

      const route = {
        path,
        method,
        handle,
        ...options
      };

      if (isDef(route)) {
        routes.push(defineRoute(route));
      }
    }
    return this;
  } as FourzeRouteFunction<FourzeRouter>;

  router.relative = function (this: FourzeRouter, url: string) {
    return relativePath(url, this.base);
  };

  router.resolve = function (this: FourzeRouter, url: string) {
    return resolvePath(url, this.base);
  };

  const setupRouter = createSingletonPromise(async (app: FourzeApp) => {
    try {
      const rs = await setup?.(router, app);
      if (Array.isArray(rs)) {
        routes.push(...rs.map((r) => defineRoute(r)));
      } else if (isObject(rs)) {
        options.name = rs.name ?? options.name;
        options.base = rs.base ?? options.base;
        if (rs.routes) {
          routes.push(...rs.routes.map((r) => defineRoute(r)));
        }
      }
    } catch (error) {
      logger.error(error);
      throw error;
    }
  });

  Object.defineProperties(router, {
    ...Object.fromEntries(
      [...FOURZE_METHODS].map((method) => [
        method,
        {
          get() {
            return function (
              this: FourzeRouter,
              path: string,
              ...others: any[]
            ) {
              const args = [path, method, ...others] as unknown as Parameters<
                typeof router["route"]
              >;
              router.route(...args);
              return this;
            };
          }
        }
      ])
    ),
    base: {
      // default base
      get() {
        return "/";
      },
      configurable: true
    },
    setup: {
      get() {
        return setupRouter;
      }
    },

    refresh: {
      get() {
        return setupRouter.reset;
      }
    },
    routes: {
      get() {
        return Array.from(routes);
      }
    },
    [FourzeRouterSymbol]: {
      value: true,
      writable: false
    }
  });

  return router;
}

export function isRouter(value: any): value is FourzeRouter {
  return !!value && !!value[FourzeRouterSymbol];
}

function isExtends<D>(types: PropType<D>, type: PropType<D>): boolean {
  if (Array.isArray(types)) {
    return types.some((e) => isExtends(e, type));
  }
  return types === type;
}

export function validateProps(
  props: ObjectProps,
  data: Record<string, any>
) {
  for (const [key, propsOption] of Object.entries(props)) {
    let value = data[key];
    if (propsOption != null) {
      if (isConstructor(propsOption) || Array.isArray(propsOption)) {
        //
      } else {
        const required = propsOption.required;
        if (isExtends(propsOption.type, Boolean)) {
          value = value ?? false;
        }
        if (required && isUndef(value)) {
          throw new Error(`Property '${key}' is required.`);
        }
      }
    }
  }
}
