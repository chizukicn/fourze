import { definePlugin, jsonWrapperHook } from "@fourze/core";
import { failResponseWrap, successResponseWrap } from "@/utils/setup-mock";

export default definePlugin((app) => {
  app.use(jsonWrapperHook(successResponseWrap, failResponseWrap));
});
