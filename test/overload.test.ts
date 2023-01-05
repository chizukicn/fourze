import { overload, OverloadConfig } from "@fourze/core";
import { describe, expect, it } from "vitest";

describe("overload", async () => {
  const overloadConfig = [
    {
      name: "path",
      type: "string",
      required: true,
    },
    {
      name: "method",
      type: "string",
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
  ] as OverloadConfig;

  it("should overload", () => {
    const data = overload(overloadConfig, [
      "/test",
      {
        name: {
          type: String,
          required: true,
          meta: {
            title: "姓名",
          },
        },
      },
      {
        summary: "测试",
        response: {
          type: String,
        },
      },
      (req) => req.meta.summary,
    ]);
    expect(data.handle).toBeTruthy();
  });
});
