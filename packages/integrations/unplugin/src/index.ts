import path from "node:path";
import type {
  DelayMsType,
  FourzeLogLevelKey,
  RequestMethod
} from "@fourze/core";
import {
  createLogger,
  isBoolean,
  setLoggerLevel,
  withBase
} from "@fourze/core";
import {
  createDelayMiddleware,
  createTimeoutMiddleware
} from "@fourze/middlewares";
import { createUnplugin } from "unplugin";

import type { FourzeMockAppOptions } from "@fourze/mock";
import {
  connect,
  createHmrApp,
  createServer,
  defineEnvs
} from "@fourze/server";

import { build, getModuleAlias, service } from "@fourze/swagger";
import type { InlineConfig } from "vite";
import { createMockClient } from "@fourze/mock";

const PLUGIN_NAME = "unplugin-fourze";

const CLIENT_ID = "@fourze/client";

function isClientID(id: string) {
  return id.endsWith(CLIENT_ID);
}

export interface SwaggerPluginOption {
  /**
   *  @default vite.base + "/swagger-ui/"
   */
  base?: string

  generateDocument?: boolean

  defaultMethod?: RequestMethod
}

export type MockEnable = boolean | "auto";

export interface MockOptions {
  enable?: MockEnable
  mode?: FourzeMockAppOptions["mode"]
  injectScript?: boolean
  host?: string | string[]
}

export interface UnpluginFourzeOptions {
  /**
   * @default 'src/mock'
   */
  dir?: string

  /**
   * @default '/api'
   */
  base?: string
  /**
   * @default env.command == 'build' || env.mode === 'mock'
   */
  mock?: MockOptions | boolean

  /**
   *  @default true
   *
   */
  hmr?: boolean

  /**
   * @default "info"
   */
  logLevel?: FourzeLogLevelKey | number

  server?: {
    /**
     *
     */
    host?: string

    /**
     *
     */
    port?: number
  }

  files?:
  | {
    /**
         * @default ["*.ts","*.js"]
         */
    include?: string[]
    exclude?: string[]
  }
  | string[]

  delay?: DelayMsType

  /**
   * @default 5000
   */
  timeout?: number

  allow?: string[]

  deny?: string[]

  swagger?: SwaggerPluginOption | boolean

  transformCode?: typeof createMockClient
}

const createFourzePlugin = createUnplugin<UnpluginFourzeOptions | undefined>(
  (options = {}) => {
    const dir = options.dir ?? "./src/mock";

    const base = options.base ?? "/api";

    const delay = options.delay;
    const timeout = options.timeout;

    const allow = options.allow ?? [];
    const deny = options.deny ?? [];

    const port = options.server?.port ?? 7609;
    const host = options.server?.host ?? "localhost";

    const hmr = options.hmr ?? true;

    const defaultEnableMockOptions: MockOptions = {
      enable: true,
      injectScript: true,
      mode: ["xhr", "fetch"]
    };

    const defaultDisableMockOptions: MockOptions = {
      enable: false,
      injectScript: false,
      mode: []
    };

    const mockOptions: MockOptions = isBoolean(options.mock)
      ? options.mock
        ? defaultEnableMockOptions
        : defaultDisableMockOptions
      : {
          ...defaultEnableMockOptions,
          enable: "auto",
          ...options.mock
        };

    const injectScript = mockOptions.injectScript ?? true;

    const logger = createLogger("@fourze/unplugin");

    setLoggerLevel(options.logLevel ?? "info");

    const hmrApp = createHmrApp({
      allow,
      deny,
      dir,
      files: options.files
    });

    if (timeout) {
      hmrApp.use(createTimeoutMiddleware(timeout));
    }

    if (delay) {
      hmrApp.use(createDelayMiddleware(delay));
    }

    // proxy.forEach(router.proxy);

    const transformCode = options.transformCode ?? createMockClient;

    const viteConfig: InlineConfig = {};

    const swaggerOptions = isBoolean(options.swagger)
      ? {}
      : options.swagger ?? {};
    const generateDocument
      = swaggerOptions.generateDocument ?? !!options.swagger;

    return [
      {
        name: PLUGIN_NAME,
        async writeBundle() {
          if (generateDocument) {
            await build(hmrApp, {
              distPath: viteConfig.build?.outDir,
              vite: viteConfig,
              swagger: {
                basePath: base,
                ...swaggerOptions
              }
            });
          }
        },
        async buildStart() {
          try {
            await hmrApp.ready();

            logger.info("Fourze plugin is ready.");
          } catch (error) {
            logger.error("Fourze plugin is fail.");
            logger.error(error);
          }
        },
        resolveId(id) {
          if (isClientID(id)) {
            return id;
          }
        },

        async load(id) {
          if (isClientID(id)) {
            return transformCode(hmrApp.moduleNames, {
              ...options,
              base,
              mode: mockOptions.mode,
              host: mockOptions.host
            });
          }
        },
        async webpack() {
          const server = createServer(hmrApp);
          await server.listen(port, host);
          logger.info("Webpack Server listening on port", options.server?.port);
        },

        vite: {
          transformIndexHtml: {
            order: "pre",
            handler(html) {
              if (mockOptions.enable && injectScript) {
                return {
                  html,
                  tags: [
                    {
                      tag: "script",
                      attrs: {
                        type: "module",
                        src: `/${CLIENT_ID}`
                      }
                    }
                  ]
                };
              }
              return html;
            }
          },
          async config(_, env) {
            if (mockOptions.enable === "auto") {
              mockOptions.enable = env.command === "build";
            }

            return {
              define: {
                VITE_PLUGIN_FOURZE_MOCK: mockOptions.enable
              },
              resolve: {
                alias: env.command === "build" ? getModuleAlias() : []
              },
              build: {
                rollupOptions: {
                  external: ["@fourze/server"]
                }
              }
            };
          },
          async configResolved(config) {
            hmrApp.configure({
              define: {
                ...defineEnvs(config.env, "import.meta.env."),
                ...defineEnvs(config.define ?? {})
              },
              alias: Object.fromEntries(
                config.resolve.alias.map((r) => {
                  return [r.find, r.replacement];
                })
              )
            });
            viteConfig.base = config.base;
            viteConfig.envDir = path.resolve(config.root, config.envDir ?? "");
            viteConfig.envPrefix = config.envPrefix;
            viteConfig.resolve = config.resolve;
          },

          configureServer({ middlewares, watcher }) {
            if (hmr) {
              hmrApp.watch(watcher);
            }

            if (options.swagger !== false) {
              const uiBase = withBase("/swagger-ui", viteConfig.base ?? "/");
              const swaggerMiddleware = service(hmrApp, {
                uiBase,
                basePath: base,
                ...swaggerOptions
              });
              middlewares.use(uiBase, connect(swaggerMiddleware));
            }
            middlewares.use(base, connect(hmrApp));
          }
        }
      }
    ];
  }
);

export { createFourzePlugin, createFourzePlugin as default };
