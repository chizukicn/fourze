import { FourzeBaseRoute, Logger } from "@fourze/core"
import { createUnplugin } from "unplugin"

import { createApp, createRouter, FourzeProxyOption, FourzeRouter } from "@fourze/server"
import { mockJs } from "./mock"

const PLUGIN_NAME = "unplugin-fourze"

const CLIENT_ID = "@fourze/client"

function isClientID(id: string) {
    return id.endsWith(CLIENT_ID)
}

export interface UnpluginFourzeServer {
    /**
     *
     */
    host?: string

    /**
     *
     */
    port?: number
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
     *  @default true
     *
     */
    hmr?: boolean

    /**
     * @default "off"
     */
    logLevel?: "off" | "info" | "warn" | "error"

    server?: UnpluginFourzeServer

    injectScript?: boolean

    routes?: FourzeBaseRoute[]

    proxy?: (FourzeProxyOption | string)[] | Record<string, string>

    timeout?: number | string | [number, number]

    transformCode?: (router: FourzeRouter) => string
}

export default createUnplugin((options: UnpluginFourzeOptions = {}) => {
    const dir = options.dir ?? "./src/mock"

    const base = options.base ?? "/api"

    const pattern = Array.from(options.filePattern ?? [".ts$", ".js$"])
    const hmr = options.hmr ?? true
    const injectScript = options.injectScript ?? true

    const logger = new Logger("@fourze/vite")

    logger.setLevel(options.logLevel ?? "off")

    const proxy = Array.isArray(options.proxy)
        ? options.proxy
        : Object.entries(options.proxy ?? {}).map<FourzeProxyOption>(([path, target]) => {
              return {
                  path,
                  target
              }
          })

    const routes = Array.from(options.routes ?? [])

    const router = createRouter({
        base,
        dir,
        pattern,
        routes
    })

    const app = createApp()

    app.use(base, router)

    proxy.forEach(router.proxy)

    const transformCode = options.transformCode ?? mockJs

    logger.info(`${PLUGIN_NAME} is starting...`)

    return {
        name: PLUGIN_NAME,
        async buildStart() {
            await router.load()
            logger.info("buildStart", router.routes)
        },

        resolveId(id) {
            if (isClientID(id)) {
                return id
            }
        },

        async load(id) {
            if (isClientID(id) && options.mock) {
                return transformCode(router)
            }
        },
        async webpack(compiler) {
            const port = options.server?.port ?? 7609
            const host = options.server?.host ?? "localhost"
            await app.listen(port, host)
            console.log("Webpack Server listening on port", options.server?.port)
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
                                    attrs: { type: "module", src: `/${CLIENT_ID}` }
                                }
                            ]
                        }
                    }
                    return html
                }
            },
            config(config, env) {
                options.mock = options.mock ?? (env.command == "build" || env.mode === "mock")

                return {
                    define: {
                        VITE_PLUGIN_FOURZE_MOCK: options.mock
                    }
                }
            },
            configureServer({ middlewares, httpServer, watcher }) {
                if (hmr) {
                    router.watch(watcher)
                }

                if (options.server) {
                    try {
                        app.listen(options.server?.port, options.server?.host)
                    } catch (error) {
                        logger.error("Server listen failed.", error)
                    }
                } else {
                    middlewares.use(app)
                    logger.info("Fourze middleware was installed!")
                }
            }
        }
    }
})
