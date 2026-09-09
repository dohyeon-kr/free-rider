const test = require('node:test');
const assert = require('node:assert/strict');
const parser = import('../src/modules/curl/index.mjs');
test('browser cURL preserves multiline JSON, headers and exact query bytes', async () => {
  const { parseCurl } = await parser;
  const r = parseCurl(`curl 'https://example.com/api?a=1&a=2&empty=&x=%20' \\\n -H 'Authorization: Bearer secret' \\\n -H 'Content-Type: application/json' --data-raw '{"message":"hello world"}' --compressed`);
  assert.equal(r.method, 'POST'); assert.equal(r.body, '{"message":"hello world"}');
  assert.equal(r.url, 'https://example.com/api?a=1&a=2&empty=&x=%20');
  assert.equal(r.headers[0].value, 'Bearer secret'); assert.equal(r.bodyType, 'json');
  assert.deepEqual(r.authConfig, { type: 'none' });
});
test('attached flags, basic auth, JSON defaults and GET data', async () => {
  const { parseCurl } = await parser;
  const r = parseCurl(`curl --url=https://example.com -XPATCH -u'user:pass:word' --json '{"x":1}'`);
  assert.equal(r.method, 'PATCH'); assert.equal(r.authConfig.password, 'pass:word');
  assert.equal(r.headers[0].value, 'application/json');
  const g = parseCurl(`curl https://example.com/?a=1 -G --data-urlencode 'q=hello world'`);
  assert.equal(g.method, 'GET'); assert.equal(g.body, '');
  assert.equal(g.url, 'https://example.com/?a=1&q=hello%20world');
});
test('bad or unsupported imports fail without modifying request data', async () => {
  const { parseCurl, isCurl } = await parser;
  assert.equal(isCurl('https://example.com'), false);
  for (const command of ["curl 'https://example.com", 'curl https://example.com -H',
    'curl https://example.com --data @secret', 'curl https://example.com -F a=b',
    'curl https://example.com ; touch x', 'curl https://example.com https://other.com',
    'curl https://example.com --insecure', 'curl https://example.com -X GET -d a=b'])
    assert.throws(() => parseCurl(command));
});
test('quoted apostrophes and shell-looking body remain literal', async () => {
  const { parseCurl } = await parser;
  const r = parseCurl(`curl https://example.com --data-raw 'it'\\''s $(whoami)'`);
  assert.equal(r.body, "it's $(whoami)");
});
