import { Fourze, isFourze } from "../app"
import { createRouter } from "../router"
import { defineRoute, FourzeRoute, isRoute } from "../shared"
import { createProxyFetch } from "./fetch"
import { createProxyXHR } from "./xhr"

interface MockOptions {
    base?: string
    routes?: FourzeRoute[] | Fourze[]
}

export function setupMock({ base, routes = [] }: MockOptions) {
    const _routes = routes
        .map(e => (isFourze(e) ? e.routes : e))
        .flat()
        .filter(isRoute)
        .map(e => (e.base ? e : defineRoute({ ...e, base })))

    const instance = createRouter({
        routes: _routes,
        hooks: []
    })

    globalThis.XMLHttpRequest = createProxyXHR(instance)
    globalThis.fetch = createProxyFetch(instance)
}
