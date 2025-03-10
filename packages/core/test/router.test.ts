import { createApp, defineRouter } from "@fourze/core";
import { expect, it } from "vitest";

it("router-send", async () => {
  const app = createApp();
  app.use(defineRouter((router) => {
    router.route("/hello", (_, res) => {
      res.send("hello,world!");
    });
  }));
  await app.ready();
  const { response } = await app.service({
    url: "/hello"
  });
  expect(response.payload).toBe("hello,world!");
  expect(response.sent).toBe(true);
});

it("router-return", async () => {
  const app = createApp();
  app.use(defineRouter((router) => {
    router.route("/hello", () => {
      return "hello,world!";
    });
  }));
  await app.ready();
  const { response } = await app.service({
    url: "/hello"
  });
  expect(response.payload).toBe("hello,world!");
  expect(response.sent).toBe(true);
});

it("router-undefined", async () => {
  const app = createApp();
  app.use(defineRouter((router) => {
    router.route("/hello", () => {
      return undefined;
    });
  }));
  await app.ready();
  const { response } = await app.service({
    url: "/hello"
  });
  expect(response.payload).toBeUndefined();
  expect(response.sent).toBe(true);
});
