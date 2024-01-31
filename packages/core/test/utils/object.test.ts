import { expect, it } from "vitest";
import { aliasObjectMap, isKeyOf, objectMap } from "../../src/utils/object";

it("test-utils-object-aliasObjectMap", async () => {
  const obj = {
    name: "test",
    age: 12,
    children: [
      {
        name: "test2",
        age: 13
      }
    ],
    inherit: {
      name: "test3",
      age: 14
    }
  };
  const alias = aliasObjectMap(obj, {
    name2: "name",
    age2: "age",
    children2: "children",
    hello() {
      return "world";
    }
  }, ["inherit"]);

  expect(alias.name2).toBe("test");
  expect(alias.age2).toBe(12);
  expect(alias.children2).length(1);
  expect(alias.children2[0].name).toBe("test2");
  expect(alias.children2[0].age).toBe(13);
  expect(alias.hello).toBe("world");
  expect(alias.inherit).toBe(obj.inherit);
});

it("test-utils-object-isKeyOf", () => {
  expect(isKeyOf({ name: "test" }, "name")).toBe(true);
});

it("test-utils-object-objectMap", () => {
  expect(objectMap({ name: "test", age: 12 }, (key, value) => {
    if (key === "name") {
      return ["name2", value];
    }
  })).toEqual({ name2: "test" });
});
