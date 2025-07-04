<h1 align="center">Fourze</h1>
<p align="center"> Api route framework for the browser and node.js.</p>

`pnpm add @fourze/core`

create a router file `src/mock/example.ts`

```ts
import { defineRouter } from "@fourze/core";

export default defineRouter((router) => {
  router.get("/hello", () => {
    return "hello,world";
  });
});
```

configure vite config

`pnpm add @fourze/vite`

```ts
import fourze from "@fourze/vite";

export default defineConfig({
  plugins: [
    fourze({
      base: "/api"
    })
  ],
});
```

then you can fetch `/api/hello` to get response.

# Features
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fchizukicn%2Ffourze.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fchizukicn%2Ffourze?ref=badge_shield)

-   Simple api route register

-   Mock XHR/fetch/http.request response

-   Run in express / nitro or ... as a middleware

-   Node.js and browser support

# Development
```shell
pnpm install
pnpm build
pnpm play:vite
```

# Nuxt

`pnpm add @fourze/nuxt`

nuxt.config.ts

```ts
export default defineNuxtConfig({
  modules: ["@fourze/nuxt"],
  fourze: {
    base: "/api"
  }
});
```

# Node.js Server

`pnpm add @fourze/server`

```ts
import { defineRouter } from "@fourze/core";
import { createServer } from "@fourze/server";

const server = createServer({
  base: "/api"
});
server.use(defineRouter((router) => {
  router.get("/hello", (_, res) => {
    res.send("hello,world");
  });
}));
server.listen(7609);
```

## Middleware Mode

```ts
import { createServer } from "@fourze/server";
import express from "express";

const middleware = createServer({
  base: "/api"
});
const app = express();
app.use(middleware);
app.listen(7609);
```

# Register Router

src/mock/example.ts

```ts
import { defineRouter } from "@fourze/core";

export default defineRouter((router) => {
  // base = '/api'
  router.post("/user/{id}", (req) => {
    return {
      id: req.params.id,
      name: "test"
    };
  });
});
```

Set `base` to `/api` in vite/nuxt config, then you can fetch `/api/user/1` to get response.

Request

` POST /api/user/1`

Response

`{"id":"1","name":"test"}`

# Thanks
This project is heavily inspired by the following awesome projects.

- [Mock.js](https://github.com/nuysoft/Mock.git)

- [express](https://github.com/expressjs/express.git)

- [Fastify](https://github.com/fastify/fastify.git)

- [axios](https://github.com/axios/axios.git)

- [Vue.js](https://github.com/vuejs/vue.git)

- [VueUse](https://github.com/vueuse/vueuse.git)

- [radix3](https://github.com/unjs/radix3.git)

- [jiti](https://github.com/unjs/jiti.git)

## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fchizukicn%2Ffourze.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fchizukicn%2Ffourze?ref=badge_large)
