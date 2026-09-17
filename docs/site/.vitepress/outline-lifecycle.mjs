// Compatibility fix for the pinned VitePress 1.6.4 default theme.
// Its scroll debounce and initial animation frame can run after outline refs
// have been cleared on navigation. Removing the scroll listener does not cancel
// those queued callbacks. Guard the actual composable rather than swallowing
// window errors, disabling the outline, or making the browser test less strict.
// Revisit this targeted transform when upgrading VitePress:
// https://github.com/vuejs/vitepress/blob/v1.6.4/src/client/theme-default/composables/outline.ts
const outlineModule = /\/vitepress\/dist\/client\/theme-default\/composables\/outline\.js$/;
const guard = 'if (!container.value || !marker.value) return;';
const signature = name => new RegExp(`function ${name}\\s*\\(${name === 'activateLink' ? 'hash' : ''}\\)\\s*\\{`, 'g');

export function guardOutlineSource(source) {
  let result = source;
  for (const name of ['setActiveLink', 'activateLink']) {
    const matches = [...result.matchAll(signature(name))];
    if (matches.length !== 1) {
      throw new Error(`VitePress outline compatibility fix: expected one ${name} function. Review the fix before upgrading VitePress.`);
    }
    const match = matches[0];
    const insertion = match.index + match[0].length;
    if (result.slice(insertion).trimStart().startsWith(guard)) continue;
    result = result.slice(0, insertion) + '\n    ' + guard + result.slice(insertion);
  }
  return result;
}

export function outlineLifecycleGuard() {
  return {
    name: 'free-rider:vitepress-outline-lifecycle',
    enforce: 'pre',
    transform(source, id) {
      const path = id.split('?')[0].replaceAll('\\', '/');
      if (!outlineModule.test(path)) return null;
      return { code: guardOutlineSource(source), map: null };
    },
  };
}
