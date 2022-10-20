import { defineFourze, FourzeHandle, jsonWrapperHook, PolyfillFile, randomArray, randomDate, randomInt, randomItem } from "@fourze/core"
import fs from "fs"
import path from "path"
import { slicePage, successResponseWrap } from "../utils/setup-mock"
import { isNode } from "./../../../../packages/core/src/utils/common"

interface Pagination {
    page: number
    pageSize: number
}

export default defineFourze(fourze => {
    fourze.hook(jsonWrapperHook((data, req, res) => successResponseWrap(data, req.url)))

    // person names

    const createData = (source: "server" | "mock") => {
        if (source == "mock") {
            if (localStorage.getItem("fz_cache_data")) {
                return JSON.parse(localStorage.getItem("fz_cache_data")!) as UserInfo[]
            }
        }

        return randomArray<UserInfo>(
            value => {
                return {
                    id: `${randomInt(100, 999)}${String(value).padStart(4, "0")}`,
                    username: randomItem(["Zhangsan", "Lisi", "Wangwu", "Zhaoliu", "Yan7", "Jack", "Rose", "Tom", "Jerry", "Henry", "Nancy"]),
                    phone: randomInt("13000000000-19999999999"),
                    createdTime: randomDate("2020-01-01", "2021-01-01"),
                    allow: randomItem(["fetch", "xhr"]),
                    source
                }
            },
            40,
            80
        )
    }

    function cacheData() {
        if (!isNode()) {
            localStorage.setItem("fz_cache_data", JSON.stringify(data))
        }
    }

    const data = isNode() ? createData("server") : createData("mock")
    cacheData()

    const handleSearch: FourzeHandle<PagingData<UserInfo>> = async req => {
        const { page = 1, pageSize = 10, keyword = "" } = req.query as Pagination & { keyword?: string }
        const items = data.filter(item => item.username.includes(keyword))
        return slicePage(items, { page, pageSize })
    }

    fourze("GET /item/list", handleSearch)

    fourze("DELETE /item/{id}", async req => {
        const { id } = req.params
        const index = data.findIndex(item => item.id == id)
        if (index == -1) {
            throw new Error(`item(${id}) not exists`)
        }
        data.splice(index, 1)
        cacheData()
        return { result: true }
    })

    fourze("/img/avatar.jpg", async (req, res) => {
        let avatarPath = path.resolve(__dirname, ".tmp/avatar.jpg")
        if (!fs.existsSync(avatarPath)) {
            avatarPath = path.resolve(__dirname, "./test.webp")
        }
        res.setHeader("Fourze-Delay", 0)
        const f = await fs.promises.readFile(avatarPath)
        res.image(f)
    })

    fourze("/upload/avatar", async (req, res) => {
        const file = req.body.file as PolyfillFile
        if (!!file?.body) {
            if (!fs.existsSync(path.resolve(__dirname, ".tmp"))) {
                fs.mkdirSync(path.resolve(__dirname, ".tmp"))
            }

            await fs.promises.writeFile(path.resolve(__dirname, ".tmp/avatar.jpg"), file.body)
            return {
                size: file.size
            }
        }
        return {
            size: 0
        }
    })

    return []
})
