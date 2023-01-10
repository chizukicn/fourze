import type { MaybeAsyncFunction, MaybePromise, MaybeRegex } from "maybe-types";
import type { Fourze, FourzeSetup } from "./app";
import { defineFourze, isFourze } from "./app";
import { delayHook } from "./endpoints";
import { createLogger } from "./logger";
import type {
  FourzeContext,
  FourzeContextOptions,
  FourzeHook,
  FourzeInstance,
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
import { FOURZE_METHODS, createServiceContext } from "./shared";
import type { DelayMsType } from "./utils";
import {
  createQuery,
  createSingletonPromise,
  isConstructor,
  isFunction,
  isMatch,
  isString,
  isUndef,
  normalizeRoute,
  relativePath
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
    allowed?: boolean
  ): [FourzeRoute, RegExpMatchArray] | []

  /**
   *  是否允许,但不一定匹配
   * @param url
   */
  isAllow(url: string): boolean

  refresh(): void

  route: FourzeRouteFunction<FourzeRouter>

  setup(): MaybePromise<void>

  use(module: FourzeInstance): this
  use(setup: FourzeSetup): this
  use(path: string, setup: FourzeSetup): this

  service(context: FourzeContextOptions): Promise<FourzeContext>

  allow(...rules: MaybeRegex[]): this
  deny(...rules: MaybeRegex[]): this

  readonly base: string

  readonly name: string

  readonly routes: FourzeRoute[]
  readonly hooks: FourzeHook[]

  readonly modules: FourzeInstance[]
}

export interface FourzeRouterOptions {
  name?: string
  /**
   * @example localhost
   */
  host?: string
  port?: string

  /**
   *  路由模块
   */
  modules?: FourzeInstance[]

  /**
   *  延时
   */
  delay?: DelayMsType

  /**
   * 允许的路径规则,默认为所有
   * @default []
   */
  allow?: MaybeRegex[]

  /**
   *  不允许的路径规则
   */
  deny?: MaybeRegex[]

  /**
   *  不在base域下的外部路径
   *  @example ["https://www.example.com"]
   */
  external?: MaybeRegex[]
}

export function createRouter(): FourzeRouter;

export function createRouter(options: FourzeRouterOptions): FourzeRouter;

export function createRouter(modules: Fourze[]): FourzeRouter;

export function createRouter(
  setup: MaybeAsyncFunction<Fourze[] | FourzeRouterOptions>
): FourzeRouter;

