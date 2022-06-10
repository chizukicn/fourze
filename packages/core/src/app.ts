import { defineRoute, FourzeBaseRoute, FourzeHandle, FourzeRoute, FOURZE_METHODS, isRoute, RequestMethod } from "./shared"
export interface FourzeOptions {
    base?: string
    setup?: FourzeSetup
    routes?: FourzeBaseRoute[]
}

export type FourzeSetup = (fourze: Fourze) => void | FourzeBaseRoute[]

export type FourzeRequestFunctions = {
    [K in RequestMethod]: (path: string, handle: FourzeHandle) => Fourze
}

export interface Fourze extends FourzeRequestFunctions {
    (path: string, method: RequestMethod | undefined, handle: FourzeHandle): Fourze
    (path: string, handle: FourzeHandle): Fourze
    (route: FourzeBaseRoute): Fourze
    (routes: FourzeBaseRoute[]): Fourze
    (fourze: Fourze): Fourze
    readonly routes: FourzeRoute[]
}

const FOURZE_SYMBOL = Symbol("FourzeInstance")

export function defineFourze(routes: FourzeBaseRoute[]): Fourze

export function defineFourze(options: FourzeOptions): Fourze

export function defineFourze(setup: FourzeSetup): Fourze

export function defineFourze(): Fourze

export function defineFourze(options: FourzeOptions | FourzeBaseRoute[] | FourzeSetup = {}): Fourze {
    const isRoutes = Array.isArray(options)
    const isSetup = typeof options === "function"
    const isOption = !isRoutes && !isSetup

    const base = isOption ? options.base : undefined
    const setup = isOption ? options.setup : isSetup ? options : undefined
    const routes = (isOption ? options.routes : isRoutes ? options : []) ?? []

    const fourze = function (this: Fourze, param0: string | FourzeBaseRoute | FourzeBaseRoute[] | Fourze, param1: string | FourzeHandle, param2?: FourzeHandle) {
        if (isFourze(param0)) {
            routes.push(...param0.routes)
        } else if (Array.isArray(param0)) {
            routes.push(...param0)
        } else if (typeof param0 === "object") {
            routes.push(param0)
        } else {
            let method: RequestMethod | undefined = undefined
            let handle: FourzeHandle
            let path = param0

            if (typeof param1 === "string") {
                method = param1 as RequestMethod
                handle = param2 as FourzeHandle
            } else {
                handle = param1 as FourzeHandle
            }

            routes.push({
                path,
                method,
                handle
            })
        }
        return this
    } as Fourze

    Object.defineProperties(fourze, {
        routes: {
            get() {
                return routes.map(e => {
                    if (isRoute(e)) {
                        return e
                    }
                    return defineRoute({
                        base,
                        ...e
                    })
                })
            }
        },
        ...Object.fromEntries(
            FOURZE_METHODS.map(method => [
                method,
                {
                    get() {
                        return function (this: Fourze, path: string, handle: FourzeHandle) {
                            return this(path, method, handle)
                        }
                    }
                }
            ])
        ),

        [FOURZE_SYMBOL]: {
            get() {
                return true
            }
        }
    })

    const extra = setup?.(fourze) ?? []

    if (Array.isArray(extra) && extra.length > 0) {
        routes.push(...extra)
    }

    return fourze
}

export function isFourze(fourze: any): fourze is Fourze {
    return fourze && fourze[FOURZE_SYMBOL]
}