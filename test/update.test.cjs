const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createUpdateController,
  feedUrlForArch,
  macAppBundle,
} = require("../src/modules/update/index.cjs");

test("update feeds are architecture-specific GitHub release assets", () => {
  assert.equal(
    feedUrlForArch("arm64"),
    "https://github.com/dohyeon-kr/free-rider/releases/latest/download/update-arm64.json",
  );
  assert.equal(
    feedUrlForArch("x64"),
    "https://github.com/dohyeon-kr/free-rider/releases/latest/download/update-x64.json",
  );
  assert.throws(() => feedUrlForArch("ia32"), /Unsupported update architecture/);
});

test("mac app bundle path is derived from packaged executable", () => {
  assert.equal(
    macAppBundle("/Applications/Free Rider.app/Contents/MacOS/Free Rider"),
    "/Applications/Free Rider.app",
  );
});

test("development and ad-hoc builds do not enable auto update", () => {
  const updater = {
    on() {},
    setFeedURL() { throw Error("should not configure feed"); },
    checkForUpdates() { throw Error("should not check"); },
    quitAndInstall() {},
  };
  const app = { getVersion: () => "0.2.2", isPackaged: false };
  const dev = createUpdateController({
    app,
    autoUpdater: updater,
    getWindow: () => null,
  });
  assert.equal(dev.init().reason, "development");

  app.isPackaged = true;
  const adhoc = createUpdateController({
    app,
    autoUpdater: updater,
    getWindow: () => null,
    platform: "darwin",
    arch: "arm64",
    signedCheck: () => false,
  });
  assert.equal(adhoc.init().reason, "developer-id-required");
});

test("signed mac build configures static JSON feed and can check", () => {
  const events = new Map();
  const calls = [];
  const updater = {
    on(name, fn) { events.set(name, fn); },
    setFeedURL(value) { calls.push(["feed", value]); },
    checkForUpdates() { calls.push(["check"]); },
    quitAndInstall() { calls.push(["install"]); },
  };
  const controller = createUpdateController({
    app: { getVersion: () => "0.2.2", isPackaged: true },
    autoUpdater: updater,
    getWindow: () => null,
    platform: "darwin",
    arch: "arm64",
    signedCheck: () => true,
    setTimer: () => 0,
    setRepeatingTimer: () => 0,
  });

  const initial = controller.init();
  assert.equal(initial.enabled, true);
  assert.equal(initial.state, "idle");
  assert.deepEqual(calls[0], ["feed", {
    url: "https://github.com/dohyeon-kr/free-rider/releases/latest/download/update-arm64.json",
    serverType: "json",
  }]);

  controller.check();
  assert.deepEqual(calls.at(-1), ["check"]);
  events.get("update-not-available")();
  assert.equal(controller.getState().state, "up-to-date");
});
