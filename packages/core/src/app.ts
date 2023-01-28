import type { MaybePromise, MaybeRegex } from "maybe-types";
import { isArray } from "./utils/is";
import { createLogger } from "./logger";
import type {
  FourzeApp,
  FourzeContextOptions,
  FourzeHandle,
  FourzeMiddleware,
  FourzeModule,
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

export type FourzeAppSetup = (app: FourzeApp) => MaybePromise<void | FourzeModule[] | FourzeAppOptions>;

export interface FourzeAppOptions {
  base?: string

  modules?: FourzeModule[]

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

  const denys = createQuery<MaybeRegex>();

  const allows = createQuery<MaybeRegex>();

  const app = (async (request, response, next?: FourzeNext) => {
    next = next ?? fallback;
    const { url } = request;

    try {
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
    } catch (error: any) {
      response.sendError(500, error);
    }
  }) as FourzeApp;

  app.match = function (_url: string) {
    const url = this.relative(_url);
    if (url) {
      return middlewareStore
        .where((r) => isMatch(url, r.path))
        .select((r) => r.middleware)
        .toArray();
    }
    return [];
  };

  app.use = function (
    ...args: [string, ...FourzeMiddleware[]] | FourzeModule[]
  ) {
    const arg0 = args[0];
    const isPath = isString(arg0);
    const path = resolvePath(isPath ? arg0 : "/", "/");
    const ms = (isPath ? args.slice(1) : args) as FourzeModule[];

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
    middlewareStore.sort((a, b) => a.order - b.order);
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
    let rs = true;
    if (allows.length) {
      // 有允许规则
      rs &&= isMatch(url, ...allows);
    }
    if (denys.length) {
      // 有拒绝规则,优先级最高
      rs &&= !isMatch(url, ...denys);
    }
    return rs;
  };

  app.allow = function (...rules: MaybeRegex[]) {
    allows.append(...rules);
    return this;
  };

  app.deny = function (...rules: MaybeRegex[]) {
    denys.append(...rules);
    return this;
  };

  let _isReady = false;

  const ready = createSingletonPromise(async function (this: FourzeApp) {
    // 初始化app
    const setupReturn = await setup(this);

    if (isArray(setupReturn)) {
      this.use(...setupReturn);
    } else if (setupReturn) {
      Object.assign(options, setupReturn);
    }

    if (options.allow?.length) {
      app.allow(...options.allow);
    }

    if (options.deny?.length) {
      app.deny(...options.deny);
    }

    // 装载中间件
    if (options.modules?.length) {
      app.use(...options.modules);
    }

    // 装载插件
    const installPlugins = pluginStore.select(async r => r.install(this)).toArray();
    await Promise.all(installPlugins);

    // 初始化中间件
    const setupMiddlewares = middlewareStore.select(async (r) => r.middleware.setup?.(this));
    await Promise.all(setupMiddlewares);

    // 准备完成
    _isReady = true;
  });

  app.ready = ready;

  app.reset = async function () {
    middlewareStore.clear();
    pluginStore.clear();
    _isReady = false;
    await ready.reset();
  };

  app.relative = function (url: string) {
    return relativePath(url, this.base);
  };

  Object.defineProperties(app, {
    middlewares: {
      get() {
        return middlewareStore.select(r => r.middleware).toArray();
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

  return app;
}
