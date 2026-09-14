import { el, input } from "./dom.js";

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "QUERY", "TRACE"];

export function methodPicker(value, onChange) {
  let activeIndex = -1;
  let ordered = [];
  const list = el("div", {
    id: "httpMethods", class: "method-options", role: "listbox",
    "aria-label": "HTTP 메서드", hidden: true,
  });
  const control = input(value, (next) => {
    onChange(next);
    open();
  }, {
    id: "httpMethod", role: "combobox", "aria-label": "HTTP 메서드",
    "aria-controls": "httpMethods", "aria-expanded": "false",
    "aria-autocomplete": "list", spellcheck: false, autocomplete: "off",
    placeholder: "메서드", onFocus: () => open(),
    onClick: () => { if (list.hidden) open(); },
    onBlur: () => close(),
    onKeydown: (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (list.hidden) open();
        activeIndex = activeIndex < 0
          ? (event.key === "ArrowDown" ? 0 : ordered.length - 1)
          : (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + ordered.length) % ordered.length;
        highlight();
      } else if (event.key === "Enter" && !list.hidden && activeIndex >= 0) {
        event.preventDefault();
        choose(ordered[activeIndex]);
      }
    },
  });
  function close() {
    list.hidden = true;
    activeIndex = -1;
    control.setAttribute("aria-expanded", "false");
    control.removeAttribute("aria-activedescendant");
  }
  function choose(method) {
    control.value = method;
    onChange(method);
    close();
  }
  function highlight() {
    Array.from(list.children).forEach((option, index) => {
      option.setAttribute("aria-selected", String(index === activeIndex));
    });
    const option = list.children[activeIndex];
    control.setAttribute("aria-activedescendant", option.id);
    option.scrollIntoView({ block: "nearest" });
  }
  function open() {
    const query = control.value.trim().toUpperCase();
    const matches = (method) => method.includes(query);
    ordered = [...methods].sort((a, b) => Number(matches(b)) - Number(matches(a)));
    activeIndex = -1;
    control.removeAttribute("aria-activedescendant");
    list.replaceChildren(...ordered.map((method) => el("div", {
      id: `http-method-${method}`, role: "option", "aria-selected": "false",
      class: "method-option" + (query ? (matches(method) ? " is-match" : " is-muted") : ""),
      text: method,
      onMousedown: (event) => event.preventDefault(),
      onClick: () => choose(method),
    })));
    list.hidden = false;
    list.scrollTop = 0;
    control.setAttribute("aria-expanded", "true");
  }
  return el("div", { class: "method-picker" }, control, list);
}
