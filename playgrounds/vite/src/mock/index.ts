import { defineFourze, FourzeHandle, randomInt } from "@fourze/core"
import dayjs from "dayjs"
import fs from "fs"
import path from "path"
import { successResponseWrap } from "../utils/setup-mock"

const keymap = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

export default defineFourze(fourze => {
    const cache: Record<string, any> = {}

    fourze.use(async (req, res, next) => {
        if (cache[req.url]) {
            res.result = cache[req.url]
            console.log("hit cache", req.url)
        } else {
            await next?.()
            cache[req.url] = res.result
            req.meta.cache = cache
        }
        res.result = successResponseWrap(res.result, req.route.path)
    })

    const handleSearch: FourzeHandle = async (req, res) => {
        const num = Number(req.params.name ?? 0)
        const phone: number = req.body.phone ?? 1
        const rs: Record<string, string> = {}
        for (let i = 0; i < num + phone; i++) {
            const len = 10
            let str = ""
            for (let j = 0; j < len; j++) {
                str += keymap[randomInt(0, keymap.length - 1)]
            }
            rs[str] = `---[${dayjs().format("YYYY-MM-DD HH:mm:ss")}] ---- ${phone}`
        }
        return rs
    }

    fourze("POST:http://test.com/Search/:name", handleSearch)

    fourze("POST:/search/:name", handleSearch)

    fourze("/img/a.jpg", async (req, res) => {
        const f = await fs.promises.readFile(path.resolve(__dirname, "./test.jpg"))
        res.image(f)
    })

    fourze("/download/a", async (req, res) => {
        const f = await fs.promises.readFile(path.resolve(__dirname, "./index.ts"))
        res.binary(f)
    })

    fourze("post:/upload", async (req, res) => {})

    return []
})