import { createMockRouter } from "@fourze/mock";
import { describe, expect, it } from "vitest";

describe("hooks", async () => {
  it("test-hooks", async () => {
    const data = {
      token: "test-token",
    };

    const router = createMockRouter({
      delay: "200-500",
      mode: ["fetch"],
    })
      .use("/api", route => {
        route("GET /test", req => {
          return {
            token: req.meta.token,
          };
        });
        route("POST /test", req => {
          return "anything";
        });
      })
      .use("/", route => {
        route.hook("/api", async (req, res, next) => {
          if (req.headers["token"]) {
            req.meta.token = req.headers["token"].toString().toUpperCase();
          }
          res.setHeader("token", data.token);
        });

        route.hook("/api/test", async (req, res, next) => {
          if (req.method == "delete") {
             return "delete";
          }
        });

        route.hook("/api/test", (req, res, next) => {
          if (req.method == "post") {
            return "post";
          }
          return next?.();
        });

        route.hook("/api/test", (req, res, next) => {
          if (req.method == "post") {
            return "unknown";
          }
          return next?.();
        });
      });

    await router.setup();

    const res = await fetch("/api/test", {
      headers: {
        token: data.token,
      },
    }).then(r => r.json());

    expect(res.token).toEqual(data.token.toUpperCase());

    const res2 = await fetch("/api/test", { method: "post" });

    const resToken = res2.headers.get("token");

    expect(resToken).toEqual(data.token);

    const text = await res2.text();

    expect(text).toEqual("post");
  });
});
