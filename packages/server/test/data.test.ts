import { defineRouter, randomInt, setLoggerLevel } from "@fourze/core";
import { createServer } from "@fourze/server";
import axios from "axios";
import { expect, it } from "vitest";

it("mock-data", async () => {
  const testData = {
    name: "test",
    count: randomInt(200)
  };
  setLoggerLevel("debug");

  const server = createServer({
    host: "localhost",
    port: 0
  });

  const router = defineRouter({})
    .route("/hello-1", "get", {
      props: {
        name: String
      }
    }, (req) => {
      return {
        name: req.data.name
      };
    })
    .route("/hello-2", "get", () => {
      return testData;
    })
    .route("GET /hello-3", {
      props: {
        test: String
      }
    }, () => {
      return testData;
    })
    .post(
      "/hello",
      {
        props: {
          name: {
            type: String,
            required: true,
            in: "body"
          }
        }
      },
      (req) => {
        return {
          name: req.body.name
        };
      }
    )
    .get("/avatar.jpg", (req, res) => {
      res.image(Buffer.from([0, 0, 0, 0]));
    });

  server.use(router);

  await server.listen();

  const axiosInstance = axios.create({
    baseURL: server.origin
  });

  const { name } = await axiosInstance
    .post<typeof testData>("/hello", testData)
    .then((r) => r.data);

  expect(name).toEqual(testData.name);

  const contentType = await axiosInstance("/avatar.jpg").then((r) => r.headers["content-type"]);
  expect(contentType).toEqual("image/jpeg");
});
