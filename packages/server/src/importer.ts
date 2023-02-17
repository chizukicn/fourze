import { runInThisContext } from "vm";
import { Module, builtinModules } from "module";
import { platform } from "os";
import { pathToFileURL } from "url";
import { dirname, extname, join } from "pathe";
import { normalizeAliases, resolveAlias } from "pathe/utils";
import { createLogger, escapeStringRegexp } from "@fourze/core";
import { readFileSync } from "fs-extra";
import { fileURLToPath, hasESMSyntax, interopDefault, resolvePathSync } from "mlly";
import createRequire from "create-require";
import type { PackageJson } from "pkg-types";

import type { Loader, TransformOptions } from "esbuild";
import { transformSync } from "esbuild";
export interface ModuleImporterOptions {
  esbuild?: TransformOptions
  define?: Record<string, string>
  interopDefault?: boolean
  requireCache?: boolean
  extensions?: string[]
  alias?: Record<string, string> | null
}

type Require = typeof require;

const isWindow = platform() === "win32";

const defaults: ModuleImporterOptions = {
  extensions: [".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".json"],
  interopDefault: true,
  requireCache: true,
  esbuild: {
    format: "cjs",
    target: "es6",
    define: {}
  },
  define: {},
  alias: {}
};

export interface ModuleImporter extends Require {
  (id: string): any
  remove(id: string): void
  clear(): void
  configure(options: ModuleImporterOptions): void
}

export function readNearestPackageJSON(path: string): PackageJson | undefined {
  while (path && path !== "." && path !== "/") {
    path = join(path, "..");
    try {
      const pkg = readFileSync(join(path, "package.json"), "utf8");
      try {
        return JSON.parse(pkg);
      } catch { }
      break;
    } catch { }
  }
}

/**
 * Create a module importer
 * base on original work of @unjs/jiti by Pooya Parsa (MIT)
 * @see https://github.com/unjs/jiti
 * @param _filename
 * @param opts
 * @param parentModule
 * @returns
 */
export function createImporter(_filename: string, opts: ModuleImporterOptions = {}, parentModule?: NodeModule): ModuleImporter {
  const logger = createLogger("@fourze/server");

  const nativeRequire = createRequire(isWindow ? _filename.replace(/\\/g, "/") : _filename);

  const _configure = (options: ModuleImporterOptions) => {
    opts = { ...defaults, ...opts };
    opts.alias = options.alias && Object.keys(options.alias).length > 0
      ? normalizeAliases(options.alias ?? {})
      : null;
    opts.define = { ...opts.define, ...options.define };
    opts.esbuild = {
      ...opts.esbuild ?? options.esbuild
    };
    opts.interopDefault = options.interopDefault ?? opts.interopDefault;
    opts.requireCache = options.requireCache ?? opts.requireCache;
    opts.extensions = options.extensions ?? opts.extensions;
  };

  _configure(opts);

  const tryResolve = (id: string, options?: { paths?: string[] }) => {
    try {
      return nativeRequire.resolve(id, options);
    } catch {
    }
  };

  const _url = pathToFileURL(_filename);
  const nativeModules = ["typescript", ...([])];

  const isNativeRe = new RegExp(
    `node_modules/(${nativeModules
      .map((m) => escapeStringRegexp(m))
      .join("|")})/`
  );

  const _resolve = (id: string, options?: { paths?: string[] }) => {
    if (opts.alias) {
      id = resolveAlias(id, opts.alias);
    }

    const _additionalExts = [...(opts.extensions as string[])].filter(
      (ext) => ext !== ".js"
    );

    let resolved, err;
    try {
      resolved = resolvePathSync(id, {
        url: _url,
        conditions: ["node", "import", "require"]
      });
    } catch (_error) {
      err = _error;
    }
    if (resolved) {
      return resolved;
    }

    if (opts.extensions?.includes(extname(id))) {
      return nativeRequire.resolve(id, options);
    }

    try {
      return nativeRequire.resolve(id, options);
    } catch (error) {
      err = error;
    }

    for (const ext of _additionalExts) {
      resolved = tryResolve(id + ext, options) ?? tryResolve(`${id}/index${ext}`, options);
      if (resolved) {
        return resolved;
      }
    }

    throw err;
  };

  _resolve.paths = nativeRequire.resolve.paths;

  function getLoader(filename: string): Loader {
    const ext = extname(filename);
    switch (ext) {
      case ".js":
        return "js";
      case ".jsx":
        return "jsx";
      case ".json":
        return "json";
      case ".ts":
        return "ts";
      case ".tsx":
        return "tsx";
      case ".css":
        return "css";
      default:
        return "default";
    }
  }

  const _interopDefault = (m: any) => {
    return opts.interopDefault !== false ? interopDefault(m) : m;
  };

  const _require = function (id: string): NodeModule {
    if (id.startsWith("node:")) {
      id = id.slice(5);
    } else if (id.startsWith("file:")) {
      id = fileURLToPath(id);
    }

    if (builtinModules.includes(id) || id === ".pnp.js" /* #24 */) {
      logger.debug("[builtin]", id);
      return nativeRequire(id);
    }

    const filename = _resolve(id);

    const ext = extname(filename);

    if (ext && !opts.extensions!.includes(ext)) {
      logger.debug("[unknown]", filename);
      return nativeRequire(id);
    }

    if (isNativeRe.test(filename)) {
      logger.debug("[native]", filename);
      return nativeRequire(id);
    }

    if (opts.requireCache && nativeRequire.cache[filename]) {
      logger.debug("[cache]", filename);
      return _interopDefault(nativeRequire.cache[filename]?.exports);
    }

    let source = readFileSync(filename, "utf-8");

    const isTypescript = ext === ".ts" || ext === ".tsx";

    const isCommonJS = ext === ".cjs";

    const isNativeModule
      = ext === ".mjs"
      || (ext === ".js" && readNearestPackageJSON(filename)?.type === "module");

    const needsTranspile = !isCommonJS && (isTypescript || isNativeModule || hasESMSyntax(source));

    const _transform = (code: string, filename: string) => {
      code = transformSync(code, {
        ...opts.esbuild,
        platform: opts.esbuild?.platform ?? "node",
        format: opts.esbuild?.format ?? "cjs",
        target: opts.esbuild?.target ?? "es6",
        loader: opts.esbuild?.loader ?? getLoader(filename),
        define: {
          "import.meta.url": JSON.stringify(pathToFileURL(filename).href),
          ...opts.define
        },
        treeShaking: opts.esbuild?.treeShaking ?? true
      }).code;

      return code;
    };

    if (needsTranspile) {
      const start = performance.now();
      source = _transform(source, filename);
      const time = Math.round((performance.now() - start) * 1000) / 1000;
      logger.debug(
        `[transpile]${isNativeModule ? " [esm]" : ""}`,
        filename,
        `(${time}ms)`
      );
    } else {
      try {
        logger.debug("[native]", filename);
        return _interopDefault(nativeRequire(id));
      } catch (error: any) {
        logger.debug("Native require error:", error);
        logger.debug("[fallback]", filename);
        source = _transform(source, filename);
      }
    }

    const mod = new Module(filename);
    mod.filename = filename;

    if (parentModule) {
      mod.parent = parentModule;
      if (
        Array.isArray(parentModule.children)
        && !parentModule.children.includes(mod)
      ) {
        parentModule.children.push(mod);
      }
    }

    mod.require = createImporter(filename, opts, mod);

    mod.path = dirname(filename);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    mod.paths = Module._nodeModulePaths(mod.path);

    if (opts.requireCache) {
      nativeRequire.cache[filename] = mod;
    }

    const compiled = runInThisContext(Module.wrap(source), {
      filename,
      lineOffset: 0,
      displayErrors: false
    });

    try {
      compiled(
        mod.exports,
        mod.require,
        mod,
        mod.filename,
        dirname(mod.filename)
      );
    } catch (error) {
      logger.error(error);
    }

    mod.loaded = true;

    const exports = _interopDefault(mod.exports);

    return exports;
  };

  _require.resolve = _resolve;
  _require.cache = nativeRequire.cache;
  _require.extensions = nativeRequire.extensions;
  _require.main = nativeRequire.main;
  _require.remove = function (id: string) {
    try {
      id = _resolve(id) ?? id;
    } catch (e) {
    }
    delete nativeRequire.cache[id];
    logger.debug("[delete cache]", id);
  };

  _require.configure = _configure;

  return _require as ModuleImporter;
}
