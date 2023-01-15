import { defineOverload } from "@fourze/core";
import { describe, expect, it } from "vitest";

describe("overload", async () => {
  const overload = defineOverload([
    {
      name: "path",
      type: "string",
      required: true,
    },
    {
      name: "method",
      type: "string",
      default:()=> "get",
    },
    {
      name: "props",
      type: "object",
    },
    {
      name: "meta",
      type: "object",
    },
    {
      name: "handle",
      type: "function",
      required: true,
    },
  ]);

  it("should overload", () => {
    const data = overload([
      "/test",
      {
        name: "test-overload",
      },
      {
        summary: "测试",
      },
      () => "hello,world!",
    ]);

    expect(data?.path).toBe("/test");
    expect(data?.method).toBe("get");
    expect(data?.props?.name).toBe("test-overload");
    expect(data?.meta?.summary).toBe("测试");
    expect(data?.handle?.()).toBe("hello,world!")

    const data1 = overload([
      "/test2",
      "put",
      {
        summary: "测试",
      },
      () => "hello,world!"
    ]);

    expect(data1?.path).toBe("/test2");
    expect(data1?.method).toBe("put");
    expect(data1?.props?.summary).toBe("测试");
    expect(data1?.handle?.()).toBe("hello,world!")

    const data2 = overload([
      "/test3",
      "post",
      (req:any) => req.meta.summary,
    ]);

    expect(data2?.path).toBe("/test3");
    expect(data2?.method).toBe("post");
    expect(data2?.handle).toBeTruthy();
  });
});
