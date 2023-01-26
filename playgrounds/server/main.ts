import fs from "fs";
import path from "path";
import comporession from "compression";
import ejs from "ejs";
import express from "express";

import type { CommonMiddleware, FourzeRequest, FourzeResponse } from "@fourze/core";
import { defineRouter } from "@fourze/core";
import type { FourzeRendererContext } from "@fourze/server";
import { createHmrApp, createRenderer, createServer } from "@fourze/server";

const router = createHmrApp().use(defineRouter(router =>
  router.route("GET /hello", () => {
    return {
      msg: "hello router 1"
    };
  })
));

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

const expressApp = express();

expressApp.use(app);
expressApp.listen(7609);
