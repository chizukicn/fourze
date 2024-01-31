# Fourze Server

## Usage

```
import { defineRouter } from "@fourze/core";
import { createServer } from "@fourze/server"

const server = createServer({
    host: "localhost",
    base: "/api"
})

server.use(defineRouter(router=>{
  router.get("/hello",(req,res)=>{
    return "hello,world"
  })
}))

server.listen(7609)

```
` GET http://localhost:7609/api/hello `
```
{
  "hello": "world"
}
```
