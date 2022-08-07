import { Fourze, isFourze } from "../app"
import { defineRoute, FourzeInstance, FourzeRoute, isRoute } from "../shared"
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

    const instance: FourzeInstance = {
        routes: _routes,
        interceptors: []
    }

    globalThis.XMLHttpRequest = createProxyXHR(instance)
    globalThis.fetch = createProxyFetch(instance)
}
