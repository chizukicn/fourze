import path from "path";
import type { FourzeHmrApp } from "@fourze/server";

import type { InlineConfig } from "vite";
import { defineConfig, mergeConfig, build as viteBuild } from "vite";
import fs from "fs-extra";
import type { RequestMethod } from "@fourze/core";
import { resolves } from "@fourze/core";
import { createMockClient } from "@fourze/mock";
import type { SwaggerOptions } from "@fourze/middlewares";
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
  distPath?: string

  /**
   *  主项目的根路径
   *  @default "/"
   */
  base?: string

  assetsFilter?: (src: string) => boolean

  vite?: InlineConfig

  /**
   * @default ".fourze-swagger"
   */
  tmpDir?: string

  defaultMethod?: RequestMethod

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
  return ["@fourze/core", "@fourze/mock", "@fourze/swagger", "@fourze/swagger-middleware"].map(r => {
    return {
      find: r,
      replacement: require.resolve(r)
    };
  });
}

export async function build(app: FourzeHmrApp, options: SwaggerUIBuildOptions = {}) {
  const swaggerFsPath = getSwaggerFSPath();

  const distPath = options.distPath ?? path.join(process.cwd(), "dist");
  const tmpDir = path.join(process.cwd(), ".fourze-swagger");

  // 固定加上swagger-ui的路径
  const base = options.base ?? "/";

  const uiPath = "/swagger-ui/";

  await fs.emptyDir(tmpDir);

  const mockDocsPath = path.join(tmpDir, "docs.ts");

  await fs.outputFile(mockDocsPath, createMockDocsCode({
    defaultMethod: options.defaultMethod
  }));

  const moduleNames = app.moduleNames.concat(["./docs"]);

  await fs.outputFile(path.join(tmpDir, "mock.ts"), createMockClient(moduleNames, {
    base: app.base
  }));

  await fs.outputFile(path.join(tmpDir, "index.html"), renderIndexHtml(resolves(base, uiPath), {
    url: resolves(app.base, "/api-docs"),
    script: [
      {
        src: "mock.ts",
        type: "module"
      }
    ]
  }));

  const filter: fs.CopyFilterSync = options.assetsFilter ?? ((src) => {
    const filename = path.relative(swaggerFsPath, src);
    return filename === "" || swaggerAssetFiles.includes(filename);
  });
  await fs.copy(swaggerFsPath, path.join(tmpDir, "public"), { filter });

  // 打包接口文档 这里会有更好的方案吗???

  await viteBuild(mergeConfig(options.vite ?? {}, defineConfig({
    base: resolves(base, uiPath),
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
