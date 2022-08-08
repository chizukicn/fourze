import comporession from "compression"
import ejs from "ejs"

import { FourzeRequest, FourzeResponse } from "@fourze/core"
import { CommonMiddleware, createApp, createHotRouter, createRenderer, FourzeRendererContext } from "@fourze/server"
import fs from "fs"
import path from "path"

const router = createHotRouter(route => {
    route("GET:/hello", () => {
        return {
            msg: "hello router 1"
        }
    })
})

const router2 = createHotRouter(route => {
    route("GET:/test/hello", () => {
        return {
            msg: "hello router 2"
        }
    })
})

export async function renderEjs(request: FourzeRequest, response: FourzeResponse, context: FourzeRendererContext) {
    const file = path.normalize(context.file)
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        return ejs.renderFile(file, {})
    }
}

const renderer = createRenderer({ dir: path.resolve(process.cwd(), "./"), fallbacks: { "/home": "/" } })

renderer.use(renderEjs)

const app = createApp({})

app.use("/test", comporession({ threshold: 0 }) as CommonMiddleware)
app.use(router, router2)

app.use(renderer)
app.listen()
