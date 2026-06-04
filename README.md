# NibbleCheck — exotic-pet food & safety checker

**Live:** https://unlikelyhuman.github.io/nibblecheck/

A free-to-host, programmatic-SEO site that answers **"Can my [pet] eat [X]?"** for
underserved exotic pets, starting with **guinea pigs**. Each food gets a sourced
page (✅ Safe / ⚠️ In moderation / ⛔ Never / ❓ Ask your vet) plus an interactive
checker. No server, no database, no recurring cost.

This is a long-term, compounding SEO asset: it takes months for a new site to earn
search traffic. Monetisation (ads + affiliate) is added later, not in this build.

## Commands

```bash
npm test        # run the test suite (node:test, zero deps)
npm run build   # generate the static site into dist/
```

To preview locally after building:

```bash
npx --yes serve dist          # or: python3 -m http.server -d dist 8080
```

## How it works

- **`data/items.json`** — the dataset. One row per pet × food. This is the single
  source of truth.
- **`data/pets.json`** — pet metadata.
- **`src/build.js`** — reads the data, validates it, and writes `dist/`: a page per
  food, a per-pet index, the homepage, the checker, `sitemap.xml`, `robots.txt`, and
  `checker-data.json` (the client payload).
- **`assets/`** — the stylesheet and the client-side checker.

## Adding a food (your weekly task)

Append a row to `data/items.json` and rebuild. Every row **must** cite a real
authority unless the verdict is `ask_vet`:

```json
{
  "pet": "guinea-pig",
  "item": "Courgette (zucchini)",
  "slug": "courgette-zucchini",
  "category": "vegetable",
  "verdict": "moderation",
  "reason": "Safe raw including the skin and seeds; low in sugar and calcium.",
  "quantity": "A thin slice or two",
  "frequency": "Most days",
  "warning_signs": "",
  "source_name": "Guinea Piggles",
  "source_url": "https://www.guineapiggles.co.uk/guinea-pig-vegetables/"
}
```

Rules enforced by `npm test`:
- `verdict` ∈ `safe | moderation | never | ask_vet`
- `category` ∈ `vegetable | fruit | herb | leafy-green | household | other`
- `slug` must equal `slugify(item)`
- `source_name` + `source_url` are **required** unless `verdict` is `ask_vet`
- no duplicate `pet/slug`

**Never invent a verdict.** If you can't source it confidently, use `ask_vet` and
leave the source blank.

## Adding a new pet

Add an entry to `data/pets.json` (`slug`, `name`, `name_plural`, `blurb`, `intro`),
then add that pet's food rows to `items.json`. Rebuild. Done.

## Deploy (free)

### Option A — Cloudflare Pages (recommended)
1. Push this repo to GitHub.
2. Cloudflare dashboard → Pages → connect the repo.
3. Build command: `npm run build` · Output directory: `dist`.
4. Set `baseUrl` in `site.config.js` to your `*.pages.dev` URL (or custom domain),
   commit, and it redeploys automatically.

### Option B — GitHub Pages
The included workflow (`.github/workflows/deploy.yml`) tests, builds, and publishes
`dist/` on every push to `main`. Enable Pages → Source: "GitHub Actions" in repo
settings. Update `baseUrl` in `site.config.js` to your Pages URL.

## Disclaimer

Informational only — not a substitute for veterinary advice. Every verdict cites the
authority it came from so readers (and search engines) can verify it.
