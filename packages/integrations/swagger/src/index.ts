import { DISABLE_JSON_WRAPPER_HEADER, definePlugin, defineRoute, defineRouter, resolvePath, slash } from "@fourze/core";
import type {
  FourzeRouter

} from "@fourze/core";
import { getAbsoluteFSPath } from "swagger-ui-dist";
import { staticFile } from "@fourze/server";

import { generateHtmlString } from "./ui";
import type { SwaggerOptions } from "./types";
import { createApiDocs } from "./service";

export interface SwaggerRouter extends FourzeRouter {
  generate(): Promise<void>
}

export function createSwaggerPlugin(options: SwaggerRouterOptions = {}) {
  return definePlugin(async (app) => {
    const router = createSwaggerRouter(options);
    app.use(router);
  });
}

export interface SwaggerUIServiceOptions {
  uiPath?: string
  base?: string
  documentPath?: string
}

export function service(
  options: SwaggerUIServiceOptions = {}
) {
  const base = options.base ?? "/";
  const uiPath = options.uiPath ?? "/swagger-ui/";
  const contextPath = resolvePath(uiPath, base);
  const swaggerUIPath = getAbsoluteFSPath();
  const render = staticFile(swaggerUIPath, contextPath);

  return defineRoute({
    path: slash(uiPath, "*"),
    meta: {
      swagger: false
    },
    handle: async (req, res) => {
      const documentUrl = resolvePath(
        options.documentPath ?? "/swagger.json",
        req.contextPath
      );
      await render(req, res, () => {
        const htmlString = generateHtmlString({
          initOptions: {
            url: documentUrl
          }
        });
        res.send(htmlString, "text/html");
      });
    }
  });
}

export interface SwaggerRouterOptions {
  uiPath?: string
  documentPath?: string
  swagger?: SwaggerOptions
}

export function createSwaggerRouter(
  options: SwaggerRouterOptions = {}
): FourzeRouter {
  const uiPath = options.uiPath ?? "/swagger-ui/";
  const documentPath = options.documentPath ?? "/swagger.json";
  return defineRouter({
    name: "SwaggerRouter",
    meta: {
      swagger: false
    },
    setup(router, app) {
      router.route(service({
        uiPath,
        documentPath,
        base: app.base
      }));
      router.get(documentPath, (req, res) => {
        const docs = createApiDocs(app, options.swagger);
        res.setHeader(DISABLE_JSON_WRAPPER_HEADER, "true");
        res.send(docs, "application/json");
      });
    }
  });
}

export { generateHtmlString } from "./ui";
export { createApiDocs } from "./service";

export { getAbsoluteFSPath as getSwaggerFSPath } from "swagger-ui-dist";
export * from "./types";
