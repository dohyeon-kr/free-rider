const test = require('node:test');
const assert = require('node:assert/strict');

class Element {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase(); this.document = document; this.children = [];
    this.listeners = {}; this.attributes = {}; this.disabled = false;
    this.value = ''; this.textContent = ''; this.className = ''; this.isConnected = true;
  }
  setAttribute(key, value) {
    this.attributes[key] = value;
    if (key === 'id') this.document.nodes.set(value, this);
  }
  append(...children) { this.children.push(...children); }
  addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
  async fire(name) { for (const fn of this.listeners[name] || []) await fn({ target: this, preventDefault() {} }); }
  focus() { this.document.focused = this; }
  querySelectorAll(selector) {
    const tags = selector.split(',').map(x => x.trim().toUpperCase());
    return this.children.flatMap(c => typeof c === 'string' ? [] : [
      ...(tags.includes(c.tagName) ? [c] : []), ...c.querySelectorAll(selector),
    ]);
  }
}
async function setup(api) {
  const document = {
    nodes: new Map(), createElement(tag) { return new Element(tag, this); },
    getElementById(id) { return this.nodes.get(id); },
  };
  global.document = document;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('id', 'dialog');
  const confirm = document.createElement('button');
  confirm.setAttribute('id', 'dialogConfirm');
  dialog.append(confirm);
  let submit, content, created, message;
  const { createGitRepositoryDialog } = await import('../src/ui/git-create.js');
  createGitRepositoryDialog({
    collectionId: 'c1', api,
    modal(title, body, callback, label) {
      assert.equal(title, '새 Git 저장소 만들기');
      content = body; submit = callback; confirm.textContent = label; dialog.append(body);
    },
    onCreated(info) { created = info; }, status(text) { message = text; },
  });
  return { document, confirm, submit, content, created: () => created, message: () => message,
    get: id => document.getElementById(id),
    async name(value) { const input = document.getElementById('gitCreateFolderName'); input.value = value; await input.fire('input'); },
  };
}

test('empty form stays open and asks for a parent selection', async () => {
  const form = await setup({});
  assert.equal(await form.submit(), false);
  assert.match(form.get('gitCreateError').textContent, /상위 폴더/);
  assert.equal(form.confirm.textContent, 'Create');
});

test('parent cancel creates nothing; success previews the path and connects the result', async () => {
  let canceled = true;
  let args;
  const form = await setup({
    'git-create-parent': async () => canceled ? null : { path: '/work', separator: '/' },
    'git-create': async (...values) => { args = values; return { root: '/work/내 API', branch: 'main' }; },
  });
  await form.get('gitCreateChooseParent').fire('click');
  assert.equal(form.get('gitCreateParent').value, '');
  canceled = false;
  await form.get('gitCreateChooseParent').fire('click');
  await form.name('내 API');
  assert.equal(form.get('gitCreatePreview').textContent, '/work/내 API');
  assert.equal(await form.submit(), true);
  assert.deepEqual(args, ['c1', '내 API']);
  assert.equal(form.created().root, '/work/내 API');
  assert.match(form.message(), /생성/);
});

test('creation errors remain inline and preserve entered values for retry', async () => {
  const form = await setup({
    'git-create-parent': async () => ({ path: 'C:\\work', separator: '\\' }),
    'git-create': async () => { throw Error('같은 이름의 폴더가 이미 존재합니다.'); },
  });
  await form.get('gitCreateChooseParent').fire('click');
  await form.name('api');
  assert.equal(form.get('gitCreatePreview').textContent, 'C:\\work\\api');
  assert.equal(await form.submit(), false);
  assert.match(form.get('gitCreateError').textContent, /이미 존재/);
  assert.equal(form.get('gitCreateFolderName').value, 'api');
  assert.equal(form.confirm.disabled, false);
  assert.equal(form.created(), undefined);
});

test('busy state blocks duplicate submits until the operation completes', async () => {
  let resolve, calls = 0;
  const form = await setup({
    'git-create-parent': async () => ({ path: '/', separator: '/' }),
    'git-create': async () => { calls++; return new Promise(r => { resolve = r; }); },
  });
  await form.get('gitCreateChooseParent').fire('click');
  await form.name('api');
  assert.equal(form.get('gitCreatePreview').textContent, '/api');
  const first = form.submit();
  assert.equal(form.confirm.disabled, true);
  assert.equal(await form.submit(), false);
  resolve({ root: '/api', branch: 'main' });
  assert.equal(await first, true);
  assert.equal(calls, 1);
  assert.equal(form.confirm.disabled, false);
});
