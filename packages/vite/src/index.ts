import { Plugin, normalizePath } from "vite";

import { createMiddleware, logger } from "@fourze/core";

import { createRouter } from "@fourze/router";
import { transformCode } from "./mock";

const PLUGIN_NAME = "vite-plugin-fourze";

const CLIENT_ID = "@fourze/mock";

export interface VitePluginFourzeOptions {
  /**
   * @default 'src/mock'
   */
  dir?: string;

  /**
   * @default '/api'
   */
  base?: string;

  /**
   *  [".ts", ".js"]
   */
  filePattern?: (string | RegExp)[];
  /**
   * @default env.command == 'build' || env.mode === 'mock'
   */
  mock?: boolean;

  /**
   *  @default true
   *
   */
  hmr?: boolean;

  /**
   * @default "off"
   */
  logLevel: "off" | "info" | "warn" | "error";
}

export function VitePluginFourze(
  options: Partial<VitePluginFourzeOptions> = {}
): Plugin {
  const dir = (options.dir = options.dir ?? "./src/mock");

  const base = (options.base = options.base ?? "/api");

  const pattern = (options.filePattern = options.filePattern ?? [
    ".ts$",
    ".js$",
  ]);
  const hmr = (options.hmr = options.hmr ?? true);

  logger.level = options.logLevel ?? "off";

  const router = createRouter({
    dir,
    base,
    pattern,
  });

  return {
    name: PLUGIN_NAME,

    async buildStart() {
      await router.load();
      logger.info("buildStart", router.routes);
    },

    resolveId(id) {
      if (id === CLIENT_ID || id === `/${CLIENT_ID}`) {
        return `/${CLIENT_ID}`;
      }
    },

    config(config, env) {
      options.mock = options.mock ?? env.mode === "mock";
      return {
        define: {
          VITE_PLUGIN_FOURZE_MOCK: options.mock,
        },
      };
    },

    transformIndexHtml: {
      enforce: "pre",
      transform(html) {
        if (options.mock) {
          return {
            html,
            tags: [
              {
                tag: "script",
                attrs: { type: "module", src: `/${CLIENT_ID}` },
              },
            ],
          };
        }
        return html;
      },
    },
    load(id) {
      if (id === CLIENT_ID || id === `/${CLIENT_ID}`) {
        return transformCode(router);
      }
    },

    configureServer({ middlewares, watcher }) {
      if (hmr) {
        router.watch(watcher);
      }
      const middleware = createMiddleware(router);
      middlewares.use(middleware);
    },
  };
}

export default VitePluginFourze;
