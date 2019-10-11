import {Server} from '../../src'
import router from './router'
import filter from './filter'

let app = new Server()
app.use(filter,router)
app.listen(8081)




app.request("/api/test",()=>{
    return Promise.resolve(["HelloWorld"])
})

app.on("ready",()=>{
    console.log("Server is Ready")
})