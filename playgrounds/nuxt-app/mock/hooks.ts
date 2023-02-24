import { definePlugin, resolveHook } from "@fourze/core";
import { failResponseWrap, successResponseWrap } from "../utils/setup-mock";

export default definePlugin((app) => {
  app.use(resolveHook(successResponseWrap, failResponseWrap));
});
