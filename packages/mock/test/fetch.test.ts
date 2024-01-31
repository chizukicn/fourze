import { defineRouter, randomInt, setLoggerLevel } from "@fourze/core";
import { createMockApp } from "@fourze/mock";
import { expect, it } from "vitest";

it("mock-base", async () => {
  const app = createMockApp({
    delay: "200-500",
    mode: ["fetch"],
    base: "/api"
  });
  app.use(defineRouter((router) => {
    router.route("/hello", () => {
      return {
        name: "test"
      };
    });
  }));
  await app.ready();
  const data = await app.fetch("/api/hello").then(r => r.json());
  expect(data).toEqual({
    name: "test"
  });
});

it("mock-fetch", async () => {
  const testData = {
    name: "test",
    count: randomInt(200)
  };
  setLoggerLevel("debug");

  const app = createMockApp({
    delay: "200-500",
    mode: ["fetch"],
    host: "localhost:7609"
  }).use(async (req, res, next) => {
    res.setHeader("x-test", "abcd");
    res.appendHeader("x-test", "test");
    await next?.();
  });

  const router = defineRouter((router) => {
    router.route("/hello", () => {
      return {
        ...testData
      };
    });
  });

  app.use(router);

  await app.ready();

  const fetchReturn = await app.fetch("http://localhost:7609/hello");

  const fetchReturnHeaders = fetchReturn.headers.get("x-test");

  expect(fetchReturnHeaders).include("test");

  const fetchReturnData = await fetchReturn.json();

  expect(fetchReturnData).toEqual(testData);
});
