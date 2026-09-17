const test = require('node:test');
const assert = require('node:assert/strict');

function fixture(chooseOpen, git) {
  const handlers = new Map();
  const mod = require('../src/modules/git/create-ipc.cjs');
  mod.registerGitCreation((name, fn) => handlers.set(name, fn), chooseOpen, () => git);
  return (name, ...args) => handlers.get(name)(...args);
}

test('creation requires a native parent selection, not a renderer-supplied path', async () => {
  const invoke = fixture(async () => ({ canceled: false, filePaths: ['/trusted'] }), {
    create: async (parent, name) => ({ parent, name }),
  });
  await assert.rejects(invoke('git-create', 'c1', 'repo'), /상위 폴더/);
  const parent = await invoke('git-create-parent', 'c1');
  assert.equal(parent.path, '/trusted');
  assert.deepEqual(await invoke('git-create', 'c1', 'repo', '/untrusted'), { parent: '/trusted', name: 'repo' });
  await assert.rejects(invoke('git-create', 'c1', 'another'), /상위 폴더/);
});

test('canceling directory selection creates nothing and does not replace a prior selection', async () => {
  let canceled = false;
  const invoke = fixture(async () => ({ canceled, filePaths: canceled ? [] : ['/trusted'] }), {
    create: async (parent, name) => ({ parent, name }),
  });
  await invoke('git-create-parent', 'c1');
  canceled = true;
  assert.equal(await invoke('git-create-parent', 'c1'), null);
  assert.deepEqual(await invoke('git-create', 'c1', 'repo'), { parent: '/trusted', name: 'repo' });
  assert.equal(await invoke('git-create-parent', 'c2'), null);
  await assert.rejects(invoke('git-create', 'c2', 'repo'), /상위 폴더/);
});

test('parent selection is isolated per collection and folder names are validated', async () => {
  const invoke = fixture(async () => ({ canceled: false, filePaths: ['/trusted'] }), {
    create: async () => { throw Error('must not be called'); },
  });
  await invoke('git-create-parent', 'c1');
  await assert.rejects(invoke('git-create', 'c2', 'repo'), /상위 폴더/);
  await assert.rejects(invoke('git-create', 'c1', '../escape'), /폴더명/);
  await assert.rejects(invoke('git-create-parent', {}), /컬렉션/);
});

test('duplicate submission is blocked and a failed operation can be retried', async () => {
  let finish;
  let calls = 0;
  const invoke = fixture(async () => ({ canceled: false, filePaths: ['/trusted'] }), {
    create: async () => { calls++; return new Promise((resolve, reject) => { finish = { resolve, reject }; }); },
  });
  await invoke('git-create-parent', 'c1');
  const first = invoke('git-create', 'c1', 'repo');
  await assert.rejects(invoke('git-create', 'c1', 'repo'), /진행 중/);
  await assert.rejects(invoke('git-create-parent', 'c1'), /진행 중/);
  finish.reject(Error('temporary failure'));
  await assert.rejects(first, /temporary failure/);
  const second = invoke('git-create', 'c1', 'repo');
  finish.resolve({ root: '/trusted/repo' });
  assert.deepEqual(await second, { root: '/trusted/repo' });
  assert.equal(calls, 2);
});
