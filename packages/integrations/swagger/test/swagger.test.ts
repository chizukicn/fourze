import type { Server } from "node:http";
import { createApp, defineRouter, randomInt, withBase } from "@fourze/core";
import { connect, normalizeAddress } from "@fourze/server";
import { service } from "@fourze/swagger";
import axios from "axios";
import express from "express";
import { expect, it } from "vitest";

it("test-swagger", async () => {
  const app = createApp({
    base: "/api",
    allow: ["/api/test", "/api/hello", "/api/add"],
    deny: ["/api/deny"]
  });

  const router = defineRouter({}).get("/test", {
    meta: {
      summary: "test"
    }
  }, () => {
    return {
      name: "test",
      count: randomInt(200)
    };
  });

  app.use(router);

  await app.ready();

  const swaggerRouter = service(app);

  const expressApp = express();

  //   expressApp.use(connect(app));

  expressApp.use(connect(swaggerRouter));

  const server: Server = await new Promise((resolve) => {
    const _server = expressApp.listen(0, "localhost", () => {
      resolve(_server);
    });
  });

  const origin = normalizeAddress(server.address(), {
    protocol: "http"
  });

  const url = origin ? withBase("/api-docs", origin) : "/api-docs";

  const response = await axios.get(url);

  expect(response.status).toEqual(200);
});
