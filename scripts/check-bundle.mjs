// Performance budget check (ТЗ 12.1, controller ruling R17 as revised).
//
// For every dist/**/index.html it sums the gzip size of all JavaScript the page
// can load in normal use:
//   initial = <script src>, modulepreload links, executable inline scripts,
//             Astro island entries (component-url / renderer-url) and every
//             chunk they import statically.
//   lazy    = chunks reachable only through dynamic import() (lazy domMax
//             features, lazy SkyLayer).
// Only the initial JS is gated (130,000 B for `/`, 2,000 B for other pages, gzip). The lazy and
// total columns are informational and not budgeted. Exits 1 when initial JS overruns.
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** Budgets in bytes (1 KB = 1000 B, ТЗ 12.1). */
const HOME_BUDGET = 130 * 1000;
const PAGE_BUDGET = 2 * 1000;

const gzipSize = (buf) => gzipSync(buf, { level: 9 }).length;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (name === 'index.html') yield full;
  }
}

const moduleCache = new Map();
/** Parses a built JS file for static and dynamic relative imports. */
function readModule(file) {
  if (moduleCache.has(file)) return moduleCache.get(file);
  const code = readFileSync(file);
  const text = code.toString('utf8');
  const info = { file, gzip: gzipSize(code), statics: new Set(), dynamics: new Set() };
  const resolveSpec = (spec) => resolve(dirname(file), spec);
  for (const m of text.matchAll(
    /\b(?:import|export)\s*(?:[^'"`;()]*?\bfrom\s*)?(["'`])(\.{1,2}\/[^"'`]+\.js)\1/g,
  )) {
    info.statics.add(resolveSpec(m[2]));
  }
  for (const m of text.matchAll(/\bimport\s*\(\s*(["'`])(\.{1,2}\/[^"'`]+\.js)\1\s*\)/g)) {
    info.dynamics.add(resolveSpec(m[2]));
  }
  moduleCache.set(file, info);
  return info;
}

/** Collects a static-import closure from the given entry files into `into`. */
function staticClosure(entries, into) {
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (into.has(file) || !existsSync(file)) continue;
    into.add(file);
    queue.push(...readModule(file).statics);
  }
}

function analysePage(htmlFile) {
  const html = readFileSync(htmlFile, 'utf8');
  const pageDir = dirname(htmlFile);
  const toFile = (url) => {
    const path = url.split(/[?#]/)[0];
    return path.startsWith('/') ? join(dist, path) : resolve(pageDir, path);
  };

  const entries = new Set();
  for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi))
    entries.add(toFile(m[1]));
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (!/\brel=["']modulepreload["']/i.test(m[0])) continue;
    const href = /\bhref=["']([^"']+)["']/i.exec(m[0]);
    if (href) entries.add(toFile(href[1]));
  }
  for (const m of html.matchAll(/\b(?:component-url|renderer-url)=["']([^"']+)["']/gi))
    entries.add(toFile(m[1]));

  // Executable inline scripts (everything except data blocks like ld+json).
  let inline = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc=/i.test(attrs)) continue;
    const type = /\btype=["']([^"']+)["']/i.exec(attrs)?.[1]?.toLowerCase();
    if (type && type !== 'module' && type !== 'text/javascript') continue;
    if (m[2].trim()) inline += gzipSize(Buffer.from(m[2]));
  }

  const initialFiles = new Set();
  staticClosure(entries, initialFiles);

  // Chunks only reachable through dynamic import() (transitively).
  const lazyFiles = new Set();
  const seenDyn = new Set();
  const dynQueue = [...initialFiles];
  while (dynQueue.length) {
    const file = dynQueue.pop();
    if (seenDyn.has(file)) continue;
    seenDyn.add(file);
    const info = readModule(file);
    for (const target of info.dynamics) {
      if (initialFiles.has(target) || !existsSync(target)) continue;
      const closure = new Set();
      staticClosure([target], closure);
      for (const f of closure) {
        if (!initialFiles.has(f)) lazyFiles.add(f);
      }
      dynQueue.push(...closure);
    }
  }

  const sum = (files) => [...files].reduce((n, f) => n + readModule(f).gzip, 0);
  const initial = sum(initialFiles) + inline;
  const lazy = sum(lazyFiles);
  return { initial, lazy, total: initial + lazy, inline, initialFiles, lazyFiles };
}

const kb = (n) => (n / 1000).toFixed(1).padStart(7) + ' KB';

if (!existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

const pages = [...walk(dist)].sort();
const rows = [];
let failed = false;
const verbose = process.argv.includes('--verbose');

for (const file of pages) {
  const rel = relative(dist, file);
  const route = '/' + rel.replace(/index\.html$/, '');
  const r = analysePage(file);
  const budget = route === '/' ? HOME_BUDGET : PAGE_BUDGET;
  const ok = r.initial <= budget;
  if (!ok) failed = true;
  rows.push({ route, ...r, budget, ok });
}

// Silent-pass guard: the home page is the one with the real budget, so it must be there and it
// must load some JavaScript (an empty list means the HTML scan found nothing to measure).
const home = rows.find((r) => r.route === '/');
if (!home || home.initialFiles.size === 0) {
  console.error(
    home
      ? 'dist/index.html lists no initial JS files; the bundle scan found nothing to measure.'
      : 'dist/index.html is missing; the home page budget cannot be checked.',
  );
  process.exit(1);
}

const w = Math.max(...rows.map((r) => r.route.length), 4);
console.log(
  `${'page'.padEnd(w)}  ${'initial'.padStart(10)}  ${'budget'.padStart(10)}  ${'lazy*'.padStart(10)}  ${'total*'.padStart(10)}  status`,
);
for (const r of rows) {
  console.log(
    `${r.route.padEnd(w)}  ${kb(r.initial)}  ${kb(r.budget)}  ${kb(r.lazy)}  ${kb(r.total)}  ${r.ok ? 'ok' : 'OVER'}`,
  );
  if (verbose) {
    for (const f of r.initialFiles)
      console.log(`    initial ${relative(dist, f)} ${readModule(f).gzip} B`);
    for (const f of r.lazyFiles)
      console.log(`    lazy    ${relative(dist, f)} ${readModule(f).gzip} B`);
    if (r.inline) console.log(`    inline   ${r.inline} B`);
  }
}

if (failed) {
  console.error('\nInitial JS budget exceeded (gzip, 1 KB = 1000 B).');
  process.exit(1);
}
console.log('\n* lazy and total are informational (lazy chunks are not budgeted).');
console.log('All pages within the initial JS budget.');
