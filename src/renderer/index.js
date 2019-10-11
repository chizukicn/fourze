import path from 'path'
import fs from 'fs'
import {Middleware} from "../middleware"
import defaultContentTypes from './contentTypes'
/***
 * 渲染器
 * 用于渲染模板
 @author kritsu
 @date 2018/12/5 15:49
 **/
import logger from '../util/logger'

const defaultPages = {
    "/404": path.resolve(__dirname, './pages/404.html')
}

export class Renderer extends Middleware {
    constructor({
                    baseUrl = path.resolve(process.cwd(), "./public"),
                    indexName = 'index',
                    indexes = [],
                    engines = [],
                    pages = {},
                    contentTypes
                } = {}) {
        super("renderer", 1)
        this.baseUrl = baseUrl
        logger.info(`Renderer initialize start ${baseUrl}.`)
        this.indexName = indexName
        this.indexes = ["index.html", "index.htm"]
        if (indexes instanceof String) {
            this.indexes.push(indexes)
        } else {
            for (let key in indexes) {
                this.indexes.push(indexes[key])
            }
        }
        this.contentTypes = Object.assign({}, defaultContentTypes, contentTypes)
        this.engines = engines
        this.pages = Object.assign(defaultPages, pages)
    }

    use(...engines) {
        for (let engine of engines) {
            for (let suffix of engine.suffixes) {
                this.indexes.unshift(`${this.indexName}.${suffix}`)
            }
            this.engines.unshift(engine)
        }
        console.log(this.indexes)
        return this
    }

    bind(app) {
        super.bind(app);
    }


    match(url) {
        let p = this.pages[url] || path.join(this.baseUrl, url)
        if (!fs.existsSync(p)) {
            return null
        }
        //文件夹的判断
        let stat = fs.lstatSync(p)
        if (stat.isDirectory() || p.endsWith("\\")) {
            for (let index of this.indexes) {
                let page = path.join(p, index)
                if (fs.existsSync(page)) {
                    return page
                }
            }
            return null
        }
        return p
    }

    getContentType(file) {
        for (let contentType in this.contentTypes) {
            let pattern = this.contentTypes[contentType]
            if (pattern.test(file)) {
                return contentType
            }
        }
        return null
    }

    render(file) {
        for (let engine of this.engines) {
            for (let suffix of engine.suffixes) {
                if (file.endsWith(suffix)) {
                    return engine.render(file)
                }
            }
        }
        return fs.readFileSync(file)
    }

    next({path, response}) {
        let file = this.match(path)
        if (file) {
            let contentType = this.getContentType(file)
            if (contentType) {
                response.setHeader("Content-Type", contentType)
            }
            let data = this.render(file)
            response.write(data, 'binary')
            return false
        }
        return true
    }

    addPage(pages) {
        this.pages = Object.assign(this.pages, pages)
    }

}
