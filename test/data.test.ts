import { createRouter, randomInt, setLoggerLevel } from "@fourze/core";
import { createFourzeServer } from "@fourze/server";
import axios from "axios";
import { describe, expect, it } from "vitest";

describe("data", async () => {
  it("mock-data", async () => {
    const testData = {
      name: "test",
      count: randomInt(200),
    };
    setLoggerLevel("debug");

    const server = createFourzeServer({
      host: "localhost",
      port: 7609,
    });

    const router = createRouter({
      delay: "200-500",
      external: ["http://localhost:7609"],
    })
      .route("/hello-1", "get", { name: String }, (req) => {
        return {
          name: req.data.name,
        };
      })
      .route("/hello-2", "get", () => {
        return testData;
      })
      .route("GET /hello-3", { test: String }, () => {
        return testData;
      })
      .post(
        "/hello",
        {
          name: {
            type: String,
            required: true,
            in: "body",
          },
        },
        (req) => {
          return {
            name: req.body.name,
          };
        }
      );


    await server.use(router).listen();

    const { name } = await axios
      .post<typeof testData>("http://localhost:7609/hello", testData)
      .then((r) => r.data);

    expect(name).toEqual(testData.name);
  });
});
