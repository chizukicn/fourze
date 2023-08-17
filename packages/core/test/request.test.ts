import { expect, test } from "vitest";
import { createRequest } from "../src/shared/request";

test("query", () => {
  const request = createRequest({
    url: "/api/test?name=hello&age=18&male=true",
    method:"POST",
    body:"mobile=123&email=abc%40efg.com",
    headers:{
      "content-type":"application/x-www-form-urlencoded"
    }
  });
  expect(request.query).toEqual({
    name: "hello",
    age: "18",
    male: "true"
  });
  expect(request.body).toEqual({
    mobile: "123",
    email: "abc@efg.com"
  })
});
