import path from "path";
import type { DelayMsType, FourzeLogLevelKey } from "@fourze/core";
import { createLogger, setLoggerLevel } from "@fourze/core";
import { createUnplugin } from "unplugin";

import type { FourzeMockAppOptions } from "@fourze/mock";
import type {
  FourzeHmrApp,
  FourzeHmrOptions,
  FourzeProxyOption
} from "@fourze/server";
import { createHmrApp, createServer } from "@fourze/server";

import type { SwaggerRouterOptions } from "@fourze/swagger";
import { createSwaggerRouter } from "@fourze/swagger";
import type { InlineConfig } from "vite";
import { build } from "./swagger";
import { defaultMockCode as defaultTransformCode } from "./mock";

const PLUGIN_NAME = "unplugin-fourze";

const CLIENT_ID = "@fourze/client";

function isClientID(id: string) {
  return id.endsWith(CLIENT_ID);
}

export interface SwaggerPluginOption extends SwaggerRouterOptions {
  generateDocument?: boolean
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
   *  [".ts", ".js"]
   */
  filePattern?: (string | RegExp)[]
  /**
   * @default env.command == 'build' || env.mode === 'mock'
   */
  mock?: boolean

  /**
   *  mock mode
   */
  mode?: FourzeMockAppOptions["mode"]

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

  injectScript?: boolean

  proxy?: (FourzeProxyOption | string)[] | Record<string, string>

  delay?: DelayMsType

  allow?: string[]

  deny?: string[]

  swagger?: SwaggerPluginOption | true

  transformCode?: (router: FourzeHmrApp, options?: FourzeHmrOptions) => string
}

export const createFourzePlugin = createUnplugin((options: UnpluginFourzeOptions = {}) => {
  const dir = options.dir ?? "./src/mock";

  const base = options.base ?? "/api";

  const delay = options.delay ?? 0;
  const allow = options.allow ?? [];
  const deny = options.deny ?? [];

  const port = options.server?.port ?? 7609;
  const host = options.server?.host ?? "localhost";

  const pattern = Array.from(options.filePattern ?? [".ts$", ".js$"]);
  const hmr = options.hmr ?? true;
  const injectScript = options.injectScript ?? true;

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

  const app = createHmrApp({
    base,
    dir,
    pattern,
    delay,
    allow,
    deny
  });

  // proxy.forEach(router.proxy);

  const transformCode = options.transformCode ?? defaultTransformCode;

  const viteConfig: InlineConfig = {};
  const swaggerOptions = (options.swagger === true) ? {} : options.swagger ?? {};
  const generateDocument = swaggerOptions.generateDocument ?? !!options.swagger;

  return [
    {
      name: `${PLUGIN_NAME}-swagger-builder`,
      async writeBundle() {
        if (generateDocument) {
          await build(app, {
            mock: true,
            vite: {
              ...viteConfig
            }
          });
        }
      }
    },
    {
      name: PLUGIN_NAME,

      async buildStart() {
        try {
          await app.ready();

          logger.info("Fourze plugin is ready.");
        } catch (error) {
          logger.error("Fourze plugin is not ready.");
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
          return transformCode(app, options);
        }
      },
      async webpack() {
        const server = createServer(app);
        await server.listen(port, host);
        logger.info("Webpack Server listening on port", options.server?.port);
      },

      vite: {
        transformIndexHtml: {
          enforce: "pre",
          transform(html) {
            if (options.mock && injectScript) {
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
          options.mock
            = options.mock ?? (env.command === "build" || env.mode === "mock");
          return {
            define: {
              VITE_PLUGIN_FOURZE_MOCK: options.mock
            }
          };
        },
        async configResolved(config) {
          app.define(config.env);
          viteConfig.base = config.base;
          viteConfig.envDir = path.resolve(config.root, config.envDir ?? "");
          viteConfig.envPrefix = config.envPrefix ?? "VITE_";
          viteConfig.resolve = config.resolve;
        },

        configureServer({ middlewares, watcher }) {
          if (hmr) {
            app.watch(watcher);
          }

          const uiPath = "/swagger-ui/";

          logger.info("Swagger document is ready at ", uiPath);

          const swaggerRouter = createSwaggerRouter({
            uiPath,
            ...swaggerOptions
          });
          app.use(swaggerRouter);

          const service = createServer(app);
          if (options.server?.port) {
            try {
              service.listen(port, host);
            } catch (error) {
              logger.error("Server listen failed.", error);
            }
          } else {
            middlewares.use(service);
          }
        }
      }
    }
  ];
});

export default createFourzePlugin;
