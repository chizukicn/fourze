import type { MaybePromise, MaybeRegex } from "maybe-types";
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
import { withBase, withoutBase, withoutTrailingSlash, withTrailingSlash } from "ufo";
import { createLogger } from "./logger";
import { createServiceContext, FOURZE_VERSION } from "./shared";
import { injectMeta } from "./shared/meta";
import {
  createSingletonPromise,
  deleteBy,
  isArray,
  isFunction,
  isMatch,
  isObject,
  isString,
  isUndef,
  restoreArray
} from "./utils";

export type FourzeAppSetup = (
  app: FourzeApp
) => MaybePromise<void | FourzeModule[] | FourzeAppOptions>;

export interface FourzeAppOptions {
  base?: string;

  modules?: FourzeModule[];

  /**
   * 允许的路径规则,默认为所有
   * @default []
   */
  allow?: MaybeRegex[];

  /**
   *  不允许的路径规则
   */
  deny?: MaybeRegex[];

  meta?: FourzeAppMeta;

  setup?: FourzeAppSetup;

  fallback?: FourzeNext;
}

export interface FourzeMiddlewareNode {
  middleware: FourzeMiddleware;
  path: string;
  order: number;
}

export function createApp(): FourzeApp;

export function createApp(setup: FourzeAppSetup): FourzeApp;

export function createApp(options: FourzeAppOptions): FourzeApp;

export function createApp(
  args: FourzeAppOptions | FourzeAppSetup = {}
): FourzeApp {
  const isSetup = isFunction(args);
  const isRoutes = Array.isArray(args);
  const isOptions = !isSetup && !isRoutes && isObject(args);
  const logger = createLogger("@fourze/core");

  const options = isOptions ? args : {};
  const setup = isSetup ? args : options.setup ?? (() => {});

  const { fallback } = options;

  const persistenceMiddlewareStore: FourzeMiddlewareNode[] = [];

  const persistencePluginStore: FourzePlugin[] = [];

  const middlewareStore: FourzeMiddlewareNode[] = [];

  const pluginStore: FourzePlugin[] = [];

  const denys: MaybeRegex[] = [];

  const allows: MaybeRegex[] = [];

  const meta = { ...options.meta };

  const app = (async (request, response, next?: FourzeNext) => {
    next = next ?? fallback;
    const { path } = request;

    await app.ready();

    try {
      if (app.isAllow(path)) {
        const ms = app.match(path);

        request.app = app;
        response.setHeader("X-Powered-By", `Fourze/v${FOURZE_VERSION}`);

        async function doNext() {
          const nextNode = ms.shift();
          if (nextNode) {
            const [path, middleware] = nextNode;
            const req = request.withScope(withBase(path, app.base));
            await middleware(req, response, doNext);
          } else {
            await next?.();
          }
        }
        await doNext();
        //  await response.done();
      } else {
        await next?.();
      }
    } catch (error: any) {
      response.sendError(error);
    }
  }) as FourzeApp;

  injectMeta(app, meta);

  app.match = function (_url: string) {
    const url = this.relative(_url);
    if (url) {
      return middlewareStore
        .sort((a, b) => a.order - b.order)
        .filter((r) => url.match(r.path))
        .map((r) => [r.path, r.middleware] as [string, FourzeMiddleware]);
    }
    return [];
  };

  app.use = function (
    this: FourzeApp,
    ...args: [string, ...FourzeMiddleware[]] | FourzeModule[]
  ) {
    const arg0 = args[0];
    const isPath = isString(arg0);
    const path = withoutTrailingSlash(isPath ? arg0 : "/");
    const ms = (isPath ? args.slice(1) : args) as FourzeModule[];

    for (let i = 0; i < ms.length; i++) {
      const middleware = ms[i];
      if (isUndef(middleware)) {
        continue;
      }
      if (typeof middleware === "function") {
        const node = {
          path,
          middleware,
          order: middleware.order ?? middlewareStore.length
        };
        if (!this.isReadying) {
          persistenceMiddlewareStore.push(node);
        }
        middlewareStore.push(node);
        logger.info(`use middleware [${middleware.name}] at ${path}`);
      } else {
        if (!this.isReadying) {
          persistencePluginStore.push(middleware);
        }
        pluginStore.push(middleware);
      }
    }
    middlewareStore.sort((a, b) => a.order - b.order);
    return this;
  };

  app.remove = function (arg: FourzeMiddleware | string) {
    if (isString(arg)) {
      deleteBy(middlewareStore, (r) => r.middleware.name === arg);
      deleteBy(persistenceMiddlewareStore, (r) => r.middleware.name === arg);
    }
    return this;
  };

  app.service = async function (
    this: FourzeApp,
    options: FourzeContextOptions,
    next?: FourzeHandle
  ) {
    const { request, response } = createServiceContext(options);
    await this(request, response, async () => {
      await next?.(request, response);
    });
    logger.debug(`service ${request.url} done`);
    return { request, response };
  };

  app.isAllow = function (this: FourzeApp, url: string) {
    return isMatch(url, allows, denys);
  };

  app.allow = function (...rules: MaybeRegex[]) {
    allows.push(...rules);
    return this;
  };

  app.deny = function (...rules: MaybeRegex[]) {
    denys.push(...rules);
    return this;
  };

  let _isReady = false;

  // 初始化中
  let _isReadying = false;

  const ready = createSingletonPromise(async function (this: FourzeApp) {
    _isReadying = true;

    restoreArray(middlewareStore, persistenceMiddlewareStore);
    restoreArray(pluginStore, persistencePluginStore);

    try {
      // 初始化app
      const setupReturn = await setup(this);

      if (isArray(setupReturn)) {
        this.use(...setupReturn);
      } else if (setupReturn) {
        Object.assign(options, setupReturn);
      }
      options.base = withTrailingSlash(options.base);
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
    const installPlugins = pluginStore.map(async (r) => {
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
    const setupMiddlewares = middlewareStore.map(async (r) => {
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
    return withoutBase(url, this.base);
  };

  Object.defineProperties(app, {
    middlewares: {
      get() {
        return middlewareStore.map((r) => r.middleware);
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
