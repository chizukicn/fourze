import http from 'http'
import logger from './util/logger'
import url from "url"
import querystring from 'querystring'
/***
 @author kritsu
 @date 2018/12/5 14:42
 **/

const X_WWW_FORM_URLENCODED="application/x-www-form-urlencoded"
const FORM_DATA="application/form-data"




export class Server {
    constructor({host = "localhost", port = 8080,middlewares=[]}={}) {
        this.host = host
        this.port = port
        this.middlewares = middlewares
        this.middlewares.forEach(p => this.use(p))
        this.listeners = {}
    }

    use(...middlewares) {
        for (let middleware of middlewares) {
            this['$' + middleware.name] = middleware
            if (!this.middlewares.includes(middleware)) {
                middleware.bind && middleware.bind(this)
                this.middlewares.push(middleware)
            }
        }
        return this
    }

    parseData(request,callback) {
        let contentType=request.headers["content-type"]||X_WWW_FORM_URLENCODED
        let data = ""
        request.on("data", chunk => data += chunk)
        request.on("end", () => {
            switch (contentType) {
                case X_WWW_FORM_URLENCODED:
                    data=querystring.parse(data)
                    break
                case FORM_DATA:
                    break
            }
            callback(data)
        })
    }


    on(name,listener) {
        let l = this.listeners[name] || []
        l.push(listener)
        this.listeners[name] = l
    }

    emit(name,args) {
        let l = this.listeners[name] || []
        l.forEach(h => h(args))
    }


    listen(port,host) {
        this.port = port || this.port
        this.host = host || this.host
        if (!this.server) {
            this.server = http.createServer((request, response) => {
                this.emit("request",{request,response})
                this.parseData(request,data=>{
                    let path = decodeURI(url.parse(request.url).pathname)
                    this.handle({request, response, path, data})
                })
            })
        }

        if (this.server) {
            this.server.listen(this.port, this.host, () => {
                logger.info(`http server listen at http://${this.host}:${this.port}`)
                this.emit("ready")
            })
        }
        return this
    }

    handle({request,response,path,data}) {
        const app = this
        const context = Object.assign({path, data, request, response, app})
        app.emit("next", context)
        response.end()
        app.emit("end")
    }


}
