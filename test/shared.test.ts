import { createApp, defineRouter, isMatch, randomInt, resolvePath } from "@fourze/core";
import { describe, expect, it } from "vitest";

describe("shared", async () => {

  it("test-isMatch", () => {
    expect(isMatch("/api/hello/test", "/api/*", "/api/hello")).toBe(true);
    expect(isMatch("http://www.test.com", "http://**.test.com")).toBe(true);
  });

  it("test-isAllow", async () => {

    const app = createApp({
      base:'/api',
      delay: "200-500",
      allow: ["/api/test", "/api/hello", "/api/add"],
      deny: ["/api/deny"],
    })


    expect(app.isAllow("/api/test")).toBe(true);
    expect(app.isAllow("/api/deny")).toBe(false);
    expect(app.isAllow("/api/noallow")).toBe(false);
    expect(app.isAllow("/api/hello")).toBe(true);

  });
});
