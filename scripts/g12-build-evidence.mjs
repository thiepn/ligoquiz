// G12: deterministic, non-secret, machine-inspectable build and rollback evidence.
// Run only after npm run build. Never reads browser profiles or session content.
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import console from 'node:console';
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url).pathname;
const dist = join(root, 'dist');
const output = join(root, 'release-evidence', 'g12-build.json');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const invariant = (condition, message) => { if (!condition) throw Error('G12 provenance refusal: ' + message); };

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await collect(full));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}

const paths = (await collect(dist)).sort();
const files = await Promise.all(paths.map(async path => ({
  path: relative(dist, path).split(sep).join('/'),
  sha256: sha(await readFile(path)),
})));
const filenames = new Set(files.map(f => f.path));
invariant(filenames.has('index.html'), 'missing offline entrypoint');
invariant(filenames.has('sw.js'), 'missing built service worker');
invariant(filenames.has('manifest.webmanifest'), 'missing app manifest');
invariant(filenames.has('icons/ligoquiz.svg'), 'missing app icon');
const sw = await readFile(join(dist, 'sw.js'), 'utf8');
const match = sw.match(/const FILES=(\[[^\n]*\]);/);
invariant(match, 'service worker does not disclose precache filenames');
const shell = JSON.parse(match[1]);
invariant(Array.isArray(shell) && shell.length > 0, 'empty precache');
invariant(new Set(shell).size === shell.length, 'duplicate precache entries');
for (const path of shell) {
  invariant(typeof path === 'string' && !path.startsWith('/') && !path.includes('..') &&
    !path.includes('://') && !path.includes('?'), 'unsafe cache path');
  invariant(filenames.has(path), 'missing required offline path: ' + path);
}
for (const file of files) {
  if (/^assets\/.*\.(js|css)$/.test(file.path))
    invariant(shell.includes(file.path), 'uncached compiled asset: ' + file.path);
}
invariant(sw.includes('LIGO_APPLY_UPDATE') && sw.includes('confirmed===true'),
  'service worker lost explicit update guard');
const manifest = JSON.parse(await readFile(join(dist, 'manifest.webmanifest'), 'utf8'));
invariant(manifest.scope === './' && manifest.start_url === './#/spielen',
  'PWA scope/start route is not relative to deployment base');
invariant((manifest.icons ?? []).every(icon => typeof icon.src === 'string' &&
  icon.src.startsWith('./') && !icon.src.includes('..')), 'unsafe icon scope');
const index = await readFile(join(dist, 'index.html'), 'utf8');
invariant(!/src=["']\/assets\/|href=["']\/assets\//.test(index),
  'absolute root asset detected; would break a scoped deployment');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
invariant(/^[a-f0-9]{40}$/.test(head), 'invalid checkout SHA');
const evidence = {
  format: 'ligoquiz-g12-build-evidence-v1',
  gitSha: head,
  deploymentPath: 'relative',
  expectedScope: './',
  offlinePrecache: shell,
  files,
  bundleSha256: sha(files.map(f => f.path + ':' + f.sha256).join('\n')),
  rollbackRules: [
    'Preserve original v1.14 main and legacy-origin browser profile.',
    'Never auto-migrate active v1 data or overwrite an existing event ID.',
    'Require human-controlled preview, backup exports, and physical signoff before cutover.',
  ],
};
await mkdir(join(root, 'release-evidence'), { recursive: true });
await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
console.log('G12 build evidence: ' + head + ' / ' + evidence.bundleSha256 + ' / ' + files.length + ' files');
