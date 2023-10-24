import { setup } from "@fourze/core";
import { createResolveMiddleware } from "@fourze/middlewares";
import { failResponseWrap, successResponseWrap } from "../utils/setup-mock";

export default setup((app) => {
  app.use(createResolveMiddleware(successResponseWrap, failResponseWrap));
});
