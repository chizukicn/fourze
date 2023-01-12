import { defineRouter, randomInt } from "@fourze/core";
import { createServer } from "@fourze/server";
import axios from "axios";
import { describe, expect, it } from "vitest";

describe("server", async () => {
  it("run-server", async () => {
    const host = "localhost";
    const port = 0;

    const server = createServer({
      host,
      port,

    });

    const testData = {
      name: "test",
      count: randomInt(200),
    };

    const router = defineRouter({}).get("/api/test", () => {
      return {
        ...testData,
      };
    });


    server.use(router);

    await server.listen();

    const returnData = await axios
      .get<typeof testData>(`${server.origin}/api/test`)
      .then((r) => r.data);

    expect(returnData).toEqual(testData);
  });
});
