import { expect, test } from "vitest";
import {
  withBase,
  withoutBase
} from "../../src/utils/path";


test("test-relativePath", () => {
  const path = "/abc/def/ghi";
  const path2 = "/abc/def/ghi/";
  const path3 = "/abc/";
  const path4 = "/abc";
  const path5 = "/abc/abc.js";
  const base = "/abc";
  const normalBase = "/";
  expect(withoutBase(path, base)).toBe("/def/ghi");
  expect(withoutBase(path2, base)).toBe("/def/ghi/");
  expect(withoutBase(path3, base)).toBe("/");
  expect(withoutBase(path4, base)).toBe("/");
  expect(withoutBase(path5, base)).toBe("/abc.js");
  expect(withoutBase(path, normalBase)).toBe("/abc/def/ghi");
});

test("test-resolvePath", () => {
  const base = "https://test.com";
  const path = "/api";
  expect(withBase(path, base)).toBe("https://test.com/api");

  expect(withBase("/swagger-ui.css", "/swagger-ui/")).toBe("/swagger-ui/swagger-ui.css");
});

