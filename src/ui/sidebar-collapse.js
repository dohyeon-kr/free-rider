const COLLAPSED_WIDTH = 52;
const MIN_WIDTH = 200;
const MAX_WIDTH = 520;
const COLLAPSE_THRESHOLD = 160;
const STORAGE_KEY = "free-rider.sidebar-width";
let expandedWidth = 305;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setup() {
  const root = document.documentElement;
  const resizer = document.getElementById("sidebarResizer");
  const aside = document.querySelector("aside");
  if (!resizer || !aside) return;

  function currentWidth() {
    const value = parseFloat(getComputedStyle(root).getPropertyValue("--sidebar"));
    return Number.isFinite(value) ? value : expandedWidth;
  }

  function updateAria(width, collapsed) {
    resizer.setAttribute("aria-valuemin", String(COLLAPSED_WIDTH));
    resizer.setAttribute("aria-valuemax", String(MAX_WIDTH));
    resizer.setAttribute("aria-valuenow", String(Math.round(width)));
    resizer.setAttribute(
      "aria-valuetext",
      collapsed ? "컬렉션 사이드바 최소화" : `컬렉션 사이드바 ${Math.round(width)}px`,
    );
  }

  function applyWidth(value, persist = false) {
    const collapsed = value < COLLAPSE_THRESHOLD;
    const width = collapsed ? COLLAPSED_WIDTH : clamp(value, MIN_WIDTH, MAX_WIDTH);
    if (!collapsed) expandedWidth = width;
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    root.style.setProperty("--sidebar", `${width}px`);
    updateAria(width, collapsed);
    if (persist) localStorage.setItem(STORAGE_KEY, String(width));
  }

  function expandAndFocusSearch() {
    applyWidth(Math.max(expandedWidth, 260), true);
    requestAnimationFrame(() => document.getElementById("search")?.focus());
  }

  function proxyButton(icon, label, targetId, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = icon;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", () => {
      if (action) action();
      else document.getElementById(targetId)?.click();
    });
    return button;
  }

  if (!aside.querySelector(".sidebar-compact")) {
    const rail = document.createElement("div");
    rail.className = "sidebar-compact";
    rail.setAttribute("aria-label", "최소화된 컬렉션 사이드바");
    rail.append(
      proxyButton("⬡", "컬렉션 개요", "collectionHome"),
      proxyButton("⌕", "요청 검색", null, expandAndFocusSearch),
      proxyButton("＋", "새 컬렉션", "newCollection"),
      proxyButton("⋯", "컬렉션 작업", null, () => {
        applyWidth(Math.max(expandedWidth, 260), true);
        requestAnimationFrame(() => document.getElementById("openCollection")?.click());
      }),
    );
    const spacer = document.createElement("span");
    spacer.className = "sidebar-compact-spacer";
    rail.append(
      spacer,
      proxyButton("⌘", "전역 전후처리", "scriptsButton"),
      proxyButton("♧", "명세 연결", "specButton"),
    );
    aside.append(rail);
  }

  resizer.onpointerdown = (event) => {
    resizer.setPointerCapture(event.pointerId);
    const move = (moveEvent) => applyWidth(moveEvent.clientX);
    const up = () => {
      resizer.removeEventListener("pointermove", move);
      resizer.removeEventListener("pointerup", up);
      applyWidth(currentWidth(), true);
    };
    resizer.addEventListener("pointermove", move);
    resizer.addEventListener("pointerup", up);
  };

  resizer.onkeydown = (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const collapsed = document.body.classList.contains("sidebar-collapsed");
    if (collapsed && event.key === "ArrowRight") {
      applyWidth(Math.max(expandedWidth, 220), true);
      return;
    }
    if (event.key === "ArrowLeft" && currentWidth() <= MIN_WIDTH) {
      applyWidth(COLLAPSED_WIDTH, true);
      return;
    }
    applyWidth(
      currentWidth() + (event.key === "ArrowLeft" ? -20 : 20),
      true,
    );
  };

  resizer.ondblclick = () => {
    const collapsed = document.body.classList.contains("sidebar-collapsed");
    applyWidth(collapsed ? Math.max(expandedWidth, 260) : COLLAPSED_WIDTH, true);
  };

  const saved = Number(localStorage.getItem(STORAGE_KEY));
  if (Number.isFinite(saved) && saved > 0) {
    if (saved >= COLLAPSE_THRESHOLD)
      expandedWidth = clamp(saved, MIN_WIDTH, MAX_WIDTH);
    applyWidth(saved);
  } else {
    applyWidth(currentWidth());
  }
}

if (document.readyState === "complete") setup();
else window.addEventListener("load", setup, { once: true });
