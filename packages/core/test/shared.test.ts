import { createApp } from "@fourze/core";
import { expect, it } from "vitest";

it("test-isAllow", async () => {
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
