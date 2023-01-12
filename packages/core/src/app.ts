import type { MaybeRegex } from "maybe-types";
import type {
  FourzeApp,
  FourzeContextOptions,
  FourzeMiddleware,
  FourzeNext
} from "./shared";
import { createServiceContext } from "./shared";
import type { DelayMsType } from "./utils";
import {
  createQuery,
  isMatch,
  isString,
  relativePath,
  resolvePath
} from "./utils";

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

  fallback?: FourzeNext
}

export interface FourzeMiddlewareNode {
  middleware: FourzeMiddleware
  path: string
}

export function createApp(options: FourzeAppOptions = {}): FourzeApp {
  const { fallback } = options;

  const middlewareStore = createQuery<FourzeMiddlewareNode>();

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
    ...args: [string, ...FourzeMiddleware[]] | FourzeMiddleware[]
  ) {
    const arg0 = args[0];
    const isPath = isString(arg0);
    const path = resolvePath(isPath ? arg0 : "/", "/");
    const ms = (isPath ? args.slice(1) : args) as FourzeMiddleware[];
    ms.forEach((r) => {
      Object.defineProperty(r, "base", {
        value: resolvePath(path, this.base),
        writable: false,
        configurable: true
      });

      middlewareStore.append(...ms.map((middleware) => ({ path, middleware })));
    });

    return this;
  };

  app.service = async function (options: FourzeContextOptions) {
    const { request, response } = createServiceContext(options);
    await this(request, response, async () => {
      await fallback?.();
    });
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

  app.mount = async function () {
    const tasks = this.middlewares.map(async (r) => r.setup?.(this));
    await Promise.all(tasks);
  };

  app.relative = function (url: string) {
    return relativePath(url, this.base);
  };

  Object.defineProperties(app, {
    middlewares: {
      get() {
        return middlewareStore.select((r) => r.middleware).toArray();
      }
    },
    base: {
      get() {
        return options.base ?? "/";
      },
      configurable: true
    }
  });

  return app;
}
