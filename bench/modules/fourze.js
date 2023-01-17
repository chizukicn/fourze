import { defineRouter } from "@fourze/core";

import { createServer } from "@fourze/server";

const router = defineRouter(router => {
  router.get("/", () => {
    return {
      hello: "world"
    };
  });
});

const server = createServer();
server.use(router);
server.listen(3000);
