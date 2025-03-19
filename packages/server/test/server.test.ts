import type { Server } from "node:http";
import { createApp, defineRouter, randomInt, withBase } from "@fourze/core";
import { connect, createServer, normalizeAddress } from "@fourze/server";
import axios from "axios";
import express from "connect";
import { expect, it } from "vitest";

it("run-server", async () => {
  const host = "localhost";
  const port = 0;

  const app = createApp({
    base: "/api"
  });
  const server = createServer(app, {
    host,
    port
  });

  const testData = {
    name: "test",
    count: randomInt(200)
  };

  const router = defineRouter({}).get("/test", () => {
    return {
      ...testData
    };
  });

  server.use(router);

  await server.listen();

  const returnData = await axios
    .get<typeof testData>(withBase("/api/test", server.origin))
    .then((r) => r.data);

  expect(returnData).toEqual(testData);
});

it("run-connect", async () => {
  const host = "0.0.0.0";
  const port = 0;

  const app = express();

  const testData = {
    name: "test",
    count: randomInt(200)
  };

  const router = defineRouter({}).get("/test", () => {
    return {
      ...testData
    };
  });

  app.use("/api/", connect(router));

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(port, host, () => {
      resolve(s);
    });
  });

  const origin = normalizeAddress(server.address(), {
    protocol: "http",
    hostname: host
  });

  const url = `${origin ?? ""}/api/test`;

  const returnData = await axios
    .get<typeof testData>(url)
    .then((r) => r.data);

  expect(returnData).toEqual(testData);
});
