const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createUpdateController,
  feedUrlFor,
  macAppBundle,
} = require("../src/modules/update/index.cjs");

test("update feed targets the public Electron service per architecture", () => {
  assert.equal(
    feedUrlFor("darwin", "arm64", "0.2.2"),
    "https://update.electronjs.org/dohyeon-kr/free-rider/darwin-arm64/0.2.2",
  );
  assert.equal(
    feedUrlFor("darwin", "x64", "0.2.2"),
    "https://update.electronjs.org/dohyeon-kr/free-rider/darwin-x64/0.2.2",
  );
  assert.throws(() => feedUrlFor("linux", "x64", "0.2.2"), /Unsupported update platform/);
  assert.throws(() => feedUrlFor("darwin", "ia32", "0.2.2"), /Unsupported update architecture/);
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

test("signed mac build configures public feed and can check", () => {
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
    url: "https://update.electronjs.org/dohyeon-kr/free-rider/darwin-arm64/0.2.2",
  }]);

  controller.check();
  assert.deepEqual(calls.at(-1), ["check"]);
  events.get("update-not-available")();
  assert.equal(controller.getState().state, "up-to-date");
});
