import { createLogger, DelayMsType, FourzeLogLevelKey, setLoggerLevel } from "@fourze/core"
import { createUnplugin } from "unplugin"

import { installPackage } from "@antfu/install-pkg"
import type { FourzeMockRouterOptions } from "@fourze/mock"
import { createFourzeServer, createHotRouter, FourzeHotRouter, FourzeProxyOption } from "@fourze/server"
import { defaultMockCode as defaultTransformCode } from "./mock"

const PLUGIN_NAME = "unplugin-fourze"

const CLIENT_ID = "@fourze/client"

function isClientID(id: string) {
    return id.endsWith(CLIENT_ID)
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
    mode?: FourzeMockRouterOptions["mode"]

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

    transformCode?: (router: FourzeHotRouter, options?: FourzeMockRouterOptions) => string
}

export default createUnplugin((options: UnpluginFourzeOptions = {}) => {
    const dir = options.dir ?? "./src/mock"

    const base = options.base ?? "/api"

    const delay = options.delay ?? 0
    const allow = options.allow ?? []

    const port = options.server?.port ?? 7609
    const host = options.server?.host ?? "localhost"

    const pattern = Array.from(options.filePattern ?? [".ts$", ".js$"])
    const hmr = options.hmr ?? true
    const injectScript = options.injectScript ?? true

    const logger = createLogger("@fourze/vite")

    setLoggerLevel(options.logLevel ?? "info")

    const proxy = Array.isArray(options.proxy)
        ? options.proxy
        : Object.entries(options.proxy ?? {}).map<FourzeProxyOption>(([path, target]) => {
              return {
                  path,
                  target
              }
          })

    const router = createHotRouter({
        base,
        dir,
        pattern,
        delay,
        allow
    })

    proxy.forEach(router.proxy)

    const transformCode = options.transformCode ?? defaultTransformCode

    logger.info(`Fourze Plugin is starting...`)

    return {
        name: PLUGIN_NAME,

        async buildStart() {
            await router.setup()
        },

        resolveId(id) {
            if (isClientID(id)) {
                return id
            }
        },

        async load(id) {
            if (isClientID(id)) {
                return transformCode(router, options)
            }
        },
        async webpack() {
            const app = createFourzeServer()
            app.use(base, router)
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
            async config(config, env) {
                options.mock = options.mock ?? (env.command == "build" || env.mode === "mock")
                return {
                    define: {
                        VITE_PLUGIN_FOURZE_MOCK: options.mock
                    }
                }
            },
            async configResolved(config) {
                if (options.mock) {
                    await installPackage("@fourze/mock", { cwd: config.root, silent: true })
                }
            },

            configureServer({ middlewares, httpServer, watcher }) {
                if (hmr) {
                    router.watch(watcher)
                }
                const app = createFourzeServer()
                app.use(base, router)

                if (options.server?.port) {
                    try {
                        app.listen(port, host)
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
