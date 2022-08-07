import type { FourzeInstance, FourzeRequest, FourzeRoute } from "./shared"

export interface FourzeMatcher {
    match(request: FourzeRequest): FourzeRoute | undefined
    match(url: string, method: string): FourzeRoute | undefined
    readonly routes: FourzeRoute[]
}

export function createMatcher(instance: FourzeInstance): FourzeMatcher {
    return {
        match(request: FourzeRequest | string, method?: string): FourzeRoute | undefined {
            const url = typeof request == "string" ? request : request.url
            method = (typeof request == "string" ? method : request.method) ?? method
            return instance.routes.find(e => e.match(url, method))
        },
        get routes() {
            return instance.routes
        }
    }
}
