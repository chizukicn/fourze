import type { MaybePromise, MaybeRegex } from "maybe-types";
import { createLogger } from "./logger";
import type {
  FourzeApp,
  FourzeContextOptions,
  FourzeHandle,
  FourzeMiddleware,
  FourzeNext,
  FourzePlugin
} from "./shared";
import {
  createServiceContext
  ,
  isFourzePlugin

} from "./shared";
import type { DelayMsType } from "./utils";
import {
  createQuery, createSingletonPromise,
  isMatch,
  isObject,
  isString,
  relativePath,
  resolvePath
} from "./utils";

export type FourzeAppSetup = (app: FourzeApp) => MaybePromise<void | FourzeMiddleware[] | FourzeAppOptions>;

export interface FourzeAppOptions {
  base?: string

  middlewares?: FourzeMiddleware[]

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

  setup?: FourzeAppSetup

  fallback?: FourzeNext
}

export interface FourzeMiddlewareNode {
  middleware: FourzeMiddleware
  path: string
  order: number
}

export function createApp(): FourzeApp;

export function createApp(setup: FourzeAppSetup): FourzeApp;

export function createApp(options: FourzeAppOptions): FourzeApp;

export function createApp(args: FourzeAppOptions | FourzeAppSetup = {}): FourzeApp {
  const isSetup = typeof args === "function";
  const isRoutes = Array.isArray(args);
  const isOptions = !isSetup && !isRoutes && isObject(args);
  const logger = createLogger("@fourze/core");

  const options = isOptions ? args : {};
  const setup = isSetup ? args : options.setup ?? (() => { });

  const { fallback } = options;

  const middlewareStore = createQuery<FourzeMiddlewareNode>();

  const pluginStore = createQuery<FourzePlugin>();

  const app = (async (request, response, next?: FourzeNext) => {
    next = next ?? fallback;
    const { url } = request;
    if (app.isAllow(url)) {
      const ms = app.match(url);

      async function doNext() {
        const middleware = ms.shift();
        if (middleware) {
          await middleware(request, response, doNext);
        } else {
          return await next?.();
        }
      }
      await doNext();
    } else {
      await next?.();
    }
  }) as FourzeApp;

  app.getMiddlewares = function () {
    middlewareStore.sort((a, b) => a.order - b.order);
    return middlewareStore.toArray();
  };

  app.match = function (_url: string) {
    const url = this.relative(_url);
    if (url) {
      const middlewares = this.getMiddlewares();
      return createQuery(middlewares)
        .where((r) => isMatch(url, r.path))
        .select((r) => r.middleware)
        .toArray();
    }
    return [];
  };

  app.use = function (
    ...args: [string, ...FourzeMiddleware[]] | FourzeMiddleware[] | FourzePlugin[]
  ) {
    const arg0 = args[0];
    const isPath = isString(arg0);
    const path = resolvePath(isPath ? arg0 : "/", "/");
    const ms = (isPath ? args.slice(1) : args) as FourzeMiddleware[];

    for (let i = 0; i < ms.length; i++) {
      const middleware = ms[i];
      if (isFourzePlugin(middleware)) {
        pluginStore.append(middleware);
      } else {
        Object.defineProperty(middleware, "base", {
          value: resolvePath(path, this.base),
          writable: false,
          configurable: true
        });
        middlewareStore.append({ path, middleware, order: middleware.order ?? middlewareStore.length });
        logger.info(`use middleware ${middleware.name} at ${path}`);
      }
    }

    return this;
  };

  app.remove = function (arg: FourzeMiddleware | string) {
    if (isString(arg)) {
      middlewareStore.delete((r) => r.middleware.name === arg);
    }
    return this;
  };

  app.service = async function (this: FourzeApp, options: FourzeContextOptions, next?: FourzeHandle) {
    const { request, response } = createServiceContext(options);
    await this(request, response, async () => {
      await next?.(request, response);
    });
    logger.info(`service ${request.url} done`);
    return { request, response };
  };

  app.isAllow = function (url: string) {
    const { allow, deny } = options;
    let rs = true;
    if (allow?.length) {
      // 有允许规则
      rs &&= isMatch(url, ...allow);
    }
    if (deny?.length) {
      // 有拒绝规则,优先级最高
      rs &&= !isMatch(url, ...deny);
    }
    return rs;
  };

  app.allow = function (...rules: MaybeRegex[]) {
    const { allow } = options;
    options.allow = [...(allow ?? []), ...rules];
    return this;
  };

  app.deny = function (...rules: MaybeRegex[]) {
    const { deny } = options;
    options.deny = [...(deny ?? []), ...rules];
    return this;
  };

  let _isReady = false;

  app.ready = createSingletonPromise(async function (this: FourzeApp) {
    // 初始化app
    await setup(this);
    // 装载插件
    const installPlugins = pluginStore.select(async r => r.install(this)).toArray();
    await Promise.all(installPlugins);
    // 初始化中间件
    const setupMiddlewares = this.middlewares.map(async (r) => r.setup?.(this));
    await Promise.all(setupMiddlewares);
    // 准备完成
    _isReady = true;
  });

  app.relative = function (url: string) {
    return relativePath(url, this.base);
  };

  Object.defineProperties(app, {
    middlewares: {
      get() {
        return app.getMiddlewares();
      }
    },
    base: {
      get() {
        return options.base ?? "/";
      },
      configurable: true
    },
    isReady: {
      get() {
        return _isReady;
      }
    }
  });

  if (options.middlewares?.length) {
    app.use(...options.middlewares);
  }

  return app;
}
