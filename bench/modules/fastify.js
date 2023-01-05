import fastify from "fastify";
const app = fastify();

const schema = {
  schema: {
    response: {
      200: {
        type: "object",
        properties: {
          hello: {
            type: "string"
          }
        }
      }
    }
  }
};

app.get("/", schema, (req, reply) => {
  reply.send({ hello: "world" });
});

app.listen({ port: 3000 });
