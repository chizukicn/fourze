import type { FourzeApp, FourzeMiddleware } from "@fourze/core";
import { createApp } from "@fourze/core";
import { getAbsoluteFSPath } from "swagger-ui-dist";
import { createSwaggerMiddleware } from "@fourze/swagger-middleware";
import type { SwaggerOptions } from "@fourze/swagger-middleware";
import { staticFile } from "@fourze/server";
import { renderIndexHtml } from "./ui";

export interface SwaggerUIServiceOptions extends SwaggerOptions {
  uiBase?: string;
  documentPath?: string;
}

// 包括swagger-ui的服务
export function service(
  app: FourzeApp,
  options: SwaggerUIServiceOptions = {}
): FourzeMiddleware {
  const uiBase = options.uiBase ?? "/swagger-ui/";
  const documentPath = options.documentPath ?? "/api-docs";

  const swaggerUISourcePath = getAbsoluteFSPath();

  const render = staticFile(swaggerUISourcePath, {
    maybes: []
  });

  const docsMiddleware = createSwaggerMiddleware(app, options);

  const swaggerApp = createApp();

  const renderIndex: FourzeMiddleware = (req, res, next) => {
    if (req.path === "/" || req.path === "/index.html") {
      res.send(renderIndexHtml(uiBase), "text/html");
    } else {
      next?.();
    }
  };

  swaggerApp.use(documentPath, docsMiddleware);
  swaggerApp.use(render);
  swaggerApp.use(renderIndex);

  return swaggerApp;
}

export const getSwaggerFSPath = getAbsoluteFSPath;
