import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, copyFile, realpath, rm } from 'node:fs/promises';
import { resolve, dirname, relative, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reuse the request renderer, not Electron-only integrations (updater, MCP, filesystem).
const REQUEST_SCRIPTS = ['ui/app.js', 'ui/dialog-enter.mjs', 'ui/reveal-passwords.js'];
const here = dirname(fileURLToPath(import.meta.url));
const attribute = (tag, name) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];

export async function buildDemo({
  sourceDir = resolve(here, '../../../src'),
  demoDir = here,
  outDir = resolve(here, '../public/demo'),
} = {}) {
  sourceDir = await realpath(sourceDir);
  outDir = resolve(outDir);
  if ([sourceDir, resolve(demoDir)].some(path => path === outDir || path.startsWith(outDir + sep))) {
    throw new Error('Demo output must not contain its source directories.');
  }
  const original = await readFile(join(sourceDir, 'index.html'), 'utf8');
  if (!/connect-src\s+'none'/.test(original)) throw new Error('The browser demo requires the renderer no-network CSP.');
  const scriptTags = original.match(/<script\b[^>]*>\s*<\/script>/gi) || [];
  const scripts = scriptTags.map(tag => attribute(tag, 'src')).filter(src => REQUEST_SCRIPTS.includes(src));
  for (const required of REQUEST_SCRIPTS) {
    if (!scripts.includes(required)) throw new Error(`Required renderer entry missing: ${required}`);
  }
  const styles = (original.match(/<link\b[^>]*>/gi) || [])
    .filter(tag => attribute(tag, 'rel') === 'stylesheet').map(tag => attribute(tag, 'href'));
  const images = (original.match(/<img\b[^>]*>/gi) || [])
    .map(tag => attribute(tag, 'src'))
    .filter(Boolean);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const seen = new Set();
  const manifest = [];

  async function copyAsset(path) {
    const absolute = resolve(sourceDir, path);
    if (!absolute.startsWith(sourceDir + sep)) throw new Error(`Renderer import escapes source: ${path}`);
    const real = await realpath(absolute);
    if (!real.startsWith(sourceDir + sep)) throw new Error(`Renderer symlink points outside source: ${path}`);
    const name = relative(sourceDir, absolute).split(sep).join('/');
    if (seen.has(name)) return;
    seen.add(name);
    const content = await readFile(absolute);
    const target = join(outDir, name);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    manifest.push({ path: name, sha256: createHash('sha256').update(content).digest('hex') });
    const text = content.toString('utf8');
    const imports = /\.(?:js|mjs)$/.test(name)
      ? [...text.matchAll(/(?:\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?|\bimport\s*\()\s*["']([^"']+)["']/g)].map(match => match[1])
      : /\.css$/.test(name)
        ? [...text.matchAll(/(?:@import\s*|url\(\s*)["']?([^\s"'();]+)["']?/g)].map(match => match[1])
        : [];
    for (const dependency of imports) {
      if (/^(?:data:|#)/.test(dependency)) continue;
      if (/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(dependency)) throw new Error(`External renderer asset not allowed: ${dependency}`);
      if (/\.(?:js|mjs)$/.test(name) && !dependency.startsWith('.')) throw new Error(`Unbundled renderer import: ${dependency}`);
      await copyAsset(relative(sourceDir, resolve(dirname(absolute), dependency)));
    }
  }
  for (const asset of [...styles, ...scripts, ...images]) await copyAsset(asset);
  for (const name of ['client.mjs', 'bootstrap.mjs', 'chrome.css']) {
    await copyFile(join(demoDir, name), join(outDir, name));
  }
  const html = original
    .replace('<html ', '<html data-free-rider-demo ')
    .replace(/<title>[^<]*<\/title>/, '<title>Free Rider — Interactive demo</title>')
    .replace(/<script\b[^>]*>\s*<\/script>/gi, '')
    .replace('</head>', '    <link rel="stylesheet" href="chrome.css" />\n  </head>')
    .replace('</body>', '    <script type="module" src="entry.mjs"></script>\n  </body>');
  await writeFile(join(outDir, 'index.html'), html);
  await writeFile(join(outDir, 'entry.mjs'), `import { startDemo } from './bootstrap.mjs';\nawait startDemo(${JSON.stringify(scripts.map(src => './' + src))});\n`);
  await writeFile(join(outDir, 'renderer-manifest.json'), JSON.stringify({ files: manifest.sort((a, b) => a.path.localeCompare(b.path)) }, null, 2));
  return { assets: seen.size, outDir };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildDemo();
  console.log(`Built browser demo from ${result.assets} actual renderer assets.`);
}
