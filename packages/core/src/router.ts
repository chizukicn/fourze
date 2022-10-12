import { MaybeAsyncFunction, MaybePromise, MaybeRegex } from "maybe-types"
import { parseUrl } from "query-string"
import { defineFourze, Fourze, FourzeSetup, isFourze } from "./app"
import { delayHook } from "./hooks"
import { createLogger } from "./logger"
import {
    createRequestContext,
    defineRoute,
    FourzeContext,
    FourzeHook,
    FourzeInstance,
    FourzeMiddleware,
    FourzeNext,
    FourzeRequest,
    FourzeRequestContextOptions,
    FourzeResponse,
    FourzeRoute,
    FourzeSetupContext
} from "./shared"
import { asyncLock, DelayMsType, isMatch, relativePath, unique } from "./utils"

export interface FourzeRouter extends FourzeMiddleware {
    /**
     * 根据url匹配路由
     * @param url
     * @param method
     * @allowed 是否验证路由在允许规则内
     */
    match(url: string, method?: string, allowed?: boolean): [FourzeRoute, RegExpMatchArray] | []

    /**
     *  是否允许,但不一定匹配
     * @param url
     */
    isAllow(url: string): boolean

    release(): void
    setup(): MaybePromise<void>
    use(module: FourzeInstance): this
    use(setup: FourzeSetup): this
    use(path: string, setup: FourzeSetup): this

    request(context: FourzeRequestContextOptions): Promise<FourzeContext>

    readonly routes: FourzeRoute[]
    readonly hooks: FourzeHook[]
    readonly context: FourzeSetupContext

    readonly options: Required<FourzeRouterOptions>
}

export interface FourzeRouterOptions {
    /**
     * @example localhost
     */
    host?: string
    port?: string

    /**
     *  根路径
     */
    base?: string
    /**
     *  路由模块
     */
    modules?: FourzeInstance[]

    /**
     *  延时
     */
    delay?: DelayMsType

    /**
     * 允许的路径规则,默认为所有
     * @default []
     */
    allow?: MaybeRegex[]

    /**
     *  不允许的路径规则
     */
    deny?: MaybeRegex[]

    /**
     *  不在base域下的外部路径
     *  @example ["https://www.example.com"]
     */
    external?: MaybeRegex[]
}

export function createRouter(): FourzeRouter

export function createRouter(options: FourzeRouterOptions): FourzeRouter

export function createRouter(modules: Fourze[]): FourzeRouter

export function createRouter(setup: MaybeAsyncFunction<Fourze[] | FourzeRouterOptions>): FourzeRouter

