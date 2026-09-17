/** Browser smoke test against the built Pages site, including the real iframe renderer. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '../.vitepress/dist');
const artifacts = resolve(here, '../.vitepress/demo-artifacts');
await mkdir(artifacts, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const path = decodeURIComponent(url.pathname).replace(/^\/free-rider\/?/, '');
    let file = resolve(dist, path || 'index.html');
    if (url.pathname.endsWith('/')) file = resolve(dist, path, 'index.html');
    else if (!extname(file)) file += '.html';
    if (!file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
    const bytes = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(bytes);
  } catch { response.writeHead(404).end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = `${origin}/free-rider/`;
const browser = await chromium.launch({ headless: true });
const errors = [], outgoing = [];
let page;

async function captureDemo(name) {
  // screenshot({ style }) injects a style element into EVERY frame, including
  // the app's strict style-src 'self' document. Change only the parent's nav
  // through CSSOM, and restore it even if capture fails. Never relax demo CSP.
  const navigation = page.locator('.VPNav');
  const original = await navigation.evaluateAll(nodes => nodes.map(node => ({
    value: node.style.getPropertyValue('visibility'),
    priority: node.style.getPropertyPriority('visibility'),
  })));
  await navigation.evaluateAll(nodes => nodes.forEach(node => node.style.setProperty('visibility', 'hidden', 'important')));
  try {
    await page.getByTestId('renderer-demo').screenshot({ path: resolve(artifacts, name) });
  } finally {
    await navigation.evaluateAll((nodes, saved) => nodes.forEach((node, index) => {
      const previous = saved[index];
      if (previous?.value) node.style.setProperty('visibility', previous.value, previous.priority);
      else node.style.removeProperty('visibility');
    }), original);
  }
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 }, reducedMotion: 'reduce' });
  context.on('page', current => {
    current.on('pageerror', error => errors.push(error.message));
    current.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    current.on('request', request => {
      try {
        if (request.frame().parentFrame() && !request.url().startsWith(origin)) outgoing.push(request.url());
      } catch { /* No frame for service worker requests. */ }
    });
  });
  // The landing's release lookup is not part of the demo; keep CI deterministic.
  await context.route('https://api.github.com/repos/dohyeon-kr/free-rider/releases/latest', route => route.fulfill({ contentType: 'application/json', body: '{"assets":[]}' }));
  page = await context.newPage();
  await page.goto(base);
  await page.getByTestId('renderer-demo').scrollIntoViewIfNeeded();
  const frame = page.frameLocator('[data-demo-frame]');
  await frame.locator('html[data-demo-ready="true"]').waitFor();
  assert.equal(await page.locator('[data-demo-frame]').count(), 1);
  assert.match(await page.locator('.hero h1').innerText(), /Ride on your API/);
  assert.equal(await page.locator('.product-stage > .app-window').isVisible(), false);

  await page.getByTestId('demo-scenario-profile').click();
  await frame.locator('.request-heading strong').filter({ hasText: 'Profile' }).waitFor();
  await frame.locator('#sendRequest').click();
  await frame.locator('.response-body').filter({ hasText: 'unauthorized' }).waitFor();

  await page.getByTestId('demo-scenario-login').click();
  await frame.locator('textarea[aria-label="Request body"]').fill('{"email":"playground@example.test","password":"demo-only"}');
  await frame.locator('#sendRequest').click();
  await frame.locator('.response-body').filter({ hasText: 'playground@example.test' }).waitFor();
  await captureDemo('desktop-login.png');

  await page.getByTestId('demo-scenario-profile').click();
  await frame.locator('.request-heading strong').filter({ hasText: 'Profile' }).waitFor();
  await frame.locator('#sendRequest').click();
  await frame.locator('.response-body').filter({ hasText: 'playground@example.test' }).waitFor();
  assert.match(await frame.locator('.response-tools .metrics').innerText(), /^200/);

  await page.getByTestId('demo-scenario-orders').click();
  await frame.locator('.request-heading strong').filter({ hasText: 'Orders' }).waitFor();
  const queryValue = frame.locator('.request-content input').filter({ visible: true });
  // Locate the actual value by its current contents instead of depending on table column order.
  const inputs = await queryValue.all();
  let limit;
  for (const input of inputs) if (await input.inputValue() === '2') { limit = input; break; }
  assert.ok(limit, 'The seeded limit query row should be visible');
  await limit.fill('1');
  await frame.locator('#sendRequest').click();
  await frame.locator('.response-body').filter({ hasText: 'FR-1042' }).waitFor();
  const orders = JSON.parse(await frame.locator('.response-body').innerText());
  assert.equal(orders.data.length, 1);
  await captureDemo('desktop-orders.png');

  await frame.locator('#requestUrl').fill('https://example.com/orders');
  await frame.locator('#sendRequest').click();
  await frame.locator('.response-body').filter({ hasText: 'demo_origin_only' }).waitFor();
  assert.deepEqual(outgoing, []);

  await page.getByTestId('demo-reset').click();
  await frame.locator('html[data-demo-ready="true"]').waitFor();
  await page.getByTestId('demo-scenario-profile').click();
  await frame.locator('.request-heading strong').filter({ hasText: 'Profile' }).waitFor();
  await frame.locator('#sendRequest').click();
  await frame.locator('.response-body').filter({ hasText: 'unauthorized' }).waitFor();

  await page.locator('.hero .actions a.ghost').click();
  await page.waitForURL('**/guide/getting-started');
  // VitePress changes history before its async route finishes rendering.
  // Wait for the old landing to unmount before requesting the next navigation.
  await page.locator('.VPDoc h1').waitFor();
  await page.getByTestId('renderer-demo').waitFor({ state: 'detached' });
  await page.goBack();
  await page.waitForURL(base);
  await page.getByTestId('renderer-demo').waitFor({ state: 'visible' });
  await page.getByTestId('renderer-demo').scrollIntoViewIfNeeded();
  await page.frameLocator('[data-demo-frame]').locator('html[data-demo-ready="true"]').waitFor();
  assert.equal(await page.locator('[data-demo-frame]').count(), 1);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId('renderer-demo').scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No page horizontal overflow at 390px');
  assert.ok(await page.frameLocator('[data-demo-frame]').locator('html').evaluate(element => element.scrollWidth <= window.innerWidth + 1), 'No iframe document overflow at 390px');
  await page.frameLocator('[data-demo-frame]').locator('#sendRequest').click();
  await page.frameLocator('[data-demo-frame]').locator('.response-body').filter({ hasText: 'demo-token' }).waitFor();
  await captureDemo('mobile.png');

  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto(`${base}en/`);
  await page.getByTestId('renderer-demo').scrollIntoViewIfNeeded();
  await page.frameLocator('[data-demo-frame]').locator('html[data-demo-ready="true"]').waitFor();
  assert.match(await page.getByTestId('demo-scenario-login').innerText(), /Login/);
  await captureDemo('english.png');
  assert.deepEqual(errors, [], 'No browser errors');
  assert.deepEqual(outgoing, [], 'The embedded renderer made no external requests');
  await writeFile(resolve(artifacts, 'result.json'), JSON.stringify({ passed: true, checks: ['real renderer bootstrap', 'login JSON edit', 'token handoff', 'query edit', 'unauthorized response', 'external URL blocked', 'reset isolation', 'client-side navigation', '390px mobile', 'English copy', 'zero browser errors', 'no external demo requests'] }, null, 2));
  console.log('PASS: renderer demo desktop/mobile/English smoke checks');
} catch (error) {
  if (page) await page.screenshot({ path: resolve(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
  await writeFile(resolve(artifacts, 'failure.json'), JSON.stringify({ error: error.stack, errors, outgoing }, null, 2));
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
