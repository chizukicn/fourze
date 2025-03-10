import { defineRouter } from "@fourze/core";
import { createMockApp } from "@fourze/mock";
import nodeFetch from "node-fetch";
import { expect, it } from "vitest";

it("test-hooks", async () => {
  globalThis.fetch = nodeFetch as unknown as typeof globalThis.fetch;

  const data = {
    token: "test-token"
  };

  const app = createMockApp({
    delay: "200-500",
    mode: ["fetch"]
  })
    .use("/api", async (req, res, next) => {
      if (req.headers.token) {
        req.meta.token = req.headers.token.toString().toUpperCase();
      }
      res.setHeader("token", data.token);
      await next();
    })
    .use("/api/test", async (req, res, next) => {
      if (req.method === "delete") {
        res.send("delete");
        return;
      }
      await next();
    })
    .use("/api/test", async (req, res, next) => {
      if (req.method === "post") {
        res.send("post");
        return;
      }
      await next();
    })
    .use("/api/test", async (req, res, next) => {
      if (req.method === "post") {
        res.send("post");
        return;
      }
      await next?.();
    })
    .use("/api", defineRouter((router) => {
      router.route("GET /test", (req) => {
        return {
          token: req.meta.token
        };
      });
      router.route("POST /test", () => {
        return "anything";
      });
    }));

  await app.ready();

  const res = await app.fetch("/api/test", {
    headers: {
      token: data.token
    }
  });

  const { token } = await res.json();

  expect(token).toEqual(data.token.toUpperCase());

  const res2 = await app.fetch("/api/test", { method: "post" });

  const resToken = res2.headers.get("token");

  expect(resToken).toEqual(data.token);

  const text = await res2.text();

  expect(text).toEqual("post");
});
