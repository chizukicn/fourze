import { createApp, isMatch } from "@fourze/core";
import { expect, test } from "vitest";

test("test-isMatch", () => {
  expect(isMatch("/api/hello/test", "/api/*", "/api/hello")).toBe(true);
  expect(isMatch("/api/hello/test", "*/hello/test", "/api/hello/*")).toBe(true);
  expect(isMatch("http://www.test.com", "http://**.test.com")).toBe(true);
});

test("test-isAllow", async () => {
  const app = createApp({
    base: "/api",
    allow: ["/api/test", "/api/hello", "/api/add"],
    deny: ["/api/deny"]
  });

  await app.ready();

  expect(app.isAllow("/api/test")).toBe(true);
  expect(app.isAllow("/api/deny")).toBe(false);
  expect(app.isAllow("/api/noallow")).toBe(false);
  expect(app.isAllow("/api/hello")).toBe(true);
});
