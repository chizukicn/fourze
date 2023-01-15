import { createApp } from "@fourze/core";

import { createServer } from "@fourze/server";

const app = createApp();
app.get("/", () => {
  return {
    hello: "world"
  };
});

const server = createServer(app);
server.listen(3000);
