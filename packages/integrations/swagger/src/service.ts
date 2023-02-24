import type { FourzeApp, FourzeMiddleware, FourzeNext, FourzeRequest, FourzeResponse } from "@fourze/core";
import { resolves } from "@fourze/core";
import { getAbsoluteFSPath } from "swagger-ui-dist";
import { createSwaggerMiddleware } from "@fourze/middlewares";
import type { SwaggerOptions } from "@fourze/middlewares";
import { renderIndexHtml } from "./ui";

export interface SwaggerUIServiceOptions extends SwaggerOptions {
  base?: string
  documentPath?: string
}

// 包括swagger-ui的服务
export function service(
  app: FourzeApp,
  options: SwaggerUIServiceOptions = {}
): FourzeMiddleware {
  const base = options.base ?? "/swagger-ui/";
  const documentPath = options.documentPath ?? "/api-docs";
  const documentUrl = resolves(base, documentPath);

  const swaggerUISourcePath = getAbsoluteFSPath();

  const { staticFile } = require("@fourze/server");

  const render = staticFile(swaggerUISourcePath, base);
  const docsMiddleware = createSwaggerMiddleware(app, options);

  return async (req: FourzeRequest, res: FourzeResponse, next: FourzeNext) => {
    if (req.path.startsWith(base)) {
      if (req.path === documentUrl) {
        docsMiddleware(req, res, () => {});
        return;
      }

      return render(req, res, () => {
        res.send(
          renderIndexHtml(base, {
            url: documentUrl
          }),
          "text/html"
        );
      });
    }
    return next();
  };
}

export const getSwaggerFSPath = getAbsoluteFSPath;
