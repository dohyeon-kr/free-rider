const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { GitWorkspace } = require('../src/modules/git/index.cjs');

async function fixture(t) {
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), 'free-rider-create-'));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  return { parent: await fs.realpath(parent), git: new GitWorkspace() };
}

test('creates the named folder and connects an empty main repository', async t => {
  const { parent, git } = await fixture(t);
  assert.equal(typeof git.create, 'function', 'GitWorkspace must support creating a repository');
  const info = await git.create(parent, '내 API collection');
  assert.equal(info.root, path.join(parent, '내 API collection'));
  assert.equal(info.branch, 'main');
  assert.equal(info.status, '');
  assert.deepEqual(info.commits, []);
  assert.deepEqual(await fs.readdir(info.root), ['.git']);
  assert.deepEqual(await git.status(), info);
});

test('new repository supports the existing save, diff and first commit flow', async t => {
  const { parent, git } = await fixture(t);
  await git.create(parent, 'api');
  await git.command(['config', 'user.name', 'Free Rider Test']);
  await git.command(['config', 'user.email', 'test@example.invalid']);
  const saved = await git.save({ title: 'API', requests: [] });
  assert.match(saved.status, /open-api\.collection\.json/);
  assert.match(await git.diff(), /\+.*API/);
  assert.equal((await git.commit('Initial collection')).commits[0].message, 'Initial collection');
});

test('rejects unsafe folder names without creating any paths', async t => {
  const { parent, git } = await fixture(t);
  for (const name of ['', ' ', '.', '..', '../escape', 'nested/repo', 'nested\\repo',
    '/absolute', 'C:\\absolute', '.git', '.GIT', 'NUL', 'CON.txt', 'COM1', 'LPT9',
    'trailing.', 'trailing ', ' leading', 'api\0name', 'line\nname', 'a:b', 'a?b',
    'a*b', 'a|b', 'a"b', 'a<b', 'a>b', '가'.repeat(86), null, {}, 42]) {
    await assert.rejects(git.create(parent, name), /폴더명/);
  }
  assert.deepEqual(await fs.readdir(parent), []);
});

test('does not overwrite existing directories, files or symlinks and keeps the current connection', async t => {
  const { parent, git } = await fixture(t);
  const previous = await git.create(parent, 'original');
  await fs.mkdir(path.join(parent, 'existing'));
  await fs.writeFile(path.join(parent, 'existing', 'keep.txt'), 'keep');
  await fs.writeFile(path.join(parent, 'file'), 'keep');
  await fs.symlink(path.join(parent, 'existing'), path.join(parent, 'link'), 'dir');
  await fs.symlink(path.join(parent, 'missing'), path.join(parent, 'dangling'), 'dir');
  for (const name of ['original', 'existing', 'file', 'link', 'dangling']) {
    await assert.rejects(git.create(parent, name), /이미 존재/);
  }
  assert.equal(await fs.readFile(path.join(parent, 'existing', 'keep.txt'), 'utf8'), 'keep');
  assert.equal(await fs.readFile(path.join(parent, 'file'), 'utf8'), 'keep');
  assert.deepEqual(await git.status(), previous);
});

test('requires an existing parent directory instead of creating ancestor paths', async t => {
  const { parent, git } = await fixture(t);
  await assert.rejects(git.create(path.join(parent, 'missing'), 'repo'), /상위 폴더/);
  await fs.writeFile(path.join(parent, 'file'), 'keep');
  await assert.rejects(git.create(path.join(parent, 'file'), 'repo'), /상위 폴더/);
  assert.deepEqual(await fs.readdir(parent), ['file']);
});

test('folder names are passed as arguments, never evaluated by a shell', async t => {
  const { parent, git } = await fixture(t);
  const name = 'api; touch injected';
  assert.equal((await git.create(parent, name)).root, path.join(parent, name));
  assert.deepEqual(await fs.readdir(parent), [name]);
});

test('only one competing creation succeeds and the winner remains intact', async t => {
  const { parent, git } = await fixture(t);
  const results = await Promise.allSettled([git.create(parent, 'api'), new GitWorkspace().create(parent, 'api')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal((await new GitWorkspace().open(path.join(parent, 'api'))).branch, 'main');
});

test('initialization failure removes only an empty new directory and preserves the current connection', async t => {
  const { parent, git } = await fixture(t);
  const previous = await git.create(parent, 'original');
  const oldPath = process.env.PATH;
  process.env.PATH = '';
  try { await assert.rejects(git.create(parent, 'failed'), /Git/); }
  finally { process.env.PATH = oldPath; }
  assert.deepEqual(await fs.readdir(parent), ['original']);
  assert.deepEqual(await git.status(), previous);
});

test('inherited Git path variables cannot redirect the newly created repository', async t => {
  const { parent, git } = await fixture(t);
  const names = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) process.env[name] = path.join(parent, 'untrusted');
  try {
    assert.equal((await git.create(parent, 'safe')).root, path.join(parent, 'safe'));
    assert.deepEqual(await fs.readdir(parent), ['safe']);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});
