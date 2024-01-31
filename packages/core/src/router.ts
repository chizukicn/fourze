import type { MaybePromise } from "maybe-types";
import { createLogger } from "./logger";
import type { FourzeRouteMeta, MetaInstance } from "./shared/meta";
import { injectMeta } from "./shared/meta";
import type {
  DefaultData,
  FourzeApp,
  FourzeBaseRoute,
  FourzeHandle,
  FourzeMiddleware,
  FourzeNext,
  FourzeRequest,
  FourzeResponse,
  FourzeRoute,
  FourzeRouteGenerator,
  FourzeRouteOptions,
  FourzeRouterMeta,
  ObjectProps,
  PropType,
  RequestMethod
} from "./shared";
import {
  FOURZE_METHODS,
  defineMiddleware,
  defineRoute,
  isRoute
} from "./shared";
import {
  createSingletonPromise,
  isFunction,
  isObject,
  isString,
  normalizeRoute,
  overload
} from "./utils";
import { createRouteMatcher } from "./shared/matcher";

const FourzeRouterFlag = "__isFourzeRouter";

type FourzeRouteChain<Methods extends string = RequestMethod> = {

  /**
   * Add a middleware to the router
   * only once
   */
  [method in Methods]: {
    <Result = unknown, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta>(
      options: Omit<FourzeRouteOptions<Props, Meta>, "path" | "method">,
      handle: FourzeHandle<Result, Props, Meta>
    ): FourzeRouteChain<Exclude<Methods, method>> & {
      route: FourzeRouter["route"];
    };

    <Result = unknown, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta>(
      handle: FourzeHandle<Result, Props, Meta>
    ): FourzeRouteChain<Exclude<Methods, method>> & {
      route: FourzeRouter["route"];
    };
  }
} & {
  route: FourzeRouter["route"];
};

export interface FourzeRouter
  extends FourzeMiddleware,
  FourzeRouteGenerator<FourzeRouter>, MetaInstance<FourzeRouter, FourzeRouterMeta> {

  reset(): void;

  route(path: string): FourzeRouteChain;

  route<Result = unknown, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta>(path: string, method: RequestMethod, options: FourzeRouteOptions<Props, Meta>, handle: FourzeHandle<Result, Props, Meta>): this;

  route(path: string, method: RequestMethod, handle: FourzeHandle): this;

  route<Result = unknown, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta>(path: string, options: FourzeRouteOptions<Props, Meta>, handle: FourzeHandle<Result, Props, Meta>): this;

  route(path: string, handle: FourzeHandle): this;

  route<Result = unknown, Props extends ObjectProps = DefaultData, Meta = FourzeRouteMeta>(route: FourzeBaseRoute<Result, Props, Meta>): this;

  route(route: FourzeBaseRoute[]): this;

  setup(app?: FourzeApp): Promise<void>;

  readonly meta: Record<string, any>;

  readonly name: string;

  readonly routes: FourzeRoute[];

  [FourzeRouterFlag]: true;
}

export type FourzeRouterSetup = (
  router: FourzeRouter,
  app: FourzeApp
) => MaybePromise<FourzeBaseRoute[] | FourzeRouterOptions | FourzeRouter | void>;

export interface FourzeRouterOptions {
  name?: string;
  meta?: FourzeRouterMeta;
  routes?: FourzeBaseRoute[];
  setup?: FourzeRouterSetup;
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

  const meta: Record<string, any> = { ...options.meta };

  const matcher = createRouteMatcher<FourzeRoute>({
    notAllowedRaiseError: true
  });

  const logger = createLogger("@fourze/core");

  const router = defineMiddleware(options.name ?? `FourzeRouter@${Math.random().toString(32).slice(8)}`, async (
    request: FourzeRequest,
    response: FourzeResponse,
    next?: FourzeNext
  ) => {
    await router.setup();

    const { path, method } = request;

    const [route, matches] = matcher.match(path, (method as RequestMethod) ?? "all");

    if (route) {
      request.setRoute(route, matches);

      request.meta = {
        ...request.meta,
        ...router.meta,
        ...route.meta
      };

      try {
        const _result = await route.handle(request, response);
        if (!response.sent) {
          response.send(_result);
        }
      } catch (error: any) {
        response.sendError(error);
      }

      logger.debug(
        `Request matched -> ${normalizeRoute(request.path, method)}.`
      );
    } else {
      await next?.();
    }

    return response.payload;
  }) as FourzeRouter;

  injectMeta(router, meta);

  const addRoute = (arg: FourzeBaseRoute) => {
    const route = isRoute(arg) ? arg : defineRoute(arg);
    matcher.add(route.path, route.method ?? "all", route);
  };

  router.route = function (this: FourzeRouter, ...args: any[]): any {
    const firstArg = args[0];

    if (args.length === 1) {
      if (isString(firstArg)) {
        const path = firstArg;
        const chain = {
          route: router.route.bind(router)
        } as FourzeRouteChain;

        for (const method of FOURZE_METHODS) {
          chain[method] = (...args: [FourzeRouteOptions<Record<string, any>>, FourzeHandle] | [FourzeHandle]) => {
            const { handle, options } = overload({
              options: {
                type: Object
              },
              handle: {
                type: Function as PropType<FourzeHandle>,
                required: true
              }
            }, args);

            addRoute({
              ...options,
              path,
              method,
              handle
            });
            delete chain[method];
            return chain;
          };
        }
        return chain;
      } else if (Array.isArray(firstArg)) {
        firstArg.forEach(r => addRoute(r));
      } else {
        addRoute(firstArg);
      }
    } else {
      const baseRoute = overload({
        path: {
          type: String,
          required: true
        },
        method: {
          type: String as PropType<RequestMethod>
        },
        options: {
          type: Object
        },
        handle: {
          type: Function as PropType<FourzeHandle>,
          required: true
        }
      }, args);

      addRoute({
        ...baseRoute.options,
        path: baseRoute.path,
        method: baseRoute.method,
        handle: baseRoute.handle
      });
    }
    return this;
  };

  const setupRouter = createSingletonPromise(async (app: FourzeApp) => {
    try {
      const rs = await setup?.(router, app);
      if (rs) {
        if (Array.isArray(rs)) {
          rs.forEach(r => addRoute(r));
        } else if (rs !== router && isObject(rs)) {
          options.name = rs.name ?? options.name;
          if (rs.meta) {
            Object.assign(meta, rs.meta);
          }
          if (rs.routes) {
            rs.routes.forEach(r => addRoute(r));
          }
        }
      }
    } catch (error) {
      logger.error(error);
      throw error;
    }
  });

  for (const method of FOURZE_METHODS) {
    router[method] = function (
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

  router.setup = setupRouter;

  router.reset = setupRouter.reset;

  return Object.defineProperties(router, {
    routes: {
      get() {
        const routes: FourzeRoute[] = [];
        matcher.traverse(payload => routes.push(payload));
        return routes;
      },
      enumerable: true
    },
    [FourzeRouterFlag]: {
      value: true,
      enumerable: true,
      writable: false
    }
  });
}

export function isRouter(value: any): value is FourzeRouter {
  return !!value && !!value[FourzeRouterFlag];
}
