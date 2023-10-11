import http from "node:http";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ hello: "world" }));
});

server.listen(3000);

process.on("SIGINT", () => {
  server.close();
});
