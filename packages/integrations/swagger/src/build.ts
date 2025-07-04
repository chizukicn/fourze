import type { FourzeHmrApp } from "@fourze/server";
import type { SwaggerOptions } from "@fourze/swagger-middleware";
import type { CopyFilterSync } from "fs-extra";

import type { InlineConfig } from "vite";
import path from "node:path";
import process from "node:process";
import { withBase } from "@fourze/core";
import { createMockClient } from "@fourze/mock";
import fs from "fs-extra";
import { resolveSync } from "mlly";
import { defineConfig, mergeConfig, build as viteBuild } from "vite";
import { getSwaggerFSPath } from "./service";
import { renderIndexHtml } from "./ui";

const swaggerAssetFiles = [
  "favicon-16x16.png",
  "favicon-32x32.png",
  "swagger-ui-bundle.js",
  "swagger-ui.css",
  "swagger-ui-standalone-preset.js"
];

export interface SwaggerUIBuildOptions {

  /**
   * @default "dist"
   */
  distPath?: string;

  assetsFilter?: (src: string) => boolean;

  vite?: InlineConfig;

  swagger?: SwaggerOptions;

  /**
   * @default ".fourze-swagger"
   */
  tmpDir?: string;

}

function createMockDocsCode(options: SwaggerOptions = {}) {
  return `
  import { defineRouter } from "@fourze/core";
  import { createSwaggerMiddleware } from "@fourze/swagger-middleware";
  export default defineRouter((router,app) => {
    router.setMeta("swagger",false);
    router.get("/api-docs", createSwaggerMiddleware(app,${JSON.stringify(options)}));
  })
`;
}

export function getModuleAlias() {
  return ["@fourze/core", "@fourze/mock", "@fourze/swagger", "@fourze/swagger-middleware"].map((r) => {
    return {
      find: r,
      replacement: resolveSync(r, { url: import.meta.url })
    };
  });
}

export async function build(app: FourzeHmrApp, options: SwaggerUIBuildOptions = {}) {
  const swaggerFsPath = getSwaggerFSPath();

  const distPath = options.distPath ?? path.join(process.cwd(), "dist");
  const tmpDir = path.join(process.cwd(), ".fourze-swagger");

  // 固定加上swagger-ui的路径
  const uiBase = options.vite?.base ?? "/";

  const apiBase = options.swagger?.basePath ?? "/";

  const uiPath = "/swagger-ui/";

  await fs.emptyDir(tmpDir);

  const mockDocsPath = path.join(tmpDir, "docs.ts");

  await fs.outputFile(mockDocsPath, createMockDocsCode({
    defaultMethod: options.swagger?.defaultMethod,
    basePath: apiBase,
    ...options.swagger
  }));

  const moduleNames = app.moduleNames.concat(["./docs"]);

  await fs.outputFile(path.join(tmpDir, "mock.ts"), createMockClient(moduleNames, {
    base: apiBase
  }));

  await fs.outputFile(path.join(tmpDir, "index.html"), renderIndexHtml(withBase(uiPath, uiBase), {
    url: withBase("/api-docs", apiBase),
    script: [
      {
        src: "mock.ts",
        type: "module"
      }
    ]
  }));

  const filter: CopyFilterSync = options.assetsFilter ?? ((src) => {
    const filename = path.relative(swaggerFsPath, src);
    return filename === "" || swaggerAssetFiles.includes(filename);
  });
  await fs.copy(swaggerFsPath, path.join(tmpDir, "public"), { filter });

  // 打包接口文档 这里会有更好的方案吗???

  await viteBuild(mergeConfig(options.vite ?? {}, defineConfig({
    base: withBase(uiPath, uiBase),
    root: tmpDir,
    build: {
      outDir: path.join(distPath, uiPath),
      emptyOutDir: true,
      sourcemap: false,
      minify: true,
      rollupOptions: {
        external: ["@fourze/server"]
      }
    },
    resolve: {
      alias: getModuleAlias()
    }
  })));
  await fs.remove(tmpDir);
}
