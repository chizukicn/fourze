import { createServer } from "node:http";
import { connect } from "@fourze/server";
import { createApp } from "@fourze/core";

const app = createApp();

const server = createServer(connect(app.use((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ hello: "world" }));
})));

server.listen(3000);

process.on("SIGINT", () => {
  server.close();
});
