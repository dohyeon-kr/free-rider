const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const script = fs.readFileSync(path.join(__dirname, "../src/ui/update-ui.js"), "utf8");

function createRenderer() {
  const button = {
    dataset: {},
    hidden: false,
    disabled: false,
    textContent: "",
    title: "",
    addEventListener(event, listener) { this[event] = listener; },
  };
  const version = { textContent: "" };
  let listener;
  let resolveSnapshot;
  const snapshot = new Promise(resolve => { resolveSnapshot = resolve; });
  vm.runInNewContext(script, {
    document: {
      getElementById: id => ({
        updateButton: button,
        appVersion: version,
      })[id] || null,
    },
    window: {
      client: {
        onUpdateStatus(callback) { listener = callback; },
        "update-state"() { return snapshot; },
      },
    },
  });
  return {button,version,emit: value => listener(value),resolveSnapshot};
}

test("first-load update state enables the button without relaunch", async () => {
  const ui = createRenderer();
  ui.resolveSnapshot({enabled:true,state:"idle",currentVersion:"0.32.0"});
  await new Promise(setImmediate);
  assert.equal(ui.button.disabled,false);
  assert.equal(ui.button.textContent,"업데이트 확인");
  assert.equal(ui.version.textContent,"v0.32.0");
});

test("outdated initializing snapshot cannot override a newer updater event", async () => {
  const ui = createRenderer();
  ui.emit({enabled:true,state:"idle",currentVersion:"0.32.0"});
  ui.resolveSnapshot({enabled:false,state:"disabled",reason:"initializing",currentVersion:"0.32.0"});
  await new Promise(setImmediate);
  assert.equal(ui.button.disabled,false);
  assert.equal(ui.button.textContent,"업데이트 확인");
});

test("ready event is not reset by a delayed initial snapshot", async () => {
  const ui = createRenderer();
  ui.emit({enabled:true,state:"ready",availableVersion:"v0.33.0"});
  ui.resolveSnapshot({enabled:true,state:"idle"});
  await new Promise(setImmediate);
  assert.equal(ui.button.disabled,false);
  assert.equal(ui.button.textContent,"v0.33.0 설치 및 재시작");
});

test("genuinely unsigned builds remain disabled", async () => {
  const ui = createRenderer();
  ui.resolveSnapshot({enabled:false,state:"disabled",reason:"developer-id-required"});
  await new Promise(setImmediate);
  assert.equal(ui.button.disabled,true);
  assert.equal(ui.button.textContent,"자동 업데이트 · 서명 필요");
});
