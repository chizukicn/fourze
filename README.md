<h1 align="center">Fourze</h1>
<p align="center"> Api route framework for the browser and node.js.</p>

# Features

-   Simple api route register

-   Mock XHR/fetch/http.request response

-   Run in express / nitro or ... as a middleware

-   Node.js and browser support

# Install

`pnpm add @fourze/core`

or

`pnpm add @fourze/mock`

# Vite

`pnpm add @fourze/vite`

vite.config.ts

```

import fourze from "@fourze/vite"

export default defineConfig({
    plugins: [
        fourze({
            base:'/api'
        })
    ],
})

```

# Nuxt

`pnpm add @fourze/nuxt`

nuxt.config.ts

```

export default defineNuxtConfig({
    modules: ["@fourze/nuxt"],
    fourze: {
        base: "/api"
    }
})

```

# Node.js Server

`pnpm add @fourze/server`

```
    import { createFourzeServer,createHotRouter } from "@fourze/server"

    const server = createFourzeServer({
        base: "/api"
    })
    const router = createHotRouter({
        dir:"./mock"
    })
    server.use(router)
    server.listen(7609)
```

## Middleware Mode

```

    import express from "express"
    import { createFourzeServer } from "@fourze/server"
    const middleware = createFourzeServer({
        base: "/api"
    })
    const app = express()
    app.use(middleware)
    app.listen(7609)

```

# Register Route

src/mock/example.ts

```

    import {defineFourze} from "@fourze/core"
    export default defineFourze(route=>{
        // base = '/api'
        route("/user/{id}",(req,res)=>{
            return {
                id:req.params.id
                name:"test"
            }
        })
    })

```

Set `base` to `/api` in vite/nuxt config, then you can fetch `/api/user/1` to get response.

Request

` GET /api/user/1`

Response

`{"id":"1","name":"test"}`
