import type { MaybePromise, MaybeRegex } from "maybe-types";
import { isArray, isFunction } from "./utils/is";
import { createLogger } from "./logger";
import type {
  FourzeApp,
  FourzeAppMeta,
  FourzeContextOptions,
  FourzeHandle,
  FourzeMiddleware,
  FourzeModule,
  FourzeNext,
  FourzePlugin
} from "./shared";
import {
  FOURZE_VERSION
  ,
  createServiceContext
} from "./shared";
import type { DelayMsType } from "./utils";
import {
  createQuery,
  createSingletonPromise, isMatch,
  isObject,
  isString,
  relativePath,
  resolves
} from "./utils";
import { injectMeta } from "./shared/meta";

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

  meta?: FourzeAppMeta

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
  const isSetup = isFunction(args);
  const isRoutes = Array.isArray(args);
  const isOptions = !isSetup && !isRoutes && isObject(args);
  const logger = createLogger("@fourze/core");

  const options = isOptions ? args : {};
  const setup = isSetup ? args : options.setup ?? (() => { });

  const { fallback } = options;

  const persistenceMiddlewareStore = createQuery<FourzeMiddlewareNode>();

  const persistencePluginStore = createQuery<FourzePlugin>();

  const middlewareStore = createQuery<FourzeMiddlewareNode>();

  const pluginStore = createQuery<FourzePlugin>();

  const denys = createQuery<MaybeRegex>();

  const allows = createQuery<MaybeRegex>();

  const meta = { ...options.meta };

  const app = (async (request, response, next?: FourzeNext) => {
    next = next ?? fallback;
    const { url } = request;

    await app.ready();

    try {
      if (app.isAllow(url)) {
        const ms = app.match(url);

        request.app = app;
        response.setHeader("X-Powered-By", `Fourze App/v${FOURZE_VERSION}`);

        const oldContextPath = request.contextPath;

        async function doNext() {
          const [path, middleware] = ms.shift() ?? [];
          if (middleware) {
            request.contextPath = resolves(app.base, path);
            await middleware(request, response, doNext);
          } else {
            request.contextPath = oldContextPath;
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

  injectMeta(app, meta);

  app.match = function (_url: string) {
    const url = this.relative(_url);
    if (url) {
      return middlewareStore
        .where((r) => isMatch(url, r.path))
        .select(r => [r.path, r.middleware] as [string, FourzeMiddleware])
        .toArray();
    }
    return [];
  };

  app.use = function (
    this: FourzeApp,
    ...args: [string, ...FourzeMiddleware[]] | FourzeModule[]
  ) {
    const arg0 = args[0];
    const isPath = isString(arg0);
    const path = isPath ? arg0 : "/";
    const ms = (isPath ? args.slice(1) : args) as FourzeModule[];

    for (let i = 0; i < ms.length; i++) {
      const middleware = ms[i];
      if (typeof middleware === "function") {
        const node = { path, middleware, order: middleware.order ?? middlewareStore.length };
        if (!this.isReadying) {
          persistenceMiddlewareStore.append(node);
        }
        middlewareStore.append(node);
        logger.info(`use middleware ${middleware.name} at ${path}`);
      } else {
        if (!this.isReadying) {
          persistencePluginStore.append(middleware);
        }
        pluginStore.append(middleware);
      }
    }
    middlewareStore.sort((a, b) => a.order - b.order);
    return this;
  };

  app.remove = function (arg: FourzeMiddleware | string) {
    if (isString(arg)) {
      middlewareStore.delete((r) => r.middleware.name === arg);
      persistenceMiddlewareStore.delete((r) => r.middleware.name === arg);
    }
    return this;
  };

  app.service = async function (this: FourzeApp, options: FourzeContextOptions, next?: FourzeHandle) {
    const { request, response } = createServiceContext(options);
    await this(request, response, async () => {
      await next?.(request, response);
    });
    logger.debug(`service ${request.url} done`);
    return { request, response };
  };

  app.isAllow = function (this: FourzeApp, url: string) {
    let rs = url.startsWith(this.base);
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

  // 初始化中
  let _isReadying = false;

  const ready = createSingletonPromise(async function (this: FourzeApp) {
    _isReadying = true;
    pluginStore.reset(persistencePluginStore);
    middlewareStore.reset(persistenceMiddlewareStore);

    try {
    // 初始化app
      const setupReturn = await setup(this);

      if (isArray(setupReturn)) {
        this.use(...setupReturn);
      } else if (setupReturn) {
        Object.assign(options, setupReturn);
      }
    } catch (e) {
      logger.error(e);
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
    const installPlugins = pluginStore.select(async r => {
      if (r.install) {
        try {
          await r.install(this);
        } catch (e) {
          logger.error(e);
        }
      }
    });

    await Promise.all(installPlugins);

    // 初始化中间件
    const setupMiddlewares = middlewareStore.select(async (r) => {
      if (r.middleware.setup) {
        try {
          await r.middleware.setup(this);
        } catch (e) {
          logger.error(e);
        }
      }
    });

    await Promise.all(setupMiddlewares);

    // 准备完成
    _isReadying = false;
    _isReady = true;
  });

  app.ready = ready;

  app.reset = async function () {
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
      },
      enumerable: true
    },
    base: {
      get() {
        return options.base ?? "/";
      },
      configurable: true,
      enumerable: true
    },
    isReady: {
      get() {
        return _isReady;
      },
      enumerable: true
    },
    isReadying: {
      get() {
        return _isReadying;
      },
      enumerable: true
    }
  });

  return app;
}

