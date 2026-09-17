const api = window.client;
const button = document.getElementById("announcementButton");
const panel = document.getElementById("announcementPanel");
const unread = document.getElementById("announcementUnread");
const STORAGE_KEY = "free-rider:announcements:last-seen";
const ANNOUNCEMENTS_PAGE =
  "https://github.com/dohyeon-kr/free-rider/discussions/categories/announcements";
let items = [];

function lastSeen() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function rememberLatest() {
  if (!items[0]?.id) return;
  try {
    localStorage.setItem(STORAGE_KEY, items[0].id);
  } catch {}
  renderUnread();
}

function renderUnread() {
  if (!unread) return;
  unread.hidden = !items[0]?.id || items[0].id === lastSeen();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function message(text) {
  const state = document.createElement("p");
  state.className = "announcement-state";
  state.textContent = text;
  return state;
}

function renderPanel() {
  if (!panel) return;
  panel.replaceChildren();

  const header = document.createElement("div");
  header.className = "announcement-header";
  const title = document.createElement("strong");
  title.textContent = "공지";
  const all = document.createElement("button");
  all.type = "button";
  all.textContent = "GitHub에서 전체 보기 ↗";
  all.addEventListener("click", () => api["announcement-open"](ANNOUNCEMENTS_PAGE));
  header.append(title, all);
  panel.append(header);

  const list = document.createElement("div");
  list.className = "announcement-list";
  if (!items.length) {
    list.append(message("아직 등록된 공지가 없습니다."));
  } else {
    for (const item of items) {
      const entry = document.createElement("button");
      entry.type = "button";
      entry.className = "announcement-item";
      const heading = document.createElement("span");
      heading.className = "announcement-title";
      heading.textContent = item.title;
      const date = document.createElement("span");
      date.className = "announcement-date";
      date.textContent = formatDate(item.publishedAt);
      entry.append(heading, date);
      if (item.excerpt) {
        const excerpt = document.createElement("span");
        excerpt.className = "announcement-excerpt";
        excerpt.textContent = item.excerpt;
        entry.append(excerpt);
      }
      entry.addEventListener("click", () => api["announcement-open"](item.url));
      list.append(entry);
    }
  }
  panel.append(list);
}

async function load({ markRead = false, showLoading = false } = {}) {
  if (!button || !panel) return;
  if (showLoading) {
    panel.replaceChildren(message("공지를 불러오는 중…"));
  }
  try {
    items = await api["announcement-list"]();
    renderPanel();
    renderUnread();
    if (markRead) rememberLatest();
    button.title = items[0]?.title ? `최근 공지: ${items[0].title}` : "공지";
  } catch (error) {
    if (panel.matches(":popover-open")) {
      panel.replaceChildren(message("공지를 불러오지 못했습니다. 다시 열어 시도하세요."));
    }
    button.title = error?.message || "공지를 불러오지 못했습니다.";
  }
}

panel?.addEventListener("toggle", (event) => {
  if (event.newState === "open") load({ markRead: true, showLoading: !items.length });
});

load().catch(() => {});
