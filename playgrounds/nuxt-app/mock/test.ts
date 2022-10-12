import { defineFourze } from "@fourze/core"
export default defineFourze([
    {
        path: "/test",
        method: "get",
        handle: (req: any, res: any) => {
            res.end("write test.")
        }
    }
])
