import type { MaybeRegex } from "maybe-types";
import type {
  FourzeApp,
  FourzeContextOptions,
  FourzeMiddleware,
  FourzeNext
} from "./shared";
import { createServiceContext } from "./shared";
import type { DelayMsType } from "./utils";
import { isMatch, isString, relativePath, resolvePath } from "./utils";

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

  /**
   *  不在base域下的外部路径
   *  @example ["https://www.example.com"]
   */
  external?: MaybeRegex[]

  fallback?: FourzeNext
}

export function createApp(options: FourzeAppOptions = {}): FourzeApp {
  const { fallback } = options;

  const middlewaresMap = new Map<string, FourzeMiddleware[]>();

  middlewaresMap.set("/", Array.from(options.middlewares ?? []));

  const app = (async (request, response, next?: FourzeNext) => {
    next = next ?? fallback;
    const { url } = request;
    const path = app.relative(url);
    if (path && app.isAllow(url)) {
      const ms = app.match(path);

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

  app.match = (url: string) => {
    return Array.from(middlewaresMap.entries())
      .filter(([path]) => isMatch(url, path))
      .flatMap(([, ms]) => ms);
  };

  app.use = function (
    ...args: [string, ...FourzeMiddleware[]] | FourzeMiddleware[]
  ) {
    const arg0 = args[0];
    const isPath = isString(arg0);
    const path = resolvePath(isPath ? arg0 : "/", "/");
    const ms = isPath ? args.slice(1) : args;
    const old = middlewaresMap.get(path) ?? [];
    middlewaresMap.set(path, [...old, ...ms] as FourzeMiddleware[]);

    ms.forEach((r) => {
      Object.defineProperty(r, "base", {
        value: resolvePath(path, this.base),
        writable: false,
        configurable: true
      });
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
    const { allow, deny, external } = options;
    const path = this.relative(url);
    if (path) {
      let rs = path.startsWith(this.base);
      if (allow?.length) {
        // 有允许规则
        rs &&= isMatch(path, ...allow);
      }
      if (external?.length) {
        // 有外部规则
        rs ||= isMatch(path, ...external);
      }
      if (deny?.length) {
        // 有拒绝规则,优先级最高
        rs &&= !isMatch(path, ...deny);
      }
      return rs;
    }
    return false;
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
        return Array.from(middlewaresMap.values()).flat();
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
