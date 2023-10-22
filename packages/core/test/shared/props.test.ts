import { defineExtends } from "@fourze/core";
import { expect, it } from "vitest";

it("defineExtends", () => {
  const extendsFn = defineExtends({
    age: 1
  });

  const obj = extendsFn({
    name: "fourze"
  });

  expect(obj).toEqual({
    name: "fourze",
    age: 1
  });
});
