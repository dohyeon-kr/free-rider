const path = require("node:path");
const { spawnSync } = require("node:child_process");

const UPDATE_BASE = "https://github.com/dohyeon-kr/free-rider/releases/latest/download";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

function feedUrlForArch(arch) {
  if (!['arm64', 'x64'].includes(arch)) throw Error(`Unsupported update architecture: ${arch}`);
  return `${UPDATE_BASE}/update-${arch}.json`;
}

function macAppBundle(execPath) {
  return path.resolve(path.dirname(execPath), "../..");
}

function isDeveloperIdSigned(execPath, run = spawnSync) {
  try {
    const result = run(
      "/usr/bin/codesign",
      ["-dv", "--verbose=4", macAppBundle(execPath)],
      { encoding: "utf8" },
    );
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    return result.status === 0 && /Authority=Developer ID Application:/i.test(output);
  } catch {
    return false;
  }
}

function createUpdateController({
  app,
  autoUpdater,
  getWindow,
  hasDirtyChanges,
  smokeTest = false,
  platform = process.platform,
  arch = process.arch,
  execPath = process.execPath,
  signedCheck = isDeveloperIdSigned,
  setTimer = setTimeout,
  setRepeatingTimer = setInterval,
}) {
  let initialized = false;
  let checking = false;
  const state = {
    enabled: false,
    state: "disabled",
    currentVersion: app.getVersion(),
    availableVersion: null,
    feedUrl: null,
    reason: null,
    error: null,
  };

  function snapshot() {
    return { ...state };
  }

  function broadcast() {
    const win = getWindow?.();
    if (win && !win.isDestroyed?.()) win.webContents?.send("update-status", snapshot());
  }

  function setState(next) {
    Object.assign(state, next);
    broadcast();
  }

  function disable(reason) {
    setState({ enabled: false, state: "disabled", reason, error: null });
  }

  function check() {
    if (!state.enabled || checking) return snapshot();
    checking = true;
    setState({ state: "checking", error: null });
    try {
      autoUpdater.checkForUpdates();
    } catch (error) {
      checking = false;
      setState({ state: "error", error: error.message || String(error) });
    }
    return snapshot();
  }

  function install() {
    if (!state.enabled) throw Error("자동 업데이트를 사용할 수 없습니다.");
    if (state.state !== "ready") throw Error("설치할 업데이트가 아직 준비되지 않았습니다.");
    if (hasDirtyChanges?.()) throw Error("업데이트 전에 워크스페이스를 저장하세요.");
    setState({ state: "installing" });
    setImmediate(() => autoUpdater.quitAndInstall());
    return true;
  }

  function init() {
    if (initialized) return snapshot();
    initialized = true;

    if (smokeTest || !app.isPackaged) {
      disable("development");
      return snapshot();
    }
    if (platform !== "darwin") {
      disable("unsupported-platform");
      return snapshot();
    }
    if (!['arm64', 'x64'].includes(arch)) {
      disable("unsupported-architecture");
      return snapshot();
    }
    if (!signedCheck(execPath)) {
      disable("developer-id-required");
      return snapshot();
    }

    const feedUrl = feedUrlForArch(arch);
    autoUpdater.setFeedURL({ url: feedUrl, serverType: "json" });
    state.enabled = true;
    state.state = "idle";
    state.feedUrl = feedUrl;
    state.reason = null;

    autoUpdater.on("checking-for-update", () => {
      checking = true;
      setState({ state: "checking", error: null });
    });
    autoUpdater.on("update-available", (_event, releaseNotes, releaseName) => {
      setState({
        state: "downloading",
        availableVersion: releaseName || null,
        releaseNotes: typeof releaseNotes === "string" ? releaseNotes : null,
      });
    });
    autoUpdater.on("update-not-available", () => {
      checking = false;
      setState({ state: "up-to-date", availableVersion: null, error: null });
    });
    autoUpdater.on("update-downloaded", (_event, releaseNotes, releaseName) => {
      checking = false;
      setState({
        state: "ready",
        availableVersion: releaseName || state.availableVersion,
        releaseNotes: typeof releaseNotes === "string" ? releaseNotes : state.releaseNotes,
        error: null,
      });
    });
    autoUpdater.on("error", (error) => {
      checking = false;
      setState({ state: "error", error: error?.message || String(error) });
    });

    broadcast();
    setTimer(check, 5000);
    setRepeatingTimer(check, CHECK_INTERVAL);
    return snapshot();
  }

  return { init, check, install, getState: snapshot };
}

module.exports = {
  CHECK_INTERVAL,
  createUpdateController,
  feedUrlForArch,
  isDeveloperIdSigned,
  macAppBundle,
};
