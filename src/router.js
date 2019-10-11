import logger from './util/logger'
import {Middleware} from "./middleware"

/**
 * 路由器
 * @param path 上下文
 * @param routes 路由
 * @constructor
 */
export class Router extends Middleware {
    constructor({path = "/", routes = [], returnTypes} = {}) {
        super("router", 0)
        this.path = path;
        this.routes = [];
        this.returnTypes = Object.assign({}, returnTypes, defaultReturnTypes)
        routes.forEach(route => this.push(route))
    }

    bind(app) {
        for (let method of requestMethods) {
            app[method] = (path, handle) => this.push({path, method, handle})
        }
        app.request = (path, handle) => this.push({path, method: "all", handle})
    }

    next({data, path, request, response}) {
        const method = request.method.toLowerCase()
        for (let route of this.routes) {
            const matchedResults = path.match(route.pattern)
            if ((route.method === "all" || route.method === method) && matchedResults) {
                let pathParams = {}
                if (route.pathParams) {
                    for (let i = 0; i < route.pathParams.length; i++) {
                        let parameterName = route.pathParams[i]
                        parameterName = parameterName.substring(1, parameterName.length - 1)
                        pathParams[parameterName] = matchedResults[i + 1]
                    }
                }
                let handle = route.handle
                if (handle) {
                    const resolve = result => {
                        if (result) {
                            let returnTypes = this.returnTypes
                            let returnType = returnTypes[route.returnType] || returnTypes.json
                            let convert = route.convert || returnType.convert
                            result = convert ? convert(result) : result
                            let write = route.write || returnType.write || defaultWrite
                            write(response, result, returnType)
                            response.end()
                        }
                    }
                    let params = Object.assign({}, pathParams, request.params, data)
                    let args = Object.assign({}, params, {request, response, resolve})
                    let result = typeof handle === "function" ? handle(args) : handle
                    if (result instanceof Promise) {
                        result.then(resolve)
                    } else {
                        resolve(result)
                    }
                }
                return false
            }
        }
        return true
    }


    push(route) {
        let routePath = `${this.path}/${route.path}`.replace(/\/+/g, "/")
        let pattern = `^${routePath.replace(/({\w+})/g, '\(\[a-zA-Z0-9-\\s\]\+\)')}$`
        let pathParams = routePath.match(/{(\w+)}/g);
        let mapping = {
            path: routePath,
            pattern: pattern,
            pathParams: pathParams,
            handle: route.handle,
            method: (route.method || "all").toLowerCase(),
            returnType: (route.returnType || "json").toLowerCase()
        }
        if (mapping.method !== 'all' && !requestMethods.includes(mapping.method)) {
            logger.error(`not support request method [${mapping.method}] in ${mapping.path}`)
            return false
        }
        logger.info(`request mapping:[${mapping.method}]${mapping.path}`)
        this.routes.push(mapping)
    }

}


const defaultReturnTypes = {
    text: {
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        }
    },
    html: {
        headers: {
            "Content-Type": "text/html;charset=utf-8"
        }
    },
    json: {
        headers: {
            "Content-Type": "application/json;charset=utf-8"
        },
        convert: JSON.stringify
    },
    image: {
        headers: {
            "Content-Type": "image/png"
        },
        encoding: "binary"
    }//,
    //template
}

const requestMethods = ["get", "post", "put", "patch", "delete", "options"]

function defaultWrite(response, result, options = {}) {
    let headers = options.headers || {}
    let encoding = options.encoding || "utf-8"
    for (let key in headers) {
        response.setHeader(key, headers[key])
    }
    response.write(result, encoding)
}

function error(response, message, code) {
    response.statusCode = code
    defaultWrite(response, `${code}:${message}`)
}
