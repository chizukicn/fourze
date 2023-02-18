import path from "path";
import type { DelayMsType, FourzeLogLevelKey, RequestMethod } from "@fourze/core";
import { createLogger, delayHook, isBoolean, resolves, setLoggerLevel } from "@fourze/core";
import { createUnplugin } from "unplugin";

import type { FourzeMockAppOptions } from "@fourze/mock";
import type {
  FourzeProxyOption
} from "@fourze/server";
import { createHmrApp, createServer, defineEnvs } from "@fourze/server";

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

  files?: {
    /**
     * @default ["*.ts","*.js"]
     */
    pattern?: string[]
    ignore?: string[]
  } | string[]

  proxy?: (FourzeProxyOption | string)[] | Record<string, string>

  delay?: DelayMsType

  allow?: string[]

  deny?: string[]

  swagger?: SwaggerPluginOption | boolean

  transformCode?: typeof createMockClient
}

const createFourzePlugin = createUnplugin((options: UnpluginFourzeOptions = {}) => {
  const dir = options.dir ?? "./src/mock";

  const base = options.base ?? "/api";

  const delay = options.delay ?? 0;
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
    : options.mock ?? {
      ...defaultEnableMockOptions,
      enable: "auto"
    };

  const injectScript = mockOptions.injectScript ?? true;

  const logger = createLogger("@fourze/unplugin");

  setLoggerLevel(options.logLevel ?? "info");

  // const proxy = Array.isArray(options.proxy)
  //   ? options.proxy
  //   : Object.entries(options.proxy ?? {}).map<FourzeProxyOption>(
  //     ([path, target]) => {
  //       return {
  //         path,
  //         target
  //       };
  //     }
  //   );

  const hmrApp = createHmrApp({
    base,
    allow,
    deny,
    dir,
    files: options.files
  });

  if (delay) {
    hmrApp.use(delayHook(delay));
  }

  // proxy.forEach(router.proxy);

  const transformCode = options.transformCode ?? createMockClient;

  const viteConfig: InlineConfig = {};

  const swaggerOptions = isBoolean(options.swagger) ? {} : options.swagger ?? {};
  const generateDocument = swaggerOptions.generateDocument ?? !!options.swagger;

  return [
    {
      name: PLUGIN_NAME,
      async writeBundle() {
        if (generateDocument) {
          await build(hmrApp, {
            base: viteConfig.base,
            distPath: viteConfig.build?.outDir,
            vite: {
              ...viteConfig
            },
            defaultMethod: swaggerOptions.defaultMethod
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
            mode: mockOptions.mode
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
          enforce: "pre",
          transform(html) {
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
            mockOptions.enable = env.command === "build" || env.mode === "mock";
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
            alias: Object.fromEntries(config.resolve.alias.map(r => {
              return [r.find, r.replacement];
            }))
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

          const server = createServer();
          server.use(hmrApp);
          if (options.swagger !== false) {
            const swaggerMiddleware = service(hmrApp, {
              base: resolves(viteConfig.base, "/swagger-ui/"),
              ...swaggerOptions
            });
            server.use(swaggerMiddleware);
          }
          if (options.server?.port) {
            try {
              server.listen(port, host);
            } catch (error) {
              logger.error("Server listen failed.", error);
            }
          } else {
            middlewares.use(server);
          }
        }
      }
    }
  ];
});

export { createFourzePlugin, createFourzePlugin as default };
