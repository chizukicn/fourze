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
  routePath?: string
  base?: string
  documentUrl?: string
}

export function service(
  options: SwaggerUIServiceOptions = {}
) {
  const base = options.base ?? "/";
  const routePath = options.routePath ?? "/swagger-ui/";
  const contextPath = resolvePath(routePath, base);
  const swaggerUIPath = getAbsoluteFSPath();
  const render = staticFile(swaggerUIPath, contextPath);

  return defineRoute({
    path: slash(routePath, "*"),
    meta: {
      swagger: false
    },
    handle: async (req, res) => {
      const documentUrl = resolvePath(
        options.documentUrl ?? "/api-docs",
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
  routePath?: string
  documentUrl?: string
  swagger?: SwaggerOptions
}

export function createSwaggerRouter(
  options: SwaggerRouterOptions = {}
): FourzeRouter {
  const routerPath = options.routePath ?? "/swagger.json";
  const documentUrl = options.documentUrl ?? "/api-docs";
  return defineRouter({
    name: "SwaggerRouter",
    meta: {
      swagger: false
    },
    setup(router, app) {
      router.route(service({
        routePath: routerPath,
        documentUrl,
        base: app.base
      }));
      router.get(routerPath, (req, res) => {
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
