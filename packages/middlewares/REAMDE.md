# Fourze Middlewares

## Delay

```ts
import { createApp } from "@fourze/core";
import { createDelayMiddleware } from "@fourze/middlewares";

const app = createApp({
  base: "/api"
});

app.use(createDelayMiddleware("100-300"));
```

## Resolve

  ```ts
  import { createApp, defineRouter } from "@fourze/core";
  import { createResolveMiddleware } from "@fourze/middlewares";
  import { createServer } from "@fourze/server";

  const app = createApp({
    base: "/api"
  });

  app.use(createResolveMiddleware({
    resolve: (data) => {
      return {
        code: 200,
        message: "success",
        data
      };
    }
  }));

  app.use(defineRouter((router) => {
    router.get("/hello", (_, res) => {
      res.send({
        hello: "world"
      });
    });
  }));

  const server = createServer(app);
  server.listen(7609);
```
` GET http://localhost:7609/api/hello `
```
{
  "code": 200,
  "message": "success",
  "data": {
    "hello": "world"
  }
}
```

## HEADER

```ts
import { createApp } from "@fourze/core";
import { createHeaderMiddleware } from "@fourze/middlewares";

const app = createApp({
  base: "/api"
});

app.use(createHeaderMiddleware({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild",
  "Access-Control-Allow-Methods": "PUT, POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true"
}));
```
