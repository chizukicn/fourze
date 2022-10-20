export const isNode = () => typeof window === "undefined"

export const isBrowser = () => !isNode()

export function normalizeRoute(path: string, method: string = "GET") {
    method = method.toUpperCase()
    return `[${method}] ${path}`
}
