import { expect, it } from "vitest";
import { createRouteMatcher } from "../src/shared/matcher";

it("mock-matcher", async () => {
  const matcher = createRouteMatcher<string>();

  matcher.add("/hello/1", "get", "hello-1");
  matcher.add("/hello/{userId}", "get", "hello-abc");
  matcher.add("/hello/1", "post", "hello-post");
  matcher.add("/hello/3", "all", "hello-3");

  expect(matcher.match("/hello/1", "get")).toEqual(["hello-1", null]);
  expect(matcher.match("/hello/2", "get")).toEqual(["hello-abc", { userId: "2" }]);
  expect(matcher.match("/hello/1", "post")).toEqual(["hello-post", null]);
  expect(matcher.match("/hello/3", "get")).toEqual(["hello-3", null]);
  expect(matcher.match("/hello/3", "post")).toEqual(["hello-3", null]);
});