export function createRouter(params: FourzeRouterOptions | Fourze[] | MaybeAsyncFunction<FourzeInstance[] | FourzeRouterOptions> = {}): FourzeRouter {
    const isFunction = typeof params === "function"
    const isArray = Array.isArray(params)
    const isOptions = !isFunction && !isArray
    const setup: MaybeAsyncFunction<FourzeInstance[] | FourzeRouterOptions> = isFunction ? params : () => params
    const modules = new Set<FourzeInstance>()

    let options = isOptions ? params : {}

    const routes = new Set<FourzeRoute>()

    const hooks = new Set<FourzeHook>()

    const logger = createLogger("@fourze/core")

    let _context: FourzeSetupContext

    const router = async function (request: FourzeRequest, response: FourzeResponse, next?: FourzeNext) {
        const { url, method } = request

        if (router.isAllow(url)) {
            await router.setup()

            const [route, matches] = router.match(url, method, true)
            logger.info("request allow ->", method, url)

            if (route && matches) {
                const activeHooks = router.hooks.filter(e => !e.base || url.startsWith(e.base))
                const params: Record<string, any> = {}

                for (let i = 0; i < route.pathParams.length; i++) {
                    const key = route.pathParams[i].slice(1, -1)
                    const value = matches[i + 1]
                    params[key] = value
                }

                request.route = route
                request.query = parseUrl(url, {
                    parseNumbers: true,
                    parseBooleans: true
                }).query

                if (matches.length > route.pathParams.length) {
                    request.relativePath = matches[matches.length - 2]
                }
                request.params = params
                request.data = {
                    ...request.body,
                    ...request.query,
                    ...request.params
                }

                request.meta = {
                    ...request.meta,
                    ...route.meta
                }

                const handle = async () => {
                    let nexted = false
                    const next = async (res = true) => {
                        nexted = true
                        if (res) {
                            await handle()
                        }
                    }

                    const hook = activeHooks.shift()

                    if (hook) {
                        const hookReturn = await hook.handle(request, response, next)

                        if (hookReturn) {
                            response.result = hookReturn ?? response.result
                        } else if (!nexted) {
                            await next()
                        }
                    } else {
                        response.result = (await route.handle(request, response)) ?? response.result
                    }
                }

                await handle()
                response.matched = true
            }
        }

        if (response.matched) {
            logger.info("request match ->", method, url)
            if (!response.writableEnded) {
                if (!!response.result && !response.hasHeader("Content-Type")) {
                    response.json(response.result)
                }
                response.end(response.result)
            }
        } else {
            await next?.()
        }
    } as FourzeRouter

    router.isAllow = function (url: string) {
        const { allow, deny, external, base = "" } = options
        // 是否在base域下
        let rs = url.startsWith(base)
        const relativeUrl = relativePath(url, base)

        if (allow?.length) {
            // 有允许规则,必须在base域下
            rs &&= isMatch(relativeUrl, ...allow)
        }
        if (external?.length) {
            // 有外部规则,允许不在base域下
            rs ||= isMatch(url, ...external)
        }
        if (deny?.length) {
            // 有拒绝规则,优先级最高
            rs &&= !isMatch(relativeUrl, ...deny)
        }
        return rs
    }

    router.match = function (this: FourzeRouter, url: string, method?: string, allowed = false): [FourzeRoute, RegExpMatchArray] | [] {
        if (allowed || this.isAllow(url)) {
            for (const route of this.routes) {
                const matches = route.match(url, method, options.base)
                if (matches) {
                    return [route, matches]
                }
            }
        }
        return []
    }

    router.request = async function (this: FourzeRouter, options: FourzeRequestContextOptions) {
        const { request, response } = createRequestContext(options)
        await this(request, response)
        return { request, response }
    }

    router.use = function (module: FourzeInstance | FourzeSetup | string, setup?: FourzeSetup) {
        if (typeof module === "string") {
            if (!setup) {
                return this
            }
            module = defineFourze(module, setup)
        } else if (typeof module === "function") {
            module = defineFourze(module)
        }

        modules.add(module)
        this.release()

        return this
    }

    const setupRouter = asyncLock(async function () {
        const rs = await setup()
        const isArray = Array.isArray(rs)

        if (!isArray) {
            options.base = rs.base ?? options.base
            options.allow = rs.allow ?? options.allow
            options.delay = rs.delay ?? options.delay
            options.modules = rs.modules ?? options.modules
            options.deny = rs.deny ?? options.deny
            options.external = rs.external ?? options.external
        } else {
            options.modules = rs
        }

        const newModules = unique([...(options.modules ?? []), ...modules])

        const newRoutes: FourzeRoute[] = []
        const newHooks: FourzeHook[] = []

        await Promise.all(
            newModules.map(async e => {
                if (isFourze(e)) {
                    await e.setup()
                }
                newRoutes.push(...e.routes)
                newHooks.push(...e.hooks)
            })
        )
        routes.clear()
        hooks.clear()

        if (options.delay) {
            hooks.add(delayHook(options.delay))
        }

        for (const route of newRoutes) {
            routes.add(
                defineRoute({
                    ...route,
                    base: route.base ?? options.base
                })
            )
        }
        for (const hook of newHooks) {
            hooks.add(hook)
        }
    })

    Object.defineProperties(router, {
        setup: {
            get() {
                return setupRouter
            }
        },
        options: {
            get() {
                const opt = {} as Required<FourzeRouterOptions>
                opt.base = options.base ?? ""
                opt.delay = options.delay ?? 0
                opt.allow = options.allow ?? []
                if (opt.base) {
                    opt.allow = unique([...(options.allow ?? []), opt.base])
                }
                opt.deny = options.deny ?? []
                opt.modules = options.modules ?? []
                return opt
            }
        },

        release: {
            get() {
                return setupRouter.release
            }
        },
        routes: {
            get() {
                return Array.from(routes)
            }
        },
        hooks: {
            get() {
                return Array.from(hooks)
            }
        },
        context: {
            get() {
                return _context
            }
        }
    })

    return router
}
