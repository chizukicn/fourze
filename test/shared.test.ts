import { createApp, defineRouter, isMatch, randomInt, resolvePath } from "@fourze/core";
import { describe, expect, it } from "vitest";

describe("shared", async () => {

  it("test-isMatch", () => {
    expect(isMatch("/api/hello/test", "/api/*", "/api/hello")).toBe(true);
    expect(isMatch("http://www.test.com", "http://**.test.com")).toBe(true);
  });

  it("test-route", async () => {
    const testData = {
      name: "test",
      count: randomInt(200),
    };

    const app = createApp({
      base:'/api',
      delay: "200-500",
      allow: ["/api/**", "/hello", "/add"],
      deny: ["/api/deny"],
      external: ["http://www.test.com"]
    })

    const router = defineRouter(route => {
      route.get("/test", () => {
        return {
          ...testData,
        };
      });

      route.get("/hello", () => {
        return {
          ...testData,
        };
      });

      route.get("/noallow", () => {
        return "not-allow";
      });

      route.route("get http://test.com/hello", () => {
        return {
          ...testData,
        };
      });

      route.route("GET http://www.test.com/hello", () => {
        return {
          ...testData,
        };
      });

      route.get("/deny", () => {
        return "deny";
      });

      route.route("POST //add", () => {
        return {
          ...testData,
        };
      });
    });

    await app.use(router).mount();

    // has not base
    expect(router.match("/api/test")).not.length(0);

    // in external
    expect(router.match("http://www.test.com/hello")).not.length(0);
    // not in external
    expect(router.match("http://test.com/hello")).length(0);

    // not in allow
    expect(router.match("/api/hello")).not.length(0);
    expect(router.match("/v1/noallow")).length(0);
    // allow,but not matched
    expect(router.match("/hello")).length(0);

    // in deny
    expect(router.match("/api/deny")).length(0);
  });
});