export function createRouter(
  params:
  | FourzeRouterOptions
  | Fourze[]
  | MaybeAsyncFunction<FourzeInstance[] | FourzeRouterOptions> = {}
): FourzeRouter {
  const isFunc = isFunction(params);
  const isArray = Array.isArray(params);
  const isOptions = !isFunc && !isArray;
  const setup: MaybeAsyncFunction<FourzeInstance[] | FourzeRouterOptions>
    = isFunc ? params : () => params;
  const modules = createQuery<FourzeInstance>();

  const options = isOptions ? params : {};

  const routes = createQuery<FourzeRoute>();

  const hooks = createQuery<FourzeHook>();

  const logger = createLogger("@fourze/core");

  const router = async function (
    request: FourzeRequest,
    response: FourzeResponse,
    next?: FourzeNext
  ) {
    const { method } = request;

    const path = relativePath(request.path, router.base);

    Object.defineProperties(request, {
      relativePath: {
        get() {
          return path;
        },
        configurable: true
      },
      contextPath: {
        get() {
          return router.base;
        },
        configurable: true
      }
    });

    const isAllowed = router.isAllow(path);

    if (isAllowed) {
      await router.setup();

      const [route, matches] = router.match(path, method, true);
      const activeHooks = router.hooks.filter((e) => isMatch(path, e.path));

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
      }

      const handle = async (): Promise<any> => {
        let _result: any;
        const hook = activeHooks.shift();

        if (hook) {
          const hookReturn = await hook.handle(request, response, handle);
          _result = hookReturn ?? _result;
        } else {
          if (route) {
            const routeReturn = await route.handle(request, response);
            _result = routeReturn ?? _result;
          }
        }
        return _result;
      };
      response.matched = !!route;
      try {
        const result = await handle();
        if (result) {
          response.send(result);
        }
      } catch (error: any) {
        response.sendError(500, error.message);
      }
    }

    if (response.matched) {
      logger.info(
        `Request matched -> ${normalizeRoute(request.path, method)}.`
      );
      if (!response.writableEnded) {
        response.end();
      }
    } else {
      if (isAllowed) {
        logger.warn(
          `Request is allowed but not matched -> ${normalizeRoute(
            request.path,
            method
          )}.`
        );
      }
      await next?.();
    }
  } as FourzeRouter;

  router.isAllow = function (url: string) {
    const { allow, deny, external } = options;
    let rs = true;

    if (allow?.length) {
      // 有允许规则
      rs &&= isMatch(url, ...allow);
    }
    if (external?.length) {
      // 有外部规则
      rs ||= isMatch(url, ...external);
    }
    if (deny?.length) {
      // 有拒绝规则,优先级最高
      rs &&= !isMatch(url, ...deny);
    }
    return rs;
  };

  router.match = function (
    this: FourzeRouter,
    url: string,
    method?: string,
    allowed = false
  ): [FourzeRoute, RegExpMatchArray] | [] {
    if (allowed || this.isAllow(url)) {
      for (const route of this.routes) {
        const matches = route.match(url, method);
        if (matches) {
          return [route, matches];
        }
      }
    }
    return [];
  };

  router.service = async function (
    this: FourzeRouter,
    options: FourzeContextOptions
  ) {
    const { request, response } = createServiceContext(options);
    await this(request, response);
    return { request, response };
  };

  router.allow = function (...rules: MaybeRegex[]) {
    options.allow = options.allow ?? [];
    options.allow.push(...rules);
    return this;
  };

  router.deny = function (...rules: MaybeRegex[]) {
    options.deny = options.deny ?? [];
    options.deny.push(...rules);
    return this;
  };

  router.use = function (
    module: FourzeInstance | FourzeSetup | string,
    setup?: FourzeSetup
  ) {
    if (isString(module)) {
      if (!setup) {
        return this;
      }
      module = defineFourze(module, setup);
    } else if (isFunction(module)) {
      module = defineFourze(module);
    }

    modules.append(module);
    this.refresh();

    return this;
  };

  const setupRouter = createSingletonPromise(async () => {
    const rs = await setup();
    const isArray = Array.isArray(rs);

    if (!isArray) {
      options.allow = rs.allow ?? options.allow;
      options.delay = rs.delay ?? options.delay;
      options.modules = rs.modules ?? options.modules;
      options.deny = rs.deny ?? options.deny;
      options.external = rs.external ?? options.external;
    } else {
      options.modules = rs;
    }

    modules.append(...(options.modules ?? []));

    modules.distinct();

    const newRoutes: FourzeRoute[] = [];
    const newHooks: FourzeHook[] = [];

    await Promise.all(
      modules.select(async (e) => {
        if (isFourze(e)) {
          await e.setup();
        }
        newRoutes.push(...e.routes);
        newHooks.push(...e.hooks);
      })
    );
    hooks.reset(newHooks);

    if (options.delay) {
      hooks.append(delayHook(options.delay));
    }

    routes.reset(newRoutes);
  });

  const coreModule = defineFourze();

  Object.defineProperties(router, {
    ...Object.fromEntries(
      [...FOURZE_METHODS, "route"].map((method) => [
        method,
        {
          get() {
            return function (
              this: FourzeRouter,
              path: string,
              ...others: any[]
            ) {
              const args = [
                path,
                method === "route" ? undefined : method,
                ...others
              ] as unknown as Parameters<Fourze>;
              coreModule(...args);
              return this;
            };
          }
        }
      ])
    ),
    name: {
      get() {
        return options.name ?? "FourzeRouter";
      }
    },
    setup: {
      get() {
        return setupRouter;
      }
    },
    options: {
      get() {
        const opt = {} as Required<FourzeRouterOptions>;
        opt.delay = options.delay ?? 0;
        opt.allow = options.allow ?? [];
        opt.deny = options.deny ?? [];
        opt.modules = options.modules ?? [];
        return opt;
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
    hooks: {
      get() {
        return Array.from(hooks);
      }
    },
    modules: {
      get() {
        return Array.from(modules);
      }
    }
  });

  router.use(coreModule);

  return router;
}

function isExtends<D>(types: PropType<D>, type: PropType<D>): boolean {
  if (Array.isArray(types)) {
    return types.some((e) => isExtends(e, type));
  }
  return types === type;
}

export function validateProps(
  props: ObjectProps,
  data: Record<string, unknown>
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
