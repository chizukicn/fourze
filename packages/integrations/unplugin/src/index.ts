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

import { defaultMockCode as defaultTransformCode } from "./mock";

const PLUGIN_NAME = "unplugin-fourze";

const CLIENT_ID = "@fourze/client";

function isClientID(id: string) {
  return id.endsWith(CLIENT_ID);
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

  transformCode?: (router: FourzeHmrApp, options?: FourzeHmrOptions) => string
}

export default createUnplugin((options: UnpluginFourzeOptions = {}) => {
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

  const proxy = Array.isArray(options.proxy)
    ? options.proxy
    : Object.entries(options.proxy ?? {}).map<FourzeProxyOption>(
      ([path, target]) => {
        return {
          path,
          target
        };
      }
    );

  const router = createHmrApp({
    dir,
    pattern,
    delay,
    allow,
    deny
  });

  proxy.forEach(router.proxy);

  const transformCode = options.transformCode ?? defaultTransformCode;

  return {
    name: PLUGIN_NAME,

    async buildStart() {
      try {
        await router.mount();

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
        return transformCode(router, options);
      }
    },
    async webpack() {
      const app = createServer();
      app.use(base, router);
      await app.listen(port, host);
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
        router.define(config.env);
      },

      configureServer({ middlewares, watcher }) {
        if (hmr) {
          router.watch(watcher);
        }
        const app = createServer();
        app.use(base, router);
        // app.use("/v2", swaggerRouter);

        if (options.server?.port) {
          try {
            app.listen(port, host);
          } catch (error) {
            logger.error("Server listen failed.", error);
          }
        } else {
          middlewares.use(app);
        }
      }
    }
  };
});
