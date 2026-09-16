const { test } = require("node:test");
const assert = require("node:assert/strict");
const { operations } = require("../src/modules/sync/index.cjs");

test("OpenAPI multipart request bodies create file-ready fields without a fixed content type", () => {
  const [request] = operations({
    openapi: "3.1.0",
    info: { title: "Upload" },
    paths: {
      "/upload": {
        post: {
          requestBody: {
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: {
                    caption: { type: "string", default: "hello" },
                    file: { type: "string", format: "binary" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  assert.equal(request.bodyType, "multipart");
  assert.equal(request.headers["Content-Type"], undefined);
  const body = JSON.parse(request.body);
  assert.equal(body.__freeRiderMultipart, 1);
  assert.deepEqual(
    body.parts.map(({ kind, key }) => ({ kind, key })),
    [
      { kind: "text", key: "caption" },
      { kind: "file", key: "file" },
    ],
  );
});
