import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, createDemoClient } from './client.mjs';

const setup = (options = {}) => {
  const client = createDemoClient({ delay: 0, ...options });
  const workspace = createWorkspace();
  const collection = workspace.collections[0];
  const environment = collection.environments[0];
  const send = (id, changes = {}) => client.send(
    { ...structuredClone(collection.requests.find(r => r.id === id)), ...changes },
    environment, collection,
  );
  return { client, workspace, collection, environment, send };
};

test('initial workspace opens the real request renderer with three linked sample requests', () => {
  const state = createWorkspace();
  assert.equal(state.collections.length, 1);
  assert.deepEqual(state.collections[0].requests.map(r => r.id), ['login', 'profile', 'orders']);
  assert.equal(state.activeTab, 'demo-store|request|login');
  assert.equal(state.tabs.length, 3);
});

test('workspace reads and saves are cloned and reset in a new session', async () => {
  const { client } = setup();
  const first = await client['workspace-load']();
  first.collections[0].title = 'Edited';
  assert.notEqual((await client['workspace-load']()).collections[0].title, 'Edited');
  await client['workspace-save'](first);
  first.collections[0].title = 'Mutated after save';
  assert.equal((await client['workspace-load']()).collections[0].title, 'Edited');
  assert.notEqual((await createDemoClient()['workspace-load']()).collections[0].title, 'Edited');
});

test('login echoes edited JSON and captures a clearly fake token for the next request', async () => {
  const { send } = setup();
  const login = await send('login', { body: JSON.stringify({ email: 'edited@example.test', password: 'demo' }) });
  assert.equal(login.status, 200);
  assert.equal(JSON.parse(login.body).user.email, 'edited@example.test');
  assert.deepEqual(login.variables, ['authToken']);
  const profile = await send('profile');
  assert.equal(profile.status, 200);
  assert.equal(JSON.parse(profile.body).email, 'edited@example.test');
  assert.match(login.body, /demo-token/);
  assert.equal(login.headers['x-free-rider-demo'], 'true');
});

test('profile requires the demo login and rejects an edited invalid bearer token', async () => {
  const { send } = setup();
  assert.equal((await send('profile')).status, 401);
  await send('login');
  assert.equal((await send('profile', { authConfig: { type: 'bearer', token: 'wrong' } })).status, 401);
});

test('invalid JSON and missing login fields produce useful simulated errors', async () => {
  const { send } = setup();
  assert.equal((await send('login', { body: '{broken' })).status, 400);
  assert.equal((await send('login', { body: '{}' })).status, 422);
  assert.equal((await send('login', { body: 'null' })).status, 422);
});

test('query rows change the actual sample response and disabled rows are ignored', async () => {
  const { send } = setup();
  await send('login');
  const limited = await send('orders', { query: [{ key: 'limit', value: '1', enabled: true }] });
  assert.equal(JSON.parse(limited.body).data.length, 1);
  const filtered = await send('orders', { query: [{ key: 'status', value: 'shipped', enabled: true }] });
  assert.ok(JSON.parse(filtered.body).data.every(order => order.status === 'shipped'));
  const disabled = await send('orders', { query: [{ key: 'limit', value: '0', enabled: false }] });
  assert.equal(disabled.status, 200);
  const invalid = await send('orders', { query: [{ key: 'limit', value: '-1', enabled: true }] });
  assert.equal(invalid.status, 422);
});

test('absolute foreign URLs never receive simulated success or make real network calls', async () => {
  const { send } = setup();
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('Network must never be called'); };
  try {
    assert.equal((await send('login', { url: 'https://example.com/auth/login' })).status, 403);
    assert.equal((await send('login', { url: 'file:///etc/passwd' })).status, 403);
    assert.equal((await send('login', { url: '{{baseUrl}}/unknown' })).status, 404);
    assert.equal((await send('login', { method: 'DELETE' })).status, 405);
  } finally { globalThis.fetch = oldFetch; }
});

test('cancellation stops a pending login without capturing a token or emitting a response', async () => {
  const events = [];
  const { client, send } = setup({ delay: 100, onEvent: event => events.push(event) });
  const pending = send('login');
  const rejected = assert.rejects(pending, /cancel/i);
  await client.cancel();
  await rejected;
  assert.ok(events.some(event => event.type === 'cancelled'));
  assert.ok(!events.some(event => event.type === 'response'));
  assert.equal((await send('profile')).status, 401);
});

test('desktop-only operations fail explicitly rather than pretending to save to disk', async () => {
  const { client } = setup();
  await assert.rejects(client['git-commit'](), /desktop/i);
  await assert.rejects(client['import-spec'](), /desktop/i);
  await assert.rejects(client['request-file-select'](), /desktop/i);
});

test('interceptor source and arbitrary assertions are never evaluated in the browser demo', async () => {
  const { client, collection, environment } = setup();
  const request = structuredClone(collection.requests[0]);
  request.assertions = [{ expression: 'globalThis.__demoExecuted = true' }];
  globalThis.__demoExecuted = false;
  const result = await client.send(request, environment, collection,
    { enabled: true, before: 'globalThis.__demoExecuted = true' });
  assert.equal(globalThis.__demoExecuted, false);
  assert.deepEqual(result.tests, []);
  assert.match(result.logs.join(' '), /not executed/i);
  delete globalThis.__demoExecuted;
});

test('response messages do not send bodies, credentials, or runtime tokens to the parent', async () => {
  const events = [];
  const { send } = setup({ onEvent: event => events.push(event) });
  await send('login', { body: '{"email":"private@example.test","password":"private-pass"}' });
  assert.match(JSON.stringify(events), /response/);
  assert.doesNotMatch(JSON.stringify(events), /private-pass|private@example|demo-token/);
});
