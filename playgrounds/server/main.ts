import fs from "node:fs";
import path from "node:path";
import comporession from "compression";
import ejs from "ejs";
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import type { CommonMiddleware, FourzeRequest, FourzeResponse } from "@fourze/core";
import { defineRouter } from "@fourze/core";
import type { FourzeRendererContext } from "@fourze/server";
import { createRenderer, createServer } from "@fourze/server";

const router = defineRouter(router => {
  router.route("/hello").get(() => {
    return "Hello World";
  });
});

export async function renderEjs(request: FourzeRequest, response: FourzeResponse, context: FourzeRendererContext) {
  const file = path.normalize(context.file);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    return ejs.renderFile(file, {});
  }
}

const renderer = createRenderer({ dir: path.resolve(process.cwd(), "./"), fallbacks: { "/home": "/" } });

renderer.use(renderEjs);

const app = createServer();

app.use(router);

app.use(renderer);
app.use(comporession({ threshold: 0 }) as CommonMiddleware);

const app2 = createServer();
app2.use(defineRouter(router => {
  router.route("/hello").get(() => {
    return "Hello World";
  });
}));
app2.listen(8080);

const expressApp = express();

expressApp.use(app);
expressApp.use("/v2/api", createProxyMiddleware({ target: "http://localhost:8080", changeOrigin: true, pathRewrite: { "^/v2/api": "" } }));
expressApp.listen(7609);
