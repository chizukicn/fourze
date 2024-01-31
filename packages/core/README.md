# Fourze Core

## Register Route

```ts
import { defineRouter } from "@fourze/core";

export default defineRouter((router) => {
  router.get("/hello", (_, res) => {
    res.send("hello,world");
  });
});
```
