import fs from "fs";
import { join, resolve } from "path";
import { createApp, createLogger, isFunction, isString } from "@fourze/core";
import type {
  DelayMsType,
  FourzeApp,
  FourzeAppOptions,
  FourzeBaseRoute,
  FourzeMiddleware

} from "@fourze/core";
import type { FSWatcher } from "chokidar";
import { defineEnvs, normalizePath } from "./utils";

export interface FourzeHmrOptions extends FourzeAppOptions {
  /**
   * 路由模块目录
   * @default "routes"
   */
  dir?: string
  /**
   * 文件监听器
   */
  watcher?: FSWatcher

  /**
   * 文件匹配规则
   */
  pattern?: (string | RegExp)[]

  /**
   * 模块文件路径
   */
  moduleNames?: string[]

  /**
   * 响应延迟时间
   * @default 0
   */
  delay?: DelayMsType
}

export interface FourzeHmrApp extends FourzeApp {
  load(): Promise<boolean>
  load(moduleName: string): Promise<boolean>
  remove(moduleName: string): this
  watch(watcher?: FSWatcher): this
  watch(dir?: string, watcher?: FSWatcher): this
  proxy(p: string | FourzeProxyOption): this
  define(key: string, value: string): this
  define(env: Record<string, any>): this
  delay?: DelayMsType
  readonly env: Record<string, any>
  readonly base: string
  readonly moduleNames: string[]
}

const TEMPORARY_FILE_SUFFIX = ".tmp.js";

function transformPattern(pattern: (string | RegExp)[]) {
  return pattern.map((p) => {
    if (isString(p)) {
      return new RegExp(p);
    }
    return p;
  });
}

export interface FourzeProxyOption extends Omit<FourzeBaseRoute, "handle"> {
  target?: string
}

export function createHmrApp(options: FourzeHmrOptions = {}): FourzeHmrApp {
  const delay = options.delay ?? 0;
  const rootDir = resolve(process.cwd(), options.dir ?? "router");

  const pattern = transformPattern(options.pattern ?? [".ts", ".js"]);
  const moduleNames = new Set(Array.from(options.moduleNames ?? []));

  const logger = createLogger("@fourze/server");

  const extraModuleMap = new Map<string, FourzeMiddleware[]>();

  const app = createApp({
    ...options
  }) as FourzeHmrApp;

  const env: Record<string, any> = {};

  app.load = async function (this: FourzeHmrApp, moduleName: string = rootDir) {
    if (!fs.existsSync(moduleName)) {
      return false;
    }

    const loadJsModule = async (f: string) => {
      try {
        delete require.cache[f];
        const mod = require(f);
        const instance = mod?.default ?? mod;
        const extras: FourzeMiddleware[] = [];

        if (isFunction(instance)) {
          extras.push(instance);
          extraModuleMap.set(f, extras);
          moduleNames.add(f);
        }

        if (extras.length > 0) {
          return true;
        }
        logger.warn(`find not route with "${f}" `);
      } catch (e) {
        logger.error(e);
      }
      return false;
    };

    const loadTsModule = async (mod: string) => {
      if (!fs.existsSync(mod)) {
        return false;
      }
      const modName = mod.replace(".ts", TEMPORARY_FILE_SUFFIX);

      const { build } = require("esbuild") as typeof import("esbuild");
      try {
        await build({
          entryPoints: [mod],
          external: ["@fourze/core"],
          outfile: modName,
          write: true,
          platform: "node",
          bundle: true,
          format: "cjs",
          metafile: true,
          allowOverwrite: true,
          target: "es6",
          define: defineEnvs(env, "import.meta.env.")
        });
        return loadJsModule(modName);
      } catch (err) {
        logger.error(`load file ${modName}`, err);
      } finally {
        try {
          await fs.promises.unlink(modName);
        } catch (err) {
          logger.error(`delete file ${modName} error`, err);
        }
      }
      return false;
    };

    const loadModule = async (mod: string) => {
      if (mod.endsWith(".ts")) {
        return loadTsModule(mod);
      } else {
        return loadJsModule(mod);
      }
    };

    if (fs.existsSync(moduleName)) {
      const stat = await fs.promises.stat(moduleName);
      if (stat.isDirectory()) {
        const files = await fs.promises.readdir(moduleName);
        const tasks = files.map((name) => this.load(join(moduleName, name)));
        return await Promise.all(tasks).then((r) => r.some((f) => f));
      } else if (stat.isFile()) {
        if (!pattern.some((e) => e.test(moduleName))) {
          return false;
        }
        return loadModule(moduleName);
      }
    } else {
      logger.warn(`load file ${moduleName} not found`);
    }
    return false;
  };

  app.watch = function (
    this: FourzeHmrApp,
    dir?: string | FSWatcher,
    customWatcher?: FSWatcher
  ) {
    let watchDir: string;
    let watcher: FSWatcher | undefined;

    if (isString(dir)) {
      watchDir = dir;
      watcher = customWatcher;
    } else {
      watchDir = rootDir;
      watcher = dir;
    }

    if (!watcher) {
      const chokidar = require("chokidar") as typeof import("chokidar");
      watcher = chokidar.watch(watchDir);
    }

    watcher.add(watchDir);

    watcher.on("all", async (event, path) => {
      if (!path.startsWith(watchDir) || path.endsWith(TEMPORARY_FILE_SUFFIX)) {
        return;
      }

      switch (event) {
        case "add": {
          const load = await this.load(path);
          if (load) {
            logger.info(`load module ${path}`);
          }
          break;
        }
        case "change": {
          this.remove(path);
          const load = await this.load(path);
          if (load) {
            logger.info(`reload module ${normalizePath(path)}`);
          }
          break;
        }
        case "unlink":
          this.remove(path);
          logger.info(`remove module ${path}`);
          break;
      }
    });
    return this;
  };

  app.remove = function (this: FourzeHmrApp, moduleName: string) {
    moduleNames.delete(moduleName);
    extraModuleMap.delete(moduleName);
    delete require.cache[moduleName];
    return this;
  };

  app.define = function (
    this: FourzeHmrApp,
    name: string | Record<string, any>,
    value?: any
  ) {
    if (isString(name)) {
      env[name] = value;
    } else {
      Object.assign(env, name);
    }
    return this;
  };

  const _getMiddlewares = app.getMiddlewares;

  app.getMiddlewares = function (this: FourzeHmrApp) {
    const middlewares = _getMiddlewares.call(this);
    return [...middlewares];
  };

  return Object.defineProperties(app, {
    delay: {
      get() {
        return delay;
      }
    },
    env: {
      get() {
        return env;
      }
    },
    moduleNames: {
      get() {
        return Array.from(moduleNames);
      }
    }
  });
}
