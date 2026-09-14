const api = window.client;
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const allTabs = () => [...document.querySelectorAll("#workTabs .work-tab")];

function waitFor(predicate, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started > timeout) return reject(new Error("작업이 완료되지 않았습니다."));
      setTimeout(tick, 40);
    };
    tick();
  });
}

function setStatus(text) {
  if ($("status")) $("status").textContent = text;
}

async function saveWorkspace() {
  const button = $("saveWorkspace");
  if (!button) throw new Error("저장 버튼을 찾을 수 없습니다.");
  button.click();
  await sleep(50);
  await waitFor(
    () => !document.querySelector(".workspace")?.inert && $("status")?.textContent.includes("워크스페이스를 저장했습니다."),
  );
}

function requestHasUnsavedChanges(tab) {
  return !!tab.querySelector(".method") && !!tab.querySelector(".dirty-dot");
}

function tabIndexes(tabs) {
  const current = allTabs();
  return tabs.map((tab) => current.indexOf(tab)).filter((index) => index >= 0);
}

function tabsAt(indexes) {
  const current = allTabs();
  return indexes.map((index) => current[index]).filter(Boolean);
}

async function forceDiscardAndClose(tab) {
  if (!tab?.isConnected) return;
  tab.querySelector(".close")?.click();
  await sleep(0);
  if ($("dialog")?.open && $("discardRequest")) $("discardRequest").click();
  await waitFor(() => !tab.isConnected, 1500);
}

async function closeTabs(tabs, { discard = false } = {}) {
  for (const tab of tabs) {
    if (!tab?.isConnected) continue;
    if (discard && requestHasUnsavedChanges(tab)) await forceDiscardAndClose(tab);
    else {
      tab.querySelector(".close")?.click();
      await waitFor(() => !tab.isConnected || $("dialog")?.open, 1500);
      if ($("dialog")?.open) return;
    }
  }
}

function showBatchCloseDialog(tabs, title) {
  const indexes = tabIndexes(tabs);
  const dirtyCount = tabs.filter(requestHasUnsavedChanges).length;
  if (!dirtyCount) return closeTabs(tabs);

  const dialog = $("dialog");
  if (dialog.open) dialog.close();
  $("dialogTitle").textContent = title;
  const content = document.createElement("div");
  const description = document.createElement("p");
  description.textContent = `저장하지 않은 요청 탭이 ${dirtyCount}개 있습니다.`;
  const hint = document.createElement("p");
  hint.className = "muted";
  hint.textContent = "저장하고 닫거나, 변경 내용을 버리고 닫을 수 있습니다.";
  const discard = document.createElement("button");
  discard.type = "button";
  discard.className = "danger";
  discard.textContent = "변경 버리고 닫기";
  discard.onclick = async () => {
    dialog.close();
    await closeTabs(tabsAt(indexes), { discard: true });
  };
  content.append(description, hint, discard);
  $("dialogContent").replaceChildren(content);
  $("dialogConfirm").textContent = "모두 저장하고 닫기";
  $("dialogConfirm").onclick = async () => {
    try {
      await saveWorkspace();
      dialog.close();
      await closeTabs(tabsAt(indexes));
    } catch (error) {
      setStatus(error.message);
    }
  };
  dialog.showModal();
}

function createTabMenu() {
  const menu = document.createElement("div");
  menu.id = "tabContextMenu";
  menu.className = "tab-context-menu";
  menu.hidden = true;
  document.body.append(menu);
  return menu;
}

function menuButton(label, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.onclick = () => {
    handler();
    hideTabMenu();
  };
  return button;
}

const tabMenu = createTabMenu();

function hideTabMenu() {
  tabMenu.hidden = true;
}

