#!/usr/bin/env node
/**
 * rebuild-website.mjs — Rebuild UNMEIwebsite/ from the live WordPress site.
 *
 * Re-fetches the live unmei-ph.com pages, rewrites all URLs to relative
 * paths, downloads every referenced asset that is not yet on disk (pages,
 * CSS, JS, images, fonts — including url() references inside CSS and asset
 * URLs embedded in inline JavaScript), and injects the Pre-Enroll / Login
 * nav CTAs plus unmei-portal.css.
 *
 * Usage:
 *   node scripts/rebuild-website.mjs            # full rebuild
 *   node scripts/rebuild-website.mjs --dry-run  # preview only, writes nothing
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SITE = resolve(ROOT, 'public', 'UNMEIwebsite');
const ORIGIN = 'https://unmei-ph.com';
const DRY_RUN = process.argv.includes('--dry-run');

/** Live slug -> local file. Longest slugs must be mapped first. */
const PAGES = [
  ['/services/jlpt-n5-class-japanese-beginner-course-philippines/', 'beginner-course.html'],
  ['/jlpt-n4-class-japanese-intermediate-course-philippines/', 'jlpt-n4-course.html'],
  ['/home/about-us/', 'about.html'],
  ['/japanese-language-blog/', 'posts.html'],
  ['/study-in-japan/', 'study-in-japan.html'],
  ['/contact-us/', 'contact.html'],
  ['/services/', 'services.html'],
  ['/', 'index.html'],
];

const stats = { pages: 0, written: 0, downloaded: 0, skipped: 0, needed: [], failed: [] };

async function fetchBuffer(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw lastErr;
}

