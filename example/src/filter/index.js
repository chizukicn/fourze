import {Filter} from "../../../src"

export default new Filter({
    chains: [
        {
            pattern:"/api/test",
            handle(req, rep, next) {
                console.log("this is filter 1")
                rep.write("HelloWorld")
                rep.end()
            }
        }
    ]
})
