import { createMatcher, defineFourze, defineRoute, FourzeBaseRoute, FourzeRequest, FourzeResponse, FourzeRoute, FourzeSetup, isFourze, isRoute, Logger } from "@fourze/core"
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
    load(): Promise<boolean>
    load(moduleName: string): Promise<boolean>
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

    function getRoutes() {
        return routes
            .concat(
                Array.from(moduleNames)
                    .map(modName => {
                        const mod = require.cache[modName]
                        const instance = mod?.exports?.default ?? mod?.exports
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
            }) as FourzeRoute[]
    }

    const matcher = createMatcher({
        get routes() {
            return getRoutes()
        }
    })

    const router = async function (this: FourzeRouter, req: FourzeRequest, res: FourzeResponse, next?: () => void | Promise<void>) {
        const route = matcher.match(req)
        if (route) {
            return route.dispatch(req, res, next)
        }
        await next?.()
    } as FourzeRouter

    router.load = async function (this: FourzeRouter, moduleName: string = rootDir) {
        if (!fs.existsSync(moduleName)) {
            return false
        }

        const loadModule = async (mod: string) => {
            if (mod.endsWith(".ts")) {
                return loadTsModule(mod)
            } else {
                return loadJsModule(mod)
            }
        }

        const loadJsModule = async (f: string) => {
            delete require.cache[f]
            const mod = require(f)
            const route = mod?.exports?.default ?? mod?.default ?? mod?.exports
            if (isFourze(route) || isRoute(route) || (Array.isArray(route) && route.some(isRoute))) {
                moduleNames.add(f)
                return true
            }
            logger.error(`find not route with "${f}" `, route)
            return false
        }

        const loadTsModule = async (mod: string) => {
            if (!fs.existsSync(mod)) {
                return false
            }
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
                    allowOverwrite: true,
                    target: "es6"
                })
                return loadJsModule(modName)
            } catch (err) {
                logger.error(`load file ${modName}`, err)
            } finally {
                try {
                    await fs.promises.unlink(modName)
                } catch (err) {
                    logger.error("delete file " + modName + " error", err)
                }
            }
            return false
        }

        const stat = await fs.promises.stat(moduleName)
        if (stat.isDirectory()) {
            const files = await fs.promises.readdir(moduleName)
            const tasks = files.map(name => this.load(join(moduleName, name)))
            return await Promise.all(tasks).then(r => r.some(f => f))
        } else if (stat.isFile()) {
            if (!pattern.some(e => e.test(moduleName))) {
                return false
            }
            return loadModule(moduleName)
        }
        return false
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
                case "add": {
                    const load = await this.load(path)
                    if (load) {
                        logger.info(`load module ${path}`)
                    }
                    break
                }
                case "change": {
                    const load = await this.load(path)
                    if (load) {
                        logger.info(`reload module ${path}`)
                    }
                    break
                }
                case "unlink":
                    this.remove(path)
                    logger.info(`remove module ${path}`)
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

    return Object.defineProperties(router, {
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
                return getRoutes()
            }
        }
    })
}
