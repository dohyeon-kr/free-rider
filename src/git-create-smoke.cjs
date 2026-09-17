const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

// Runs only against smoke.cjs's disposable native-dialog fixture directory.
async function run({ js, poll, win, gitPath }) {
  const folderName = "새 API collection";
  const target = path.join(gitPath, folderName);
  async function screenshot(name) {
    await js("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))");
    await new Promise(resolve => setTimeout(resolve, 250));
    await fs.writeFile(path.join("test-results", name + ".png"), (await win.webContents.capturePage()).toPNG());
  }
  async function openForm() {
    await js(`document.querySelector('#gitButton').click(); document.querySelector('#gitCreateRepository').click(); document.querySelector('#gitCreateChooseParent').click()`);
    await poll(() => js(`!!document.querySelector('#gitCreateParent')?.value && !document.querySelector('#dialogConfirm').disabled`));
    // executeJavaScript shares the page's global lexical scope between calls.
    await js(`{ const input=document.querySelector('#gitCreateFolderName'); input.value=${JSON.stringify(folderName)}; input.dispatchEvent(new Event('input',{bubbles:true})); }`);
  }
  await openForm();
  assert.equal(await js(`document.querySelector('#gitCreatePreview').textContent`), target);
  await screenshot("git-create-dialog");
  // Verify the same reversible Enter-to-confirm path used by the other input modals.
  await js(`document.querySelector('#gitCreateFolderName').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}))`);
  await poll(() => js(`!document.querySelector('#dialog').open`));
  assert.equal((await fs.stat(path.join(target, ".git"))).isDirectory(), true);
  assert.deepEqual(await fs.readdir(target), [".git"]);
  assert.equal(await js(`document.querySelector('[data-view=git]').textContent.includes(${JSON.stringify(target)})`), true);
  assert.equal(await js(`document.querySelector('[data-view=git]').textContent.includes('Branch: main')`), true);

  await openForm();
  await js(`document.querySelector('#dialogConfirm').click()`);
  await poll(() => js(`document.querySelector('#gitCreateError')?.textContent.includes('이미 존재')`));
  assert.equal(await js(`document.querySelector('#dialog').open`), true);
  assert.equal(await js(`document.querySelector('#gitCreateFolderName').value`), folderName);
  assert.deepEqual(await fs.readdir(target), [".git"]);
  await screenshot("git-create-duplicate");
  await js(`document.querySelector('#dialog').close()`);
  await screenshot("git-created");
}
module.exports = { run };
