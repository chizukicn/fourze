import type {
  FourzeComponent,
  FourzeLogger,
  FourzeMiddleware,
  FourzeNext,
  FourzeRequest,
  FourzeResponse
} from "@fourze/core";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  createFilter,
  createLogger,
  defineFourzeComponent,
  isFourzeComponent,
  isFunction,
  isObject,
  isString
} from "@fourze/core";
import mime from "mime";
import { createImporter } from "./importer";

export interface FourzeRendererOptions {
  /**
   * 根路径
   */
  base?: string;

  /**
   *  目录
   */
  dir?: string;

  /**
   *  模板
   */
  templates?: FourzeRenderTemplate[];

  /**
   *  文件不存在时跳转到该目录的根路径
   */
  fallbacks?: string[] | Record<string, string>;
}

export interface FourzeRenderer extends FourzeMiddleware {
  templates: FourzeRenderTemplate[];
  use: (...middlewares: FourzeRenderTemplate[]) => this;
}

export type FourzeRenderTemplate = (
  request: FourzeRequest,
  response: FourzeResponse,
  context: FourzeRendererContext
) => any;

export interface FourzeRendererContext {
  file: string;

  /**
   *  @see FourzeRendererOptions["dir"]
   */
  dir: string;

  logger: FourzeLogger;
}

export interface FourzeStaticFileOptions {
  maybes?: string[];
  includes?: string[];
  excludes?: string[];
}

function hasFile(file: string) {
  return fs.existsSync(file) && fs.statSync(file).isFile();
}

function findMaybeFile(
  target: string,
  maybes: string[] = []
): string | null {
  if (hasFile(target)) {
    return target;
  }
  for (const maybe of maybes) {
    const filePath = path.normalize(path.join(target, maybe));
    if (hasFile(filePath)) {
      return filePath;
    }
  }
  return null;
}

export function staticFile(dir: string, options: FourzeStaticFileOptions = {}): FourzeMiddleware {
  const maybes = options.maybes ?? ["index.html", "index.htm"];
  const includes = options.includes ?? [];
  const excludes = options.excludes ?? [];
  const isMatch = createFilter(includes, excludes);
  return function (req: FourzeRequest, res: FourzeResponse, next?: FourzeNext) {
    const file = findMaybeFile(path.join(dir, req.path), maybes);
    if (file && isMatch(file)) {
      res.send(fs.readFileSync(file), mime.getType(file));
    } else if (next) {
      next();
    } else {
      res.sendError(404);
    }
  };
}

export function renderFile(
  request: FourzeRequest,
  response: FourzeResponse,
  context: FourzeRendererContext
) {
  let p: string | undefined = context.file;
  const extensions = ["html", "htm"];
  const maybes = [p].concat(
    extensions.map((ext) => path.normalize(`${p}/index.${ext}`))
  );
  do {
    p = maybes.shift();
    if (!!p && fs.existsSync(p) && fs.statSync(p).isFile()) {
      return fs.readFileSync(p);
    }
  } while (p);
}

export async function renderTsx(
  request: FourzeRequest,
  response: FourzeResponse,
  context: FourzeRendererContext
) {
  const file = path.normalize(context.file);

  const _filename = import.meta.url;

  const _import = createImporter(_filename, {
    esbuild: {
      jsxFactory: "h",
      jsxFragment: "'fragment'",
      banner: "const {h} = require(\"@fourze/core\")"
    },
    requireCache: false
  });

  const maybes = file.match(/\.[jt|]sx$/) ? [file] : [];
  maybes.push(
    ...["index.tsx", "index.jsx"].map((ext) => path.normalize(`${file}/${ext}`))
  );

  for (const maybe of maybes) {
    if (fs.existsSync(maybe) && fs.statSync(maybe).isFile()) {
      const mod = await _import(maybe);
      const component = isFourzeComponent(mod)
        ? mod
        : defineFourzeComponent(mod);
      const { setup } = component;
      let { render } = component;

      if (setup) {
        const setupReturn = await setup();
        if (isFunction(setupReturn)) {
          render = setupReturn as FourzeComponent["render"];
        }
      }

      if (isFunction(render)) {
        const content = await render();

        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(content);
      }
    }
  }
}

/**
 * @returns
 */
export function createRenderer(
  options: FourzeRendererOptions | string = {}
): FourzeRenderer {
  const isOptions = isObject(options);
  const dir
    = (isOptions ? options.dir : options)
      ?? process.cwd();

  const templates = (isOptions
    ? options.templates
    : [renderTsx]) ?? [renderTsx];
  const base = isString(options) ? "/" : options.base ?? "/";
  const _fallbacks
    = (isOptions ? options.fallbacks : []) ?? [];
  const fallbacks = Array.isArray(_fallbacks)
    ? _fallbacks.map((f) => [f, f])
    : Object.entries(_fallbacks);

  const logger = createLogger("@fourze/renderer");

  async function render(
    request: FourzeRequest,
    response: FourzeResponse,
    context: FourzeRendererContext
  ) {
    for (const template of templates) {
      const content = await template(request, response, context);
      if (!!content || response.writableEnded) {
        return content;
      }
    }
    return renderFile(request, response, context);
  }

  const renderer = async function (
    request: FourzeRequest,
    response: FourzeResponse,
    next?: FourzeNext
  ) {
    const url = request.path ?? request.url;
    if (url.startsWith(base)) {
      const context = { file: path.join(dir, url), logger, dir };

      let content = await render(request, response, context);

      if (response.writableEnded) {
        return;
      }

      if (!content) {
        for (const [fr, to] of fallbacks) {
          if (url.startsWith(fr)) {
            context.file = path.normalize(path.join(dir, to));
            content = await render(request, response, context);

            if (response.writableEnded) {
              return;
            }

            if (content) {
              logger.debug("[fallback]", url, " => ", context.file);
              break;
            }
          }
        }
      }

      if (content && !response.writableEnded) {
        logger.debug("render page", url);
        if (!response.hasHeader("Content-Type")) {
          response.setHeader("Content-Type", mime.getType(url) ?? "text/html");
        }
        response.end(content);
        return;
      }
    }

    await next?.();
  };

  Object.defineProperty(renderer, "name", {
    get() {
      return "FourzeRenderer";
    },
    enumerable: true
  });

  Object.defineProperty(renderer, "templates", {
    get() {
      return templates;
    },
    enumerable: true
  });

  renderer.use = function (
    this: FourzeRenderer,
    ...arr: FourzeRenderTemplate[]
  ) {
    templates.push(...arr);
    return this;
  };

  return renderer as FourzeRenderer;
}
