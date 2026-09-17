import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';
import { guardOutlineSource, outlineLifecycleGuard } from '../.vitepress/outline-lifecycle.mjs';

// Run via the docs prebuild hook: these tests need the installed VitePress
// package, unlike the dependency-free tests discovered by the app's node --test.
const require = createRequire(import.meta.url);
const theme = resolve(dirname(require.resolve('vitepress')), '../client/theme-default');
const outlinePath = resolve(theme, 'composables/outline.js');
const source = readFileSync(outlinePath, 'utf8');
const utils = readFileSync(resolve(theme, 'support/utils.js'), 'utf8');
const plugin = outlineLifecycleGuard();
const patched = plugin.transform(source, outlinePath).code;

// Execute the installed composable and its real throttle/debounce function.
// Only Vue lifecycle registration, DOM refs, and scheduling are controlled.
function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Expected installed function: ${name}`);
  const body = text.indexOf('{', start);
  let depth = 1;
  for (let index = body + 1; index < text.length; index++) {
    if (text[index] === '{') depth++;
    if (text[index] === '}' && --depth === 0) return text.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}
function mountOutline(code = patched) {
  const hooks = {};
  const listeners = new Map();
  const timers = new Map();
  const frames = new Map();
  const classes = new Set();
  let nextId = 0;
  const link = {
    offsetTop: 20,
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
  };
  const container = { value: { querySelector: () => link } };
  const marker = { value: { style: {} } };
  const initialMarker = marker.value;
  const location = { hash: '#example' };
  const context = vm.createContext({
    onMounted: fn => { hooks.mount = fn; },
    onUnmounted: fn => { hooks.unmount = fn; },
    onUpdated: fn => { hooks.update = fn; },
    useAside: () => ({ isAsideEnabled: { value: true } }),
    requestAnimationFrame: fn => { frames.set(++nextId, fn); return nextId; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: fn => { timers.set(++nextId, fn); return nextId; },
    clearTimeout: id => timers.delete(id),
    window: {
      scrollY: 0, innerHeight: 1080,
      addEventListener: (name, fn) => listeners.set(name, fn),
      removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); },
    },
    document: { body: { offsetHeight: 5000 } },
    location, resolvedHeaders: [], getScrollOffset: () => 0,
  });
  vm.runInContext([
    extractFunction(utils, 'throttleAndDebounce'),
    extractFunction(code, 'useActiveAnchor'),
    extractFunction(code, 'getAbsoluteTop'),
  ].join('\n'), context, { filename: outlinePath });
  context.useActiveAnchor(container, marker);
  hooks.mount();
  const flush = queue => {
    for (const [id, fn] of [...queue]) { queue.delete(id); fn(); }
  };
  return {
    container, marker, initialMarker, location, hooks, classes,
    scroll: () => listeners.get('scroll')(),
    flushFrames: () => flush(frames),
    flushTimers: () => flush(timers),
    unmount: () => { hooks.unmount(); container.value = null; marker.value = null; },
    hasScrollListener: () => listeners.has('scroll'),
  };
}

test('reproduces the original 1.6.4 crash after a queued scroll outlives the outline', () => {
  const outline = mountOutline(source);
  outline.flushFrames();
  outline.scroll();
  outline.scroll();
  outline.unmount();
  assert.equal(outline.hasScrollListener(), false);
  assert.throws(() => outline.flushTimers(), /Cannot read properties of null.*style/);
});

test('a queued scroll is harmless after the outline has unmounted', () => {
  const outline = mountOutline();
  outline.flushFrames();
  outline.scroll();
  outline.scroll();
  outline.unmount();
  assert.doesNotThrow(() => outline.flushTimers());
  assert.equal(outline.hasScrollListener(), false);
});

test('the initial animation frame is harmless when navigation unmounts immediately', () => {
  const outline = mountOutline();
  outline.unmount();
  assert.doesNotThrow(() => outline.flushFrames());
});

test('a late route update with an anchor does not query a cleared container', () => {
  const outline = mountOutline();
  outline.unmount();
  assert.doesNotThrow(() => outline.hooks.update());
});

test('either missing template ref is guarded independently', () => {
  for (const missing of ['container', 'marker']) {
    const outline = mountOutline();
    outline[missing].value = null;
    assert.doesNotThrow(() => outline.hooks.update());
    assert.doesNotThrow(() => outline.flushFrames());
  }
});

test('mounted outlines still activate the selected link and position the marker', () => {
  const outline = mountOutline();
  outline.hooks.update();
  assert.equal(outline.initialMarker.style.top, '59px');
  assert.equal(outline.initialMarker.style.opacity, '1');
  assert.ok(outline.classes.has('active'));
});

test('mounted outlines still hide the marker when no heading is selected', () => {
  const outline = mountOutline();
  outline.hooks.update();
  outline.flushFrames();
  assert.equal(outline.initialMarker.style.top, '33px');
  assert.equal(outline.initialMarker.style.opacity, '0');
  assert.equal(outline.classes.has('active'), false);
});

test('the transform touches only the default theme outline module and is idempotent', () => {
  assert.equal(plugin.transform(source, '/src/outline.js'), null);
  assert.equal(plugin.transform(source, outlinePath + '.map'), null);
  assert.equal(plugin.transform(source, outlinePath + '?v=1').code, patched);
  assert.equal(plugin.transform(source, outlinePath.replaceAll('/', '\\')).code, patched);
  assert.equal(guardOutlineSource(patched), patched);
});

test('dependency source changes fail loudly rather than silently skipping the fix', () => {
  assert.throws(() => guardOutlineSource('export function changed() {}'), /Review the fix/);
  assert.throws(() => guardOutlineSource(source + '\nfunction activateLink(hash) {}'), /expected one activateLink/);
});
