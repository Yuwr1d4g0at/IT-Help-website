#!/usr/bin/env node
// Keeps the shared parts of every page in step, and checks the site.
//
//   node scripts/sync.mjs           rewrite pages and sitemap.xml in place
//   node scripts/sync.mjs --check   change nothing; exit 1 if anything is out of sync or broken
//
// The site stays plain HTML with no build step: this script edits the committed
// files, so GitHub Pages serves them as they are. Shared pieces live here, once:
//   - head block   theme colour, manifest, share image (between <!-- sync:head --> markers)
//   - JSON-LD      WebPage + BreadcrumbList for pages that have no structured data of their own
//   - skip link    "Skip to main content" plus the #main target
//   - footer       Privacy link
//   - sitemap      adds any page that is missing (with today's date)
// Checks: EN/PT pairs, hreflang targets, internal links and images, sitemap and
// search-index coverage, and the no-em-dash rule for page copy.

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://yuwri.pt";
const CHECK = process.argv.includes("--check");
const TODAY = new Date().toISOString().slice(0, 10);

const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const pages = execSync('git ls-files -co --exclude-standard "*.html"', { cwd: ROOT })
  .toString().trim().split("\n").filter((f) => existsSync(path.join(ROOT, f))).sort();

const problems = [];
const changed = [];
const warn = (f, msg) => problems.push(`${f}: ${msg}`);

