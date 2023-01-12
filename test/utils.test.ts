import {
  createSingletonPromise,
  delay,
  DelayMsType,
  parseFakerNumber,
  randomArray,
  randomInt,
  randomItem,
  relativePath,
  resolvePath,
  slash
} from "@fourze/core";
import { describe, expect, it } from "vitest";

describe("utils", () => {
  it("faker", () => {
    expect(parseFakerNumber("200")).toBe(200);
    expect(parseFakerNumber(300)).toBe(300);
    expect(parseFakerNumber("abc")).toBeNaN();
    expect(parseFakerNumber("300-600")).greaterThan(200).lessThanOrEqual(600);
    expect(parseFakerNumber("600-900")).toBeLessThanOrEqual(900);
    const tmp = parseFakerNumber(["200", 600, "900-1200"]);
    expect(tmp).greaterThanOrEqual(200).lessThanOrEqual(1200);
  });

  it("random", () => {
    const array = randomArray(
      (index) => {
        return {
          name: `item-${index}`,
          count: randomInt("200-500"),
        };
      },
      12,
      30
    );
    const item = randomItem(array);
    expect(array).length.greaterThanOrEqual(12).lessThanOrEqual(30);
    expect(array).include(item);
  });

  it("test-slash", () => {
    const path = "/hello/world/"
    const base = "/api/"
    expect(slash(base,path))
  });

  it("test-relativePath", () => {
    const path = "/abc/def/ghi";
    const path2 = "/abc/def/ghi/";
    const path3 = "/abc/";
    const path4 = "/abc"
    const base = "/abc";
    const normalBase = "/"
    expect(relativePath(path, base)).toBe("/def/ghi");
    expect(relativePath(path2, base)).toBe("/def/ghi");
    expect(relativePath(path3, base)).toBe("/");
    expect(relativePath(path4, base)).toBe("/");
    expect(relativePath(path, normalBase)).toBe("/abc/def/ghi");
  });

  it("test-resolvePath", () => {
    const path = "https://test.com";
    const base = "/api";
    const final0 = resolvePath(path, base);
    expect(final0).toBe(path);
    const finalPath = resolvePath(final0, base);
    expect(finalPath).toEqual(path);
    expect(resolvePath("//api/hello")).toEqual("/api/hello");
  });



  it("createSingletonPromise", async () => {
    const createInstance = () => randomInt("374-9197");

    const fn = createSingletonPromise(createInstance);

    const delayFn = function (ms: DelayMsType) {
      return async () => {
        await delay(ms);
        return fn();
      };
    };

    const r = await fn();

    fn.reset();

    const [r0, r1] = await Promise.all(
      [delayFn(300), delayFn("200-700")].map((r) => r())
    );

    expect(r0).not.toBe(r);

    expect(r0).toBe(r1);
    const r2 = await delayFn("300-700")();
    expect(r2).toBe(r0);
  });
});
