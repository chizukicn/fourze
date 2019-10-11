import {Filter} from "../../../src"

export default new Filter({
    chains: [
        {
            pattern:"/index.html",
            order: 1,
            handle(req, rep, next) {
                console.log("this is filter 1")
                next()
            }
        }
    ]
})
