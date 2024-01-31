# Fourze Mock

## Usage

```ts
import { defineRouter } from "@fourze/core";
import { createMockApp } from "@fourze/mock";

const app = createMockApp({
  base: "/api",
  mode: ["fetch", "xhr"]
});

app.use(
  defineRouter((router) => {
    router.get("/hello", (_, res) => {
      res.send({
        hello: "world"
      });
    });
  })
);
```

` GET http://localhost:7609/api/hello `

```
{
  "hello": "world"
}
```
