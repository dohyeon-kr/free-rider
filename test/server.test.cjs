const test = require("node:test");
const assert = require("node:assert/strict");
const {serverUrl} = require("../src/modules/sync/server.cjs");
test("spec server suggestions resolve relative addresses and variable defaults", () => {
  assert.equal(serverUrl({url:"/api/v3"},"https://petstore3.swagger.io/api/v3/openapi.json"),"https://petstore3.swagger.io/api/v3");
  assert.equal(serverUrl({url:"https://{host}/v1",variables:{host:{default:"example.com"}}}),"https://example.com/v1");
  assert.equal(serverUrl({url:"/api/v3"}),"");
  assert.equal(serverUrl({url:"file:///tmp/test"}),"");
  assert.equal(serverUrl(undefined),"");
});
