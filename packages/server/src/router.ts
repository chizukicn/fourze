import { createLogger, createRouter, defineFourze, DelayMsType, Fourze, FourzeBaseHook, FourzeBaseRoute, FourzeRoute, FourzeRouter, FourzeRouterOptions, isFourze, isRoute } from "@fourze/core"
import type { FSWatcher } from "chokidar"
import fs from "fs"
import { join, resolve } from "path"
import { createRenderer } from "./renderer"
import { normalizePath } from "./utils"

export interface FourzeHotRouterOptions extends FourzeRouterOptions {
    /**
     * 根路径
     * @default "/"
     */
    base?: string

    /**
     * 路由模块目录
     * @default "routes"
     */
    dir?: string
    /**
     * 文件监听器
     */
    watcher?: FSWatcher

    /**
     * 文件匹配规则
     */
    pattern?: (string | RegExp)[]

    /**
     * 路由模块
     */
    modules?: Fourze[]

    /**
     * 模块文件路径
     */
    moduleNames?: string[]

    /**
     * 响应延迟时间
     * @default 0
     */
    delay?: DelayMsType
}

export interface FourzeHotRouter extends FourzeRouter {
    name: string
    load(): Promise<boolean>
    load(moduleName: string): Promise<boolean>
    remove(moduleName: string): this
    watch(watcher?: FSWatcher): this
    watch(dir?: string, watcher?: FSWatcher): this
    proxy(p: string | FourzeProxyOption): this
    delay?: DelayMsType
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

export function createHotRouter(options: FourzeHotRouterOptions = {}): FourzeHotRouter {
    const base = (options.base = options.base ?? "/")
    const delay = options.delay ?? 0
    const rootDir = resolve(process.cwd(), options.dir ?? "routes")

    const pattern = transformPattern(options.pattern ?? [".ts", ".js"])
    const moduleNames = new Set(Array.from(options.moduleNames ?? []))

    const modules: Fourze[] = Array.from(options.modules ?? [])

    const logger = createLogger("@fourze/server")

    const extraModuleMap = new Map<string, Fourze[]>()

    const router = createRouter(async () => {
        await router.load()
        const allModules = modules.concat(Array.from(extraModuleMap.values()).flat())

        return {
            ...options,
            base,
            modules: allModules,
            delay
        }
    }) as FourzeHotRouter

    router.load = async function (this: FourzeHotRouter, moduleName: string = rootDir) {
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
            try {
                delete require.cache[f]
                const mod = require(f)
                const instance = mod?.default ?? mod
                const extras: Fourze[] = []

                const extraRoutes: FourzeBaseRoute[] = []
                const extraHooks: FourzeBaseHook[] = []

                const fn = async (ins: any) => {
                    if (isFourze(ins)) {
                        extras.push(ins)
                    } else if (Array.isArray(ins)) {
                        await Promise.all(ins.map(fn))
                    } else if (isRoute(ins)) {
                        extraRoutes.push(ins)
                    }
                }

                await fn(instance)

                if (extraRoutes.length > 0 || extraHooks.length > 0) {
                    const extraModule = defineFourze({
                        routes: extraRoutes,
                        hooks: extraHooks
                    })

                    extras.push(extraModule)
                }

                extraModuleMap.set(f, extras)

                moduleNames.add(f)

                if (extras.length > 0) {
                    return true
                }
                logger.error(`find not route with "${f}" `)
            } catch (e) {
                logger.error(e)
            }
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

    router.watch = function (this: FourzeHotRouter, dir?: string | FSWatcher, customWatcher?: FSWatcher) {
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
                        logger.info(`reload module ${normalizePath(path)}`)
                    }
                    break
                }
                case "unlink":
                    this.remove(path)
                    logger.info(`remove module ${path}`)
                    break
            }
            router.refresh()
        })
        return this
    }

    router.remove = function (this: FourzeHotRouter, moduleName: string) {
        moduleNames.delete(moduleName)
        extraModuleMap.delete(moduleName)
        delete require.cache[moduleName]
        return this
    }

    router.proxy = function (this: FourzeHotRouter, p: string | FourzeProxyOption) {
        let path: string
        let dir: string
        let renderBase = base
        if (typeof p == "string") {
            path = p
            dir = join(rootDir, "/", path)
        } else {
            path = p.path
            dir = p.target ?? join(rootDir, "/", path)
            renderBase = base
        }

        const module = defineFourze({
            base,
            routes: [
                {
                    path,
                    handle: createRenderer(dir)
                }
            ]
        })

        const proxyName = `proxymodules`

        const modules = extraModuleMap.get(proxyName) ?? []
        modules.push(module)

        extraModuleMap.set(proxyName, modules)

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
        delay: {
            get() {
                return delay
            }
        },
        moduleNames: {
            get() {
                return Array.from(moduleNames)
            }
        }
    })
}
