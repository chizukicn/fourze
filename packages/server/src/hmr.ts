import type {
  DelayMsType,
  FourzeApp,
  FourzeAppOptions,
  FourzeBaseRoute,
  FourzeModule,
  PropType
} from "@fourze/core";
import type { FSWatcher } from "chokidar";
import { existsSync } from "node:fs";
import { stat as fsStat } from "node:fs/promises";
import process from "node:process";
import {
  createApp,
  createLogger,
  defineMiddleware,
  isFourzeModule,
  isFunction,
  overload
} from "@fourze/core";
import glob from "fast-glob";
import micromatch from "micromatch";
import { basename, extname, join, normalize, resolve } from "pathe";
import { createImporter } from "./importer";

;

export interface FourzeHmrOptions extends Exclude<FourzeAppOptions, "setup"> {

  dir?: string;

  files?: {
    include?: string[];
    exclude?: string[];
  } | string[];

}

export interface FourzeHmrBuildConfig {
  define?: Record<string, any>;
  alias?: Record<string, string>;
}

export interface FourzeHmrApp extends FourzeApp {
  watch: (() => this) & ((dir: string) => this) & ((watcher: FSWatcher) => this) & ((dir: string, watcher: FSWatcher) => this);
  proxy: (p: string | FourzeProxyOption) => this;
  configure: (config: FourzeHmrBuildConfig) => this;
  delay?: DelayMsType;
  readonly base: string;
  readonly moduleNames: string[];
}

export interface FourzeProxyOption extends Omit<FourzeBaseRoute, "handle"> {
  target?: string;
}

export function createHmrApp(options: FourzeHmrOptions = {}): FourzeHmrApp {
  const rootDir = normalize(resolve(process.cwd(), options.dir ?? "router"));

  const fsOptions = options.files ?? {};
  const isFsPattern = Array.isArray(fsOptions);

  const fsInclude = isFsPattern ? fsOptions : fsOptions.include ?? ["**/*.ts", "**/*.js"];
  const fsExclude = isFsPattern ? [] : fsOptions.exclude ?? [];

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

  const _filename = import.meta.url;

  const _import = createImporter(_filename);

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
    if (existsSync(moduleName)) {
      const stat = await fsStat(moduleName);
      if (stat.isDirectory()) {
        const files = await glob(fsInclude, { cwd: moduleName, onlyFiles: false, markDirectories: true });
        const tasks = files.map((name) => load(join(moduleName, name)));
        return await Promise.all(tasks).then((r) => r.some((f) => f));
      } else if (stat.isFile()) {
        if (!micromatch.some(moduleName, fsInclude, {
          dot: true,
          matchBase: true,
          ignore: fsExclude
        })) {
          logger.debug("[hmr]", `load file ${moduleName} not match pattern ${fsInclude.join(",")}`);
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
          logger.warn("[hmr]", `load module "${moduleName}" is not a valid module`);
        } catch (e) {
          logger.error("[hmr]", `load module "${moduleName}" error`, e);
        }
        return false;
      }
    }
    logger.warn("[hmr]", `load file ${moduleName} not found`);

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

    logger.debug("[hmr]", `watch ${dir} with pattern ${fsInclude.join(",")}`);

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
