import { basename, extname, join, normalize, resolve } from "pathe";
import fs from "fs-extra";
import glob from "fast-glob";
import {
  createApp,
  createLogger,
  defineMiddleware,
  isFourzeModule,
  isFunction,
  overload
} from "@fourze/core";
import type {
  DelayMsType,
  FourzeApp,
  FourzeAppOptions,
  FourzeBaseRoute,
  FourzeModule,
  PropType
} from "@fourze/core";
import type { FSWatcher } from "chokidar";
import micromatch from "micromatch";
import { createImporter } from "./importer";

export interface FourzeHmrOptions extends Exclude<FourzeAppOptions, "setup"> {

  dir?: string

  files?: {
    pattern?: string[]
    ignore?: string[]
  } | string[]

}

export interface FourzeHmrBuildConfig {
  define?: Record<string, any>
  alias?: Record<string, string>
}

export interface FourzeHmrApp extends FourzeApp {
  watch(): this
  watch(dir: string): this
  watch(watcher: FSWatcher): this
  watch(dir: string, watcher: FSWatcher): this
  proxy(p: string | FourzeProxyOption): this
  configure(config: FourzeHmrBuildConfig): this
  delay?: DelayMsType
  readonly base: string
  readonly moduleNames: string[]
}

export interface FourzeProxyOption extends Omit<FourzeBaseRoute, "handle"> {
  target?: string
}

export function createHmrApp(options: FourzeHmrOptions = {}): FourzeHmrApp {
  const rootDir = normalize(resolve(process.cwd(), options.dir ?? "router"));

  const fsOptions = options.files ?? {};
  const isFsPattern = Array.isArray(fsOptions);

  const fsPattern = isFsPattern ? fsOptions : fsOptions.pattern ?? ["**/*.ts", "**/*.js"];
  const fsIgnore = isFsPattern ? [] : fsOptions.ignore ?? [];

  const moduleMap = new Map<string, FourzeModule>();

  const logger = createLogger("@fourze/server");

  const buildConfig: FourzeHmrBuildConfig = {
    define: {},
    alias: {}
  };

  logger.debug(`create hmr app with root dir ${rootDir} with base ${options.base ?? "/"}`);

  const app = createApp({
    ...options,
    setup: async () => {
      await load();
      return Array.from(moduleMap.values());
    }
  }) as FourzeHmrApp;

  const _import = createImporter(__filename);

  app.configure = function (this: FourzeHmrApp, newConfig: FourzeHmrBuildConfig) {
    buildConfig.define = {
      ...buildConfig.define,
      ...newConfig.define
    };

    buildConfig.alias = {
      ...buildConfig.alias,
      ...newConfig.alias
    };
    _import.configure({ ...buildConfig });
    return this;
  };

  async function load(moduleName: string = rootDir): Promise<boolean> {
    if (fs.existsSync(moduleName)) {
      const stat = await fs.promises.stat(moduleName);
      if (stat.isDirectory()) {
        const files = await glob(fsPattern, { cwd: moduleName });
        const tasks = files.map((name) => load(join(moduleName, name)));
        return await Promise.all(tasks).then((r) => r.some((f) => f));
      } else if (stat.isFile()) {
        if (!micromatch.some(moduleName, fsPattern, {
          dot: true,
          matchBase: true,
          ignore: fsIgnore
        })) {
          logger.warn(`load file ${moduleName} not match pattern ${fsPattern.join(",")}`);
          return false;
        }
        try {
          const instance = _import(moduleName);

          if (isFourzeModule(instance)) {
            moduleMap.set(moduleName, instance);
            return true;
          }

          if (isFunction(instance)) {
            moduleMap.set(moduleName, defineMiddleware(basename(moduleName, extname(moduleName)), instance));
            return true;
          }
          logger.warn(`load module "${moduleName}" is not a valid module`);
        } catch (e) {
          logger.error(`load module "${moduleName}" error`, e);
        }
        return false;
      }
    }
    logger.warn(`load file ${moduleName} not found`);

    return false;
  }

  const _remove = app.remove;

  app.remove = function (this: FourzeHmrApp, moduleName: string) {
    _remove(moduleName);
    _import.remove(moduleName);
    moduleMap.delete(moduleName);
    return this;
  };

  app.watch = function (
    this: FourzeHmrApp,
    ...args: [] | [string, FSWatcher] | [string] | [FSWatcher]
  ) {
    const { dir, watcher } = overload(
      {
        dir: {
          type: String,
          default: () => rootDir,
          transform(v) {
            return normalize(v);
          }
        },
        watcher: {
          type: Object as PropType<FSWatcher>,
          default: (): FSWatcher => {
            const chokidar = require("chokidar") as typeof import("chokidar");
            return chokidar.watch([]);
          }
        }
      },
      args
    );

    logger.debug("[hmr]", `watch ${dir} with pattern ${fsPattern.join(",")}`);

    watcher.add(dir);

    watcher.on("all", async (event, path) => {
      path = normalize(path);
      if (!path.startsWith(dir)) {
        return;
      }

      logger.debug("[hmr]", `watcher event ${event} ${path}`);

      switch (event) {
        case "add": {
          const isLoaded = await load(path);
          if (isLoaded) {
            logger.info("[hmr]", `load module ${path}`);
          }
          break;
        }
        case "change": {
          this.remove(path);
          const isLoaded = await load(path);
          if (isLoaded) {
            logger.info("[hmr]", `reload module ${path}`);
          }
          break;
        }
        case "unlink":
          this.remove(path);
          logger.info("[hmr]", `remove module ${path}`);
          break;
      }
      await this.reset();
    });
    return this;
  };

  return Object.defineProperties(app, {
    moduleNames: {
      get() {
        return [...moduleMap.keys()];
      },
      enumerable: true
    }
  });
}
