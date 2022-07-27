import type { FourzeBaseRoute, FourzeRequest, FourzeResponse, FourzeRoute, FourzeSetup } from "@fourze/core"
import { defineFourze, defineRoute, isFourze, isRoute, Logger } from "@fourze/core"
import type { FSWatcher } from "chokidar"
import fs from "fs"
import { join, resolve } from "path"
import type { FourzeMiddleware } from "./app"
import { createRenderer } from "./renderer"

export interface FourzeRouterOptions {
    base?: string
    dir?: string
    watcher?: FSWatcher
    pattern?: (string | RegExp)[]
    routes?: FourzeBaseRoute[]
    moduleNames?: string[]
}

export interface FourzeRouter extends FourzeMiddleware {
    name: string
    load(): void | Promise<void>
    load(moduleName: string): void | Promise<void>
    remove(moduleName: string): this
    watch(watcher?: FSWatcher): this
    watch(dir?: string, watcher?: FSWatcher): this
    proxy(p: string | FourzeProxyOption): this
    readonly base: string
    readonly routes: FourzeRoute[]
    readonly moduleNames: string[]
}

const TEMPORARY_FILE_SUFFIX = ".tmp.js"

function transformPattern(pattern: (string | RegExp)[]) {
    return pattern.map(p => {
        if (typeof p === "string") {
            return new RegExp(p)
        }
        return p
    })
}

export interface FourzeProxyOption extends Omit<FourzeBaseRoute, "handle"> {
    target?: string
}

export function createRouter(params: FourzeRouterOptions | FourzeSetup): FourzeRouter {
    const options: FourzeRouterOptions = typeof params == "function" ? defineFourze(params) : params

    const base = (options.base = options.base ?? "/")
    const rootDir = resolve(process.cwd(), options.dir ?? "./routes")
    const pattern = transformPattern(options.pattern ?? [".ts", ".js"])
    const moduleNames = new Set(Array.from(options.moduleNames ?? []))

    const routes: FourzeBaseRoute[] = Array.from(options.routes ?? [])
    const logger = new Logger("@fourze/router")

    const router = async function (request: FourzeRequest, response: FourzeResponse, next?: () => void | Promise<void>) {
        const dispatchers = router.routes.map(e => e.dispatch)

        const fn = async () => {
            const dispatch = dispatchers.shift()
            if (!!dispatch) {
                await dispatch(request, response, fn)
            }
        }

        await fn()

        if (response.matched) {
            logger.info("request match", request.method, request.url)
            if (!response.writableEnded) {
                response.end(response.result)
            }
        } else {
            await next?.()
        }
    } as FourzeRouter

    router.load = async function (this: FourzeRouter, moduleName: string = rootDir) {
        if (!fs.existsSync(moduleName)) {
            return
        }

        const loadModule = async (mod: string) => {
            logger.info("load module", mod)
            if (mod.endsWith(".ts")) {
                await loadTsModule(mod)
            } else {
                await loadJsModule(mod)
            }
        }

        const loadJsModule = async (mod: string) => {
            const module = require(mod)
            const route = module?.exports?.default ?? module?.default
            if (isFourze(route) || isRoute(route) || (Array.isArray(route) && route.some(isRoute))) {
                moduleNames.add(mod)
            }
        }

        const loadTsModule = async (mod: string) => {
            const modName = mod.replace(".ts", TEMPORARY_FILE_SUFFIX)
            const { build } = require("esbuild") as typeof import("esbuild")
            try {
                await build({
                    entryPoints: [mod],
                    external: ["@fourze/core"],
                    outfile: modName,
                    write: true,
                    platform: "node",
                    bundle: true,
                    format: "cjs",
                    metafile: true,
                    target: "es6"
                })

                await loadJsModule(modName)
            } catch (err) {
                logger.error(`load file ${modName}`, err)
            }
            try {
                await fs.promises.unlink(modName)
            } catch (err) {
                logger.error("delete file " + modName + " error", err)
            }
        }

        const stat = await fs.promises.stat(moduleName)
        if (stat.isDirectory()) {
            const files = await fs.promises.readdir(moduleName)
            const tasks = files.map(name => this.load(join(moduleName, name)))
            await Promise.all(tasks)
        } else if (stat.isFile()) {
            if (!pattern.some(e => e.test(moduleName))) {
                return
            }
            await loadModule(moduleName)
        }
    }

    router.watch = function watch(this: FourzeRouter, dir?: string | FSWatcher, customWatcher?: FSWatcher) {
        let watchDir: string
        let watcher: FSWatcher | undefined = undefined

        if (typeof dir === "string") {
            watchDir = dir
            watcher = customWatcher
        } else {
            watchDir = rootDir
            watcher = dir
        }

        if (!watcher) {
            const chokidar = require("chokidar") as typeof import("chokidar")
            watcher = chokidar.watch(watchDir)
        }

        watcher.add(watchDir)

        watcher.on("all", async (event, path) => {
            if (!path.startsWith(watchDir) || path.endsWith(TEMPORARY_FILE_SUFFIX)) {
                return
            }

            switch (event) {
                case "add":
                    await this.load(path)
                    break
                case "change":
                    this.remove(path)
                    await this.load(path)
                    break
                case "unlink":
                    this.remove(path)
                    break
                case "unlinkDir":
                    for (const modName of Object.keys(require.cache)) {
                        if (modName.startsWith(path)) {
                            this.remove(modName)
                        }
                    }
                    await this.load()
                    break
            }
        })
        return this
    }

    router.remove = function (this: FourzeRouter, moduleName: string) {
        moduleNames.delete(moduleName)
        delete require.cache[moduleName]
        return this
    }

    router.proxy = function (this: FourzeRouter, p: string | FourzeProxyOption) {
        let path: string
        let dir: string
        let renderBase = base
        if (typeof p == "string") {
            path = p
            dir = join(rootDir, "/", path)
        } else {
            path = p.path
            dir = p.target ?? join(rootDir, "/", path)
            renderBase = p.base ?? base
        }

        routes.push({
            path,
            base: renderBase,
            handle: createRenderer(dir)
        })
        return this
    }

    Object.defineProperties(router, {
        name: {
            get() {
                return "FourzeRouter"
            }
        },
        base: {
            get() {
                return base
            }
        },
        moduleNames: {
            get() {
                return Array.from(moduleNames)
            }
        },
        routes: {
            get() {
                return routes
                    .concat(
                        Array.from(moduleNames)
                            .map(modName => {
                                const mod = require.cache[modName]
                                const instance = mod?.exports?.default
                                if (isFourze(instance)) {
                                    return instance.routes
                                }
                                if (Array.isArray(instance) && instance.some(isRoute)) {
                                    return instance
                                }
                                if (isRoute(instance)) {
                                    return instance
                                }
                                return []
                            })
                            .flat()
                    )
                    .map(e => (e.base ? e : defineRoute({ ...e, base })))
                    .sort((a, b) => {
                        if (b.path.startsWith(a.path)) {
                            return 1
                        }
                        return b.path.localeCompare(a.path)
                    })
            }
        }
    })

    return router
}