function downloadPath(url) {
  // https://unmei-ph.com/wp-content/a/b.css?ver=x -> wp-content/a/b.css
  const u = new URL(url);
  // Reject encoded separators BEFORE decoding: %2f (%2F) and %5c survive URL
  // parsing and would decode into path separators / traversal segments.
  if (/%2f|%5c/i.test(u.pathname)) throw new Error(`unsafe asset path (encoded separator): ${url}`);
  const rel = decodeURIComponent(u.pathname).replace(/^\//, '');
  if (/(^|[\\/])\.\.($|[\\/])/.test(rel) || rel.includes('\0')) {
    throw new Error(`unsafe asset path (traversal): ${url}`);
  }
  // Containment check: the resolved destination must stay inside SITE.
  const dest = resolve(SITE, rel);
  if (dest !== SITE && !dest.startsWith(SITE + sep)) {
    throw new Error(`unsafe asset path (escapes site folder): ${url}`);
  }
  return rel;
}

function collectAssetUrls(text) {
  const urls = new Set();
  const push = (raw) => {
    const u = raw.trim().replace(/&amp;/g, '&');
    if (u.startsWith(`${ORIGIN}/wp-content/`) || u.startsWith(`${ORIGIN}/wp-includes/`)) urls.add(u.split('#')[0]);
    else if (u.startsWith('./wp-content/') || u.startsWith('./wp-includes/')) {
      const p = u.slice(2).split('#')[0].split('?')[0];
      urls.add(`${ORIGIN}/${p}`);
    }
  };
  for (const m of text.matchAll(/(?:href|src|poster|content)\s*=\s*["']([^"']+)["']/g)) push(m[1]);
  for (const m of text.matchAll(/srcset\s*=\s*["']([^"']+)["']/g)) {
    for (const part of m[1].split(',')) push(part.trim().split(/\s+/)[0]);
  }
  // Asset URLs embedded in inline JavaScript (e.g. the WP emoji loader's
  // "concatemoji":"./wp-includes/js/wp-emoji-release.min.js?ver=..." setting),
  // which never appear in an attribute.
  for (const m of text.matchAll(/["'(](\.\/wp-(?:content|includes)\/[^"'\s<>)]+)/g)) push(m[1]);
  return urls;
}

function collectCssUrls(cssText, cssUrl) {
  const urls = new Set();
  for (const m of cssText.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    let u = m[1].trim().replace(/&amp;/g, '&');
    if (u.startsWith('data:') || u.startsWith('#')) continue;
    if (u.startsWith('//')) u = `https:${u}`;
    if (u.startsWith(`${ORIGIN}/wp-content/`) || u.startsWith(`${ORIGIN}/wp-includes/`)) {
      urls.add(u.split('?')[0].split('#')[0]);
    } else if (!/^https?:/.test(u)) {
      const base = cssUrl.split('?')[0];
      const resolved = new URL(u, base.endsWith('/') ? base : base.replace(/[^/]*$/, ''));
      if (resolved.href.startsWith(`${ORIGIN}/wp-content/`) || resolved.href.startsWith(`${ORIGIN}/wp-includes/`)) {
        urls.add(resolved.href);
      }
    }
  }
  return urls;
}

function rewriteHtml(html) {
  let out = html;

  // 1) Assets first: absolute -> relative (must run before page-link mapping,
  //    otherwise page-slug mapping would eat asset URLs too).
  out = out.split(`${ORIGIN}/wp-content/`).join('./wp-content/');
  out = out.split(`${ORIGIN}/wp-includes/`).join('./wp-includes/');

  // 2) Page links: only the known slugs map to local files (longest first).
  //    The home slug '/' is fetched and written like the others, but its URL
  //    mapping is handled by the bare-origin rule below.
  for (const [slug, file] of PAGES) {
    if (slug === '/') continue;
    out = out.split(`${ORIGIN}${slug}`).join(file);
  }
  // Bare origin root: map to the home page only when nothing follows the
  // slash (or just a query string). Everything else (feeds, xmlrpc, wp-json,
  // sitemaps, unknown paths) is left for the neutralizer in step 3.
  out = out.replace(/https:\/\/unmei-ph\.com\/(?=["'?]|$)/g, 'index.html');

  // 3) Neutralize all remaining live links -> '#' (dead in a static replica).
  out = out.replace(/https:\/\/unmei-ph\.com\/[^"'\s<)]*/g, '#');
  out = out.replace(/https:\/\/unmei-ph\.com(?=["'\s<)])/g, '#');

  // 4) Inject Pre-Enroll / Login CTAs + portal stylesheet.
  const desktopCtas =
    '</li>' +
    '<li class="menu-item menu-item-unmei-cta"><a href="./register/?intent=pre-enroll" class="menu-link unmei-nav-cta">Pre-Enroll</a></li>' +
    '<li class="menu-item menu-item-unmei-login"><a href="/UNMEIstudentsportal/login.html" class="menu-link unmei-nav-login">Login</a></li>';
  const mobileCtas =
    '</li>' +
    '<li class="menu-item menu-item-unmei-cta ast-mobile-menu-items"><a href="./register/?intent=pre-enroll" class="menu-link unmei-mobile-cta">Pre-Enroll Now</a></li>' +
    '<li class="menu-item menu-item-unmei-login ast-mobile-menu-items"><a href="/UNMEIstudentsportal/login.html" class="menu-link unmei-mobile-login">Login</a></li>';

  const contactItem = />Contact Us<\/a><\/li>/g;
  let seen = 0;
  out = out.replace(contactItem, (match) => {
    seen += 1;
    return seen === 1 ? match.replace(/<\/li>$/, desktopCtas) : match.replace(/<\/li>$/, mobileCtas);
  });

  out = out.replace(
    /<\/head>/i,
    '<link rel="stylesheet" id="unmei-portal-css" href="unmei-portal.css?ver=20260828">\n</head>'
  );

  return out;
}

async function downloadAsset(url) {
  let rel;
  try {
    rel = downloadPath(url);
  } catch (err) {
    console.warn(`  [SKIP] ${err.message}`);
    return { css: null };
  }
  const dest = resolve(SITE, rel);
  if (existsSync(dest)) {
    stats.skipped += 1;
    // Still parse CSS that is already on disk so newly added url() targets
    // inside it are discovered (the header promises nested-asset coverage).
    if (/\.css(\?|$)/.test(url)) {
      try {
        const text = readFileSync(dest, 'utf8');
        if (!text.includes('\u0000')) return { css: text };
      } catch {
        // unreadable -> treat as absent
        return { css: null };
      }
    }
    return { css: null };
  }
  if (DRY_RUN) {
    console.log(`  [need] ${rel}`);
    stats.needed.push(rel);
    return { css: null };
  }
  try {
    const buf = await fetchBuffer(url);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    stats.downloaded += 1;
    console.log(`  [get ] ${rel} (${buf.length} bytes)`);
    const text = buf.toString('utf8');
    if (/\.css(\?|$)/.test(url) && !text.includes('\u0000')) return { css: text };
    return { css: null };
  } catch (err) {
    console.warn(`  [FAIL] ${url} -> ${err.message}`);
    stats.failed.push(url);
    return { css: null };
  }
}

async function main() {
  if (!existsSync(SITE)) {
    console.error(`Site folder not found: ${SITE}`);
    process.exit(1);
  }

  const queue = [];
  const seenUrls = new Set();
  const enqueue = (url) => {
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      queue.push(url);
    }
  };
  const enqueueFromCss = (cssText, cssUrl) => {
    for (const u of collectCssUrls(cssText, cssUrl)) enqueue(u);
  };

  console.log(`Rebuilding UNMEIwebsite from ${ORIGIN}${DRY_RUN ? ' (dry run)' : ''}\n`);

  for (const [slug, file] of PAGES) {
    const url = `${ORIGIN}${slug}`;
    process.stdout.write(`PAGE ${url} -> ${file} ... `);
    let buf;
    try {
      buf = await fetchBuffer(url);
    } catch (err) {
      console.log(`FAILED (${err.message})`);
      stats.failed.push(url);
      continue;
    }
    const html = buf.toString('utf8');
    stats.pages += 1;
    for (const u of collectAssetUrls(html)) enqueue(u);
    if (!DRY_RUN) {
      writeFileSync(resolve(SITE, file), rewriteHtml(html), 'utf8');
      stats.written += 1;
    }
    console.log(`ok (${buf.length} bytes)`);
  }

  console.log(`\nAssets referenced: ${queue.length}`);
  while (queue.length > 0) {
    const url = queue.shift();
    const { css } = await downloadAsset(url);
    if (css) enqueueFromCss(css, url);
  }

  console.log(`\nSUMMARY: pages=${stats.pages} written=${stats.written} downloaded=${stats.downloaded} already-present=${stats.skipped} needed=${stats.needed.length} failed=${stats.failed.length}`);
  if (stats.needed.length > 0) {
    console.log('Needed (dry run — not downloaded):');
    for (const f of stats.needed) console.log(`  - ${f}`);
  }
  if (stats.failed.length > 0) {
    console.log('Failed items:');
    for (const f of stats.failed) console.log(`  - ${f}`);
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
