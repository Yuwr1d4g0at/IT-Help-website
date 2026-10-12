# Yuwri website

Static site for [yuwri.pt](https://yuwri.pt): computer repair and IT support in Seixal, Portugal.
Plain HTML, CSS and vanilla JS. No build step: GitHub Pages serves the files as committed.

## Layout

- English pages live at the root (`/blog/`, `/prices/`, ...). Portuguese (pt-PT) twins live under `pt/` with the same paths.
- `css/style.css` is the only stylesheet. `js/` holds the per-page scripts.
- `search-index.json` and `pt/search-index.json` feed the search page and the Spotlight box. Add an entry whenever you add a page.
- Every page has hreflang links to its twin and is listed in `sitemap.xml`.

## Shared parts: `scripts/sync.mjs`

Run `node scripts/sync.mjs` after adding or editing pages. It keeps these in step across every page:

- the head block between `<!-- sync:head -->` markers (theme colour, manifest, share image)
- JSON-LD for pages that have none of their own (between `<!-- sync:ld -->` markers)
- the skip link and its `#main` target
- the footer Privacy link
- missing `sitemap.xml` entries (dated today)

Don't edit anything between the `sync:` markers by hand. Change the script instead.

`node scripts/sync.mjs --check` changes nothing and fails if a page is out of sync, an internal link or image is broken, an EN/PT twin is missing, a page isn't in the sitemap or search index, or the copy contains an em-dash. The same check runs on GitHub for every push and pull request.

## Adding a blog post

1. Copy an existing post in `blog/` and its twin in `pt/blog/`, then rewrite the content.
2. Add a card to `blog/index.html` and `pt/blog/index.html`.
3. Add an entry to both search indexes.
4. Run `node scripts/sync.mjs`.

## House rules

- No em-dashes in page copy. Use a period, colon or parentheses.
- Don't list backups as a service Yuwri offers (backup advice content is fine).
- Software page: only verified winget IDs, nothing that bundles adware.
- Prices, hours, service area and payment methods must match what's confirmed for the business.
