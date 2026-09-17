import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildDemo } from './build.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'rider-demo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDir = join(root, 'src'), demoDir = join(root, 'demo'), outDir = join(root, 'out');
  await mkdir(join(sourceDir, 'ui'), { recursive: true });
  await mkdir(join(sourceDir, 'modules'), { recursive: true });
  await mkdir(demoDir);
  await writeFile(join(sourceDir, 'index.html'), `<!doctype html><html lang="ko"><head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
    <link rel="stylesheet" href="style.css"></head><body><div id="view"></div>
    <script type="module" src="ui/app.js"></script><script type="module" src="ui/dialog-enter.mjs"></script>
    <script type="module" src="ui/reveal-passwords.js"></script><script type="module" src="ui/native.js"></script></body></html>`);
  await writeFile(join(sourceDir, 'style.css'), ':root { color-scheme: dark; }');
  await writeFile(join(sourceDir, 'ui/app.js'), `import { value } from '../modules/value.mjs';\nwindow.appReady = Promise.resolve(value);`);
  await writeFile(join(sourceDir, 'modules/value.mjs'), 'export const value = 42;');
  await writeFile(join(sourceDir, 'ui/dialog-enter.mjs'), 'export {};');
  await writeFile(join(sourceDir, 'ui/reveal-passwords.js'), 'export {};');
  for (const name of ['client.mjs', 'bootstrap.mjs', 'chrome.css']) await writeFile(join(demoDir, name), '/* demo asset */');
  return { root, sourceDir, demoDir, outDir };
}

test('build copies the actual renderer and transitive imports byte-for-byte', async t => {
  const options = await fixture(t);
  await buildDemo(options);
  assert.equal(await readFile(join(options.outDir, 'ui/app.js'), 'utf8'), await readFile(join(options.sourceDir, 'ui/app.js'), 'utf8'));
  assert.match(await readFile(join(options.outDir, 'modules/value.mjs'), 'utf8'), /42/);
  await assert.rejects(access(join(options.outDir, 'ui/native.js')));
});

test('generated HTML preserves the no-network CSP and boots only after installing the demo adapter', async t => {
  const options = await fixture(t);
  await buildDemo(options);
  const html = await readFile(join(options.outDir, 'index.html'), 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /src="entry.mjs"/);
  assert.match(html, /href="chrome.css"/);
  assert.doesNotMatch(html, /src="ui\//);
  assert.match(await readFile(join(options.outDir, 'entry.mjs'), 'utf8'), /startDemo/);
  const manifest = JSON.parse(await readFile(join(options.outDir, 'renderer-manifest.json'), 'utf8'));
  assert.ok(manifest.files.some(file => file.path === 'ui/app.js' && /^[a-f0-9]{64}$/.test(file.sha256)));
});

test('renderer imports cannot escape the source directory', async t => {
  const options = await fixture(t);
  await writeFile(join(options.sourceDir, 'ui/app.js'), `import '../../outside.mjs';`);
  await writeFile(join(options.root, 'outside.mjs'), 'export {};');
  await assert.rejects(buildDemo(options), /outside|escape/i);
});

test('build fails loudly if the required renderer entry disappears', async t => {
  const options = await fixture(t);
  await rm(join(options.sourceDir, 'ui/app.js'));
  await assert.rejects(buildDemo(options), /ENOENT/);
});

test('clean output removes stale demo assets on repeat builds', async t => {
  const options = await fixture(t);
  await buildDemo(options);
  await writeFile(join(options.outDir, 'old.js'), 'old');
  await buildDemo(options);
  await assert.rejects(access(join(options.outDir, 'old.js')));
});
