import { defineFourzeComponent, FourzeComponent, FourzeMiddleware, FourzeRequest, FourzeResponse, isFourzeComponent, Logger } from "@fourze/core"
import { createHash } from "crypto"
import { build } from "esbuild"
import fs from "fs"
import mime from "mime"
import path from "path"

export interface FourzeRendererOptions {
    /**
     * 根路径
     */
    base?: string

    /**
     *  目录
     */
    dir?: string

    /**
     *  模板
     */
    templates?: FourzeRenderTemplate[]

    /**
     *  文件不存在时跳转到该目录的根路径
     */
    fallbacks?: string[] | Record<string, string>
}

export interface FourzeRenderer extends FourzeMiddleware {
    templates: FourzeRenderTemplate[]
    use: (...middlewares: FourzeRenderTemplate[]) => this
}

export type FourzeRenderTemplate = (request: FourzeRequest, response: FourzeResponse, context: FourzeRendererContext) => any

export interface FourzeRendererContext {
    file: string

    /**
     *  @see FourzeRendererOptions["dir"]
     */
    dir: string

    logger: Logger
}

export function renderFile(request: FourzeRequest, response: FourzeResponse, context: FourzeRendererContext) {
    let p = context.file
    const extensions = ["html", "htm"]
    const maybes = [p].concat(extensions.map(ext => path.normalize(`${p}/index.${ext}`)))
    do {
        p = maybes.shift()!
        if (!!p && fs.existsSync(p) && fs.statSync(p).isFile()) {
            return fs.readFileSync(p)
        }
    } while (!!p)
}

export async function renderTsx(request: FourzeRequest, response: FourzeResponse, context: FourzeRendererContext) {
    const file = path.normalize(context.file)

    const maybes = file.match(/\.[t|j]sx$/) ? [file] : []
    maybes.push(...["index.tsx", "index.jsx"].map(ext => path.normalize(`${file}/${ext}`)))

    for (let maybe of maybes) {
        if (fs.existsSync(maybe) && fs.statSync(maybe).isFile()) {
            const hash = "_" + createHash("md5").update(fs.readFileSync(maybe)).digest("hex").slice(0, 8)
            const tmp = path.normalize(`${maybe.replace(/\.[t|j]sx$/g, "")}${hash}.tmp.js`)

            await build({
                entryPoints: [maybe],
                target: "esnext",
                format: "esm",
                banner: { js: `import { createElement as ${hash}} from '@fourze/core'` },
                jsxFactory: hash,
                jsxFragment: "'fragment'",
                outfile: tmp,
                write: true
            })

            const { default: mod } = await require(tmp)

            await fs.promises.rm(tmp)

            let { render, setup } = isFourzeComponent(mod) ? mod : defineFourzeComponent(mod)

            if (setup) {
                const setupReturn = await setup()
                if (typeof setupReturn == "function") {
                    render = setupReturn as FourzeComponent["render"]
                }
            }

            if (render && typeof render === "function") {
                let content = await render()

                response.setHeader("Content-Type", "text/html; charset=utf-8")
                response.end(content)
            }
        }
    }
}

/**
 * @returns
 */
export function createRenderer(options: FourzeRendererOptions | string = {}): FourzeRenderer {
    const dir = (options && typeof options === "object" ? options.dir : options) ?? process.cwd()
    const templates = (options && typeof options == "object" ? options.templates : [renderTsx]) ?? [renderTsx]
    const base = typeof options == "string" ? "/" : options.base ?? "/"
    const _fallbacks = (options && typeof options == "object" ? options.fallbacks : []) ?? []
    const fallbacks = Array.isArray(_fallbacks) ? _fallbacks.map(f => [f, f]) : Object.entries(_fallbacks)

    const logger = new Logger("@fourze/renderer")

    async function render(request: FourzeRequest, response: FourzeResponse, context: FourzeRendererContext) {
        for (let template of templates) {
            const content = await template(request, response, context)
            if (!!content || response.writableEnded) {
                return content
            }
        }
        return renderFile(request, response, context)
    }

    const renderer = async function (request: FourzeRequest, response: FourzeResponse, next?: () => void | Promise<void>) {
        const url = request.relativePath
        if (url.startsWith(base)) {
            const context = { file: path.join(dir, url), logger, dir }

            let content = await render(request, response, context)

            if (response.writableEnded) {
                return
            }

            if (!content) {
                for (let [fr, to] of fallbacks) {
                    if (url.startsWith(fr)) {
                        to = path.normalize(path.join(dir, to))
                        context.file = to
                        content = await render(request, response, context)

                        if (response.writableEnded) {
                            return
                        }

                        if (!!content) {
                            logger.info("fallback", url, " => ", to)
                            break
                        }
                    }
                }
            }

            if (content && !response.writableEnded) {
                logger.info("render page", url)
                if (!response.hasHeader("Content-Type")) {
                    response.setHeader("Content-Type", mime.getType(url) ?? "text/html")
                }
                response.end(content)
                return
            }
        }

        await next?.()
    }

    Object.defineProperty(renderer, "name", {
        get() {
            return "FourzeRenderer"
        }
    })

    Object.defineProperty(renderer, "templates", {
        get() {
            return templates
        }
    })

    renderer.use = function (this: FourzeRenderer, ...arr: FourzeRenderTemplate[]) {
        templates.push(...arr)
        return this
    }

    return renderer as FourzeRenderer
}
