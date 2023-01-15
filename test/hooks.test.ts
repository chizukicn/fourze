import { defineRouter } from '@fourze/core';
import { createMockApp } from "@fourze/mock";
import { describe, expect, it } from "vitest";
import nodeFetch from "node-fetch";

describe("hooks", async () => {
  it("test-hooks", async () => {

    globalThis.fetch = nodeFetch as typeof globalThis.fetch;

    const data = {
      token: "test-token",
    };

    const app = createMockApp({
      delay: "200-500",
      mode: ["fetch"],

    })
      .use("/api", async (req, res, next) => {
        if (req.headers["token"]) {
          req.meta.token = req.headers["token"].toString().toUpperCase();
        }
        res.setHeader("token", data.token);
        await next();
      }).use("/api/test", async (req, res, next) => {
        if (req.method == "delete") {
          res.send("delete");
          return;
        }
        await next();
      }).use("/api/test", async (req, res, next) => {
        if (req.method == "post") {
          res.send("post");
          return;
        }
        await next();
      }).use("/api/test", async(req, res, next) => {
        if (req.method == "post") {
          res.send("post");
          return
        }
        await next?.();
      })
      .use("/api", defineRouter(router => {
        router.route("GET /test", req => {
          return {
            token: req.meta.token,
          };
        });
        router.route("POST /test", req => {
          return "anything";
        });
      }))


    await app.ready();

    const res = await fetch("/api/test", {
      headers: {
        token: data.token,
      },
    }).then(r => r.json());

    expect(res.token).toEqual(data.token.toUpperCase());

    const res2 = await fetch("/api/test", { method: "post" });

    const resToken = res2.headers.get("token");

    // 请求一个swagger示例的json接口
    const res3 = await fetch("https://petstore.swagger.io/v2/pet/findByStatus?status=available").then(r=>r.json())

    expect(res3).toBeInstanceOf(Array);


    expect(resToken).toEqual(data.token);

    const text = await res2.json();

    expect(text).toEqual("post");
  });


});
