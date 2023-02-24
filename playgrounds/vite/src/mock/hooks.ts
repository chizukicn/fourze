import { definePlugin } from "@fourze/core";
import { createResolveMiddleware } from "@fourze/middlewares";
import { failResponseWrap, successResponseWrap } from "../utils/setup-mock";

export default definePlugin((app) => {
  app.use(createResolveMiddleware(successResponseWrap, failResponseWrap));
});