function openTabMenu(event, tab) {
  event.preventDefault();
  tabMenu.replaceChildren(
    menuButton("닫기", () => tab.querySelector(".close")?.click()),
    menuButton("다른 탭 닫기", () => {
      const targets = allTabs().filter((item) => item !== tab);
      showBatchCloseDialog(targets, "다른 탭 닫기");
    }),
    menuButton("저장된 탭 닫기", () => {
      const targets = allTabs().filter((item) => !requestHasUnsavedChanges(item));
      closeTabs(targets);
    }),
    menuButton("모든 탭 닫기", () => showBatchCloseDialog(allTabs(), "모든 탭 닫기")),
  );
  tabMenu.hidden = false;
  const margin = 8;
  const rect = tabMenu.getBoundingClientRect();
  tabMenu.style.left = Math.min(event.clientX, window.innerWidth - rect.width - margin) + "px";
  tabMenu.style.top = Math.min(event.clientY, window.innerHeight - rect.height - margin) + "px";
}

function installTabMenu() {
  $("workTabs")?.addEventListener("contextmenu", (event) => {
    const tab = event.target.closest(".work-tab");
    if (tab) openTabMenu(event, tab);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!tabMenu.hidden && !tabMenu.contains(event.target)) hideTabMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTabMenu();
  });
  window.addEventListener("blur", hideTabMenu);
  window.addEventListener("resize", hideTabMenu);
}

function isCollectionActionsDialog() {
  const labels = [...$("dialogContent")?.querySelectorAll(".actions > button") || []].map((button) => button.textContent);
  return ["New Request", "New Folder", "Rename", "OpenAPI", "Run Collection", "Export Collection"].every((label) => labels.includes(label));
}

async function deleteCurrentCollection(title) {
  try {
    await saveWorkspace();
    const snapshot = await api["workspace-load"]();
    if (!snapshot?.collections?.length) throw new Error("워크스페이스를 불러오지 못했습니다.");
    if (snapshot.collections.length === 1) throw new Error("마지막 컬렉션은 삭제할 수 없습니다.");

    const cid = snapshot.activeCollection;
    const target = snapshot.collections.find((collection) => collection.id === cid);
    if (!target) throw new Error("삭제할 컬렉션을 찾을 수 없습니다.");

    snapshot.collections = snapshot.collections.filter((collection) => collection.id !== cid);
    snapshot.tabs = (snapshot.tabs || []).filter((tab) => tab.cid !== cid);
    delete snapshot.selectedEnvironments?.[cid];
    snapshot.collapsed = (snapshot.collapsed || []).filter((value) => value !== cid && !String(value).startsWith(cid + ":"));

    if (snapshot.activeCollection === cid) snapshot.activeCollection = snapshot.collections[0].id;
    if (!snapshot.tabs.some((tab) => `${tab.cid}|${tab.kind}|${tab.id || ""}` === snapshot.activeTab)) snapshot.activeTab = null;

    await api["workspace-save"](snapshot);
    await api["set-dirty"](false);
    setStatus(`${title} 컬렉션을 삭제했습니다.`);
    location.reload();
  } catch (error) {
    setStatus(error.message);
  }
}

function appendCollectionDelete() {
  if (!$("dialog")?.open || !isCollectionActionsDialog()) return;
  const actions = $("dialogContent").querySelector(".actions");
  if (!actions || actions.querySelector("[data-delete-collection]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "danger";
  button.dataset.deleteCollection = "true";
  button.textContent = "Delete Collection";
  button.onclick = () => {
    const title = $("dialogTitle").textContent;
    const dialog = $("dialog");
    $("dialogTitle").textContent = "컬렉션 삭제";
    const content = document.createElement("div");
    const warning = document.createElement("p");
    warning.textContent = `${title} 컬렉션과 컬렉션에 포함된 요청을 삭제할까요?`;
    const hint = document.createElement("p");
    hint.className = "muted";
    hint.textContent = "이 작업은 현재 로컬 워크스페이스에서 컬렉션 전체를 제거합니다.";
    content.append(warning, hint);
    $("dialogContent").replaceChildren(content);
    $("dialogConfirm").textContent = "삭제";
    $("dialogConfirm").onclick = async () => {
      dialog.close();
      await deleteCurrentCollection(title);
    };
  };
  actions.append(button);
}

function installCollectionDelete() {
  const observer = new MutationObserver(appendCollectionDelete);
  observer.observe($("dialog"), { childList: true, subtree: true, characterData: true });
}

while (!window.appReady) await sleep(0);
await window.appReady;
installTabMenu();
installCollectionDelete();
