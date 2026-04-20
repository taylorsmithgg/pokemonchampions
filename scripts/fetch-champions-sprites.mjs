#!/usr/bin/env node
/**
 * Populate `.sprite-cache/` from the Bulbagarden Archives
 * `Category:Champions_menu_sprites` gallery.
 *
 * The category is paginated (~200 files per page). This script
 *   1. Fetches every page (follows the "next page" link).
 *   2. Extracts every `Menu_CP_*.png` upload URL from the gallery `srcset`.
 *   3. Downloads any file that is missing from `.sprite-cache/`.
 *
 * The shiny variants (`Menu_CP_NNNN_shiny.png`) are NOT listed in this
 * category — they live in `Category:Champions_shiny_menu_sprites` — so this
 * script only covers the non-shiny baseline that the detector actually uses.
 *
 * Re-running is a no-op: files that already exist on disk are skipped. If a
 * Bulbapedia upload is replaced (new hash), the old cached file will stay
 * cached; delete it manually if you need a refresh.
 *
 * Usage:  node scripts/fetch-champions-sprites.mjs
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const CATEGORY_URL =
  'https://archives.bulbagarden.net/wiki/Category:Champions_menu_sprites';
const CACHE_DIR = '.sprite-cache';
const USER_AGENT = 'pokemonchampions-dev-fetch/1.0 (Bulbapedia sprite sync)';

if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Parse a category gallery page for:
 *   - every `Menu_CP_*.png` upload URL
 *   - an optional "next page" continuation URL
 */
function parseGalleryPage(html) {
  const uploads = new Map(); // filename -> full upload URL
  const uploadRe =
    /https:\/\/archives\.bulbagarden\.net\/media\/upload\/([a-f0-9])\/([a-f0-9]{2})\/(Menu_CP_[^"'\s)]+?\.png)/g;
  for (const m of html.matchAll(uploadRe)) {
    const [, a, ab, rawFilename] = m;
    if (!rawFilename.startsWith('Menu_CP_')) continue;
    // Some Bulbapedia filenames contain percent-encoded unicode
    // (e.g. `Menu_CP_0666-Pok%C3%A9_Ball.png`). The original upload URL must
    // keep the percent-encoded form, but on disk we want the decoded name so
    // the DB builder's form regex matches `Poké Ball` against SKIP_FORMS.
    let diskName;
    try {
      diskName = decodeURIComponent(rawFilename);
    } catch {
      diskName = rawFilename;
    }
    uploads.set(
      diskName,
      `https://archives.bulbagarden.net/media/upload/${a}/${ab}/${rawFilename}`,
    );
  }

  // MediaWiki paginator: "next page" link with `filefrom=…`.
  const nextRe =
    /<a href="(\/w\/index\.php\?title=Category:Champions_menu_sprites&amp;filefrom=[^"]+)"[^>]*>next page<\/a>/;
  const nextMatch = html.match(nextRe);
  let nextUrl = null;
  if (nextMatch) {
    nextUrl = `https://archives.bulbagarden.net${nextMatch[1].replace(/&amp;/g, '&')}`;
  }
  return { uploads, nextUrl };
}

async function enumerateCategory() {
  const all = new Map();
  let url = CATEGORY_URL;
  const seenUrls = new Set();
  while (url && !seenUrls.has(url)) {
    seenUrls.add(url);
    console.log(`Fetching category page: ${url}`);
    const html = await fetchText(url);
    const { uploads, nextUrl } = parseGalleryPage(html);
    for (const [k, v] of uploads) {
      if (!all.has(k)) all.set(k, v);
    }
    if (nextUrl === url) break;
    url = nextUrl;
  }
  return all;
}

async function main() {
  console.log('Enumerating Category:Champions_menu_sprites…');
  const remote = await enumerateCategory();
  console.log(`  → ${remote.size} files listed on Bulbapedia`);

  const cached = new Set(
    readdirSync(CACHE_DIR).filter(f => f.endsWith('.png')),
  );

  const missing = [...remote.entries()]
    .filter(([name]) => !cached.has(name))
    .sort();
  console.log(`  → ${missing.length} files missing from ${CACHE_DIR}/`);

  let okCount = 0;
  let failCount = 0;
  for (const [name, url] of missing) {
    try {
      const buf = await fetchBuffer(url);
      writeFileSync(join(CACHE_DIR, name), buf);
      okCount++;
      console.log(`  ✓ ${name}  (${buf.length.toLocaleString()} bytes)`);
    } catch (err) {
      failCount++;
      console.warn(`  ✗ ${name}: ${err.message}`);
    }
    // Gentle pause so we're a good Bulbapedia citizen.
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(
    `\nDone. downloaded=${okCount} failed=${failCount} already_cached=${cached.size}`,
  );
  if (failCount > 0) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
