import { defineRouter, randomInt, setLoggerLevel } from "@fourze/core";
import { createMockApp } from "@fourze/mock";
import nodeFetch from "node-fetch";
import { describe, expect, it } from "vitest";

describe("fetch", async () => {
  it("mock-fetch", async () => {
    globalThis.fetch = nodeFetch as typeof globalThis.fetch;
    const testData = {
      name: "test",
      count: randomInt(200),
    };
    setLoggerLevel("debug");

    const app = createMockApp({
      delay: "200-500",
      mode: ["fetch"],
      origin: "http://localhost:7609",
    }).use(async (req, res, next) => {
      res.setHeader("x-test", "abcd");
      res.appendHeader("x-test", "test");
      await next?.();
    })

    const router = defineRouter(router => {
      router.route("/hello", (req, res) => {
        return {
          ...testData,
        };
      })
    });

    app.use(router);

    await app.mount();

    const fetchReturn = await fetch("http://localhost:7609/hello");

    const fetchReturnHeaders = fetchReturn.headers.get("x-test");

    expect(fetchReturnHeaders).include("test");

    const fetchReturnData = await fetchReturn.json();

    expect(fetchReturnData).toEqual(testData);
  });
});