const isPt = (f) => f.startsWith("pt/");
const urlOf = (f) => "/" + f.replace(/index\.html$/, "");
const fileOf = (url) => (url.endsWith("/") ? url + "index.html" : url).replace(/^\//, "");
const rel = (fromFile, toUrl) => {
  const r = path.posix.relative(path.posix.dirname(fromFile), toUrl.replace(/^\//, ""));
  if (r === "") return "./";
  return r + (toUrl.endsWith("/") && !r.endsWith("/") ? "/" : "");
};
const esc = (s) => s.replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"');
const jsonStr = (s) => JSON.stringify(s);
const meta = (s, re) => (s.match(re) || [])[1] || "";
const titleOf = (s) => esc(meta(s, /<title>([^<]*)<\/title>/)).replace(/\s*\|\s*Yuwri$/, "").replace(/^Yuwri\s*\|\s*/, "").trim();
const descOf = (s) => esc(meta(s, /<meta name="description" content="([^"]*)"/));

const T = {
  en: {
    skip: "Skip to main content", privacy: "Privacy", home: "Home",
    alt: "Yuwri \u2013 Computer Repair in Seixal", image: "og-image.jpg",
  },
  pt: {
    skip: "Saltar para o conteúdo principal", privacy: "Privacidade", home: "Início",
    alt: "Yuwri \u2013 Reparação de Computadores no Seixal", image: "og-image-pt.jpg",
  },
};

const THEME_SCRIPT = '<script>try{var d=document.documentElement,t=localStorage.getItem("yuwri-theme"),w=localStorage.getItem("yuwri-wall");if(t)d.setAttribute("data-theme",t);if(w)d.setAttribute("data-wall",w)}catch(e){}</script>';

const mark = (name) => [`<!-- sync:${name} -->`, `<!-- /sync:${name} -->`];
const stripBlock = (s, name) => {
  const [a, b] = mark(name);
  return s.replace(new RegExp(`[ \\t]*${a}[\\s\\S]*?${b.replace("/", "\\/")}[ \\t]*\\n(?:[ \\t]*\\n)*`), "");
};
// Re-insert a block before the font preconnect line, so the markup stays tidy and the run is repeatable.
const putBlock = (s, name, body) => {
  const [a, b] = mark(name);
  return s.replace(/^([ \t]*<link href="[^"]*css\/style\.css")/m, `  ${a}\n${body}\n  ${b}\n\n$1`);
};

function headBlock(f) {
  const t = isPt(f) ? T.pt : T.en;
  return [
    `  <meta name="theme-color" content="#2B1D5C" />`,
    `  <link rel="manifest" href="/manifest.webmanifest" />`,
    `  <link rel="apple-touch-icon" href="/images/icon-192.png" />`,
    `  <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin />`,
    `  <meta property="og:image" content="${SITE}/images/${t.image}" />`,
    `  <meta property="og:image:width" content="1200" />`,
    `  <meta property="og:image:height" content="630" />`,
    `  <meta property="og:image:alt" content="${t.alt}" />`,
    `  <meta name="twitter:card" content="summary_large_image" />`,
    `  <meta name="twitter:image" content="${SITE}/images/${t.image}" />`,
  ].join("\n");
}

function ldBlock(f, s) {
  const t = isPt(f) ? T.pt : T.en;
  const url = SITE + urlOf(f);
  const name = titleOf(s);
  const lang = isPt(f) ? "pt-PT" : "en";
  const crumbs = [{ name: t.home, item: SITE + (isPt(f) ? "/pt/" : "/") }];
  const segs = urlOf(f).split("/").filter(Boolean).filter((x) => !(isPt(f) && x === "pt"));
  let acc = isPt(f) ? "/pt" : "";
  segs.forEach((seg, i) => {
    acc += "/" + seg;
    const last = i === segs.length - 1;
    let label = name;
    if (!last) {
      const parent = fileOf(acc + "/");
      label = existsSync(path.join(ROOT, parent)) ? titleOf(read(parent)) : seg;
    }
    crumbs.push({ name: label, item: SITE + acc + "/" });
  });
  const kind = /(^|\/)(blog|cheat-sheets|resources)\/index\.html$/.test(f) ? "CollectionPage" : "WebPage";
  const page = {
    "@context": "https://schema.org", "@type": kind, name, description: descOf(s), url, inLanguage: lang,
    isPartOf: { "@type": "WebSite", name: "Yuwri", url: SITE + "/" },
  };
  const bc = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: c.item })),
  };
  const wrap = (o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2).replace(/^/gm, "  ")}\n  </script>`;
  return wrap(page) + "\n" + wrap(bc);
}

function syncPage(f) {
  const orig = read(f);
  let s = orig;
  const is404 = f === "404.html";
  const t = isPt(f) ? T.pt : T.en;

  // Fonts are self-hosted (see css/style.css): remove any Google Fonts links.
  s = s.replace(/^[ \t]*<link rel="preconnect" href="https:\/\/fonts\.g[^>]*>\n/gm, "");
  s = s.replace(/^[ \t]*<link href="https:\/\/fonts\.googleapis\.com[^>]*>\n(?:[ \t]*\n)?/gm, "");

  // Every page applies the saved theme and wallpaper before first paint (no flash).
  if (!/yuwri-theme/.test(s)) {
    s = s.replace(/^([ \t]*<link href="[^"]*css\/style\.css")/m, `  ${THEME_SCRIPT}\n\n$1`);
  }

  if (!is404) {
    // Head block replaces any older twitter:card line so there is only one.
    // Share-image and card tags live in the head block only: drop any strays.
    s = s.replace(/^[ \t]*<meta (?:property="og:image[^"]*"|name="twitter:(?:image|card)") [^>]*>\n/gm, "");
    s = stripBlock(stripBlock(s, "head"), "ld");
    s = putBlock(s, "head", headBlock(f));
    // Pages with no structured data of their own get generated JSON-LD.
    if (!/application\/ld\+json/.test(s)) s = putBlock(s, "ld", ldBlock(f, s));
  }

  // Skip link + target.
  if (!/class="skip-link"/.test(s)) {
    s = s.replace(/(<body[^>]*>)/, `$1\n  <a class="skip-link" href="#main">${t.skip}</a>`);
  }
  if (!/id="main"/.test(s)) {
    s = s.replace(/(<\/header>\s*(?:<!--[^>]*-->\s*)?)<(section|main)( [^>]*)?>/, (m, pre, tag, attrs = "") =>
      `${pre}<${tag}${attrs} id="main" tabindex="-1">`);
  }

  // Footer Privacy link, copying the class of the Contact link beside it.
  if (!is404 && !/href="(?:[^"]*privacy\/|\.\/)"/.test(s.split('class="site-footer"')[1] || "")) {
    const target = rel(f, isPt(f) ? "/pt/privacy/" : "/privacy/");
    s = s.replace(/(<div class="footer-links">[\s\S]*?)(\n\s*)(<a( class="[^"]*")? href="[^"]*#contact[^"]*">[^<]*<\/a>)/,
      (m, head, nl, contact, cls = "") => `${head}${nl}${contact}${nl}<a${cls} href="${target}">${t.privacy}</a>`);
  }

  if (s !== orig) {
    changed.push(f);
    if (!CHECK) writeFileSync(path.join(ROOT, f), s);
  }
  return s;
}

const sources = Object.fromEntries(pages.map((f) => [f, syncPage(f)]));

// ---------- checks ----------

const indexable = pages.filter((f) => f !== "404.html" && !/noindex/.test(sources[f]));

// EN/PT pairs
for (const f of pages) {
  if (f === "404.html" || f === "index.html" || f === "pt/index.html") continue;
  const twin = isPt(f) ? f.slice(3) : "pt/" + f;
  if (!pages.includes(twin)) warn(f, `no ${isPt(f) ? "English" : "Portuguese"} twin (${twin})`);
}

// hreflang targets, share image, internal links
const skipHref = /^(https?:|mailto:|tel:|javascript:|data:|sms:|#|\/\/)/;
for (const f of pages) {
  const s = sources[f];
  for (const m of s.matchAll(/hreflang="[^"]*" href="([^"]*)"/g)) {
    if (!m[1].startsWith(SITE)) continue;
    const target = fileOf(m[1].slice(SITE.length));
    if (!existsSync(path.join(ROOT, target))) warn(f, `hreflang points to missing page ${m[1]}`);
  }
  const body = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, "");
  for (const m of body.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    let u = m[1].trim();
    if (!u || skipHref.test(u)) {
      if (u.startsWith(SITE)) u = u.slice(SITE.length);
      else continue;
    }
    u = u.split("#")[0].split("?")[0];
    if (!u) continue;
    const abs = u.startsWith("/") ? u.slice(1) : path.posix.join(path.posix.dirname(f), u);
    let p = path.join(ROOT, abs);
    if (existsSync(p) && statSync(p).isDirectory()) p = path.join(p, "index.html");
    if (!existsSync(p)) warn(f, `broken link/asset: ${m[1]}`);
  }
  // No em-dashes in page copy (house rule).
  const text = body.replace(/<[^>]+>/g, " ");
  if (/—|&mdash;/.test(text) || /&mdash;/.test(body)) warn(f, "contains an em-dash");
}
for (const img of ["images/og-image.jpg", "images/og-image-pt.jpg"]) {
  if (!existsSync(path.join(ROOT, img))) warn(img, "missing");
}
if (!existsSync(path.join(ROOT, "manifest.webmanifest"))) warn("manifest.webmanifest", "missing");

// sitemap
let sitemap = read("sitemap.xml");
const missingFromMap = indexable.filter((f) => !sitemap.includes(`<loc>${SITE}${urlOf(f)}</loc>`));
if (missingFromMap.length) {
  const entry = (f) => {
    const url = SITE + urlOf(f);
    const en = SITE + urlOf(isPt(f) ? f.slice(3) : f);
    const pt = SITE + urlOf(isPt(f) ? f : "pt/" + f);
    return [
      "  <url>", `    <loc>${url}</loc>`, `    <lastmod>${TODAY}</lastmod>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${en}" />`,
      `    <xhtml:link rel="alternate" hreflang="pt-PT" href="${pt}" />`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}" />`, "  </url>",
    ].join("\n");
  };
  const add = missingFromMap.map(entry).join("\n");
  sitemap = sitemap.replace("</urlset>", `${add}\n</urlset>`);
  changed.push("sitemap.xml");
  if (!CHECK) writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);
}

// search index (both languages; entries hold full site paths)
for (const [file, inPt] of [["search-index.json", false], ["pt/search-index.json", true]]) {
  let idx;
  try { idx = JSON.parse(read(file)); } catch (e) { warn(file, `invalid JSON: ${e.message}`); continue; }
  const urls = new Set(idx.entries.map((e) => e.url.split("#")[0]));
  for (const u of urls) {
    if (!existsSync(path.join(ROOT, fileOf(u)))) warn(file, `entry points to missing page ${u}`);
  }
  for (const f of indexable.filter((x) => isPt(x) === inPt)) {
    if (/(^|\/)search\/index\.html$/.test(f)) continue;
    if (!urls.has(urlOf(f))) warn(file, `page not in search index: ${urlOf(f)}`);
  }
}

if (changed.length) {
  console.log(`${CHECK ? "Out of sync" : "Updated"} (${changed.length}):`);
  for (const f of changed) console.log("  " + f);
}
if (problems.length) {
  console.log(`\nProblems (${problems.length}):`);
  for (const p of problems) console.log("  " + p);
}
if (!changed.length && !problems.length) console.log(`OK: ${pages.length} pages in sync, no problems.`);
if (problems.length || (CHECK && changed.length)) process.exit(1);
