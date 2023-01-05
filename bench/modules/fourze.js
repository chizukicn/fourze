import { createRouter } from "@fourze/core";

import { createFourzeServer } from "@fourze/server";

const router = createRouter();
router.get("/", () => {
  return {
    hello: "world"
  };
});

const server = createFourzeServer();
server.use(router);
server.listen(3000);
