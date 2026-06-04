# NibbleCheck — indexing & monitoring runbook

The site is built to be crawl- and AI-friendly (sourced verdicts, QAPage/FAQPage/BreadcrumbList
JSON-LD, breadcrumbs, `lastmod` in the sitemap, OpenGraph). The remaining work to get indexed and
to *watch* performance happens in your Google account — these are the steps.

## One-time: verify Google Search Console (~10 min)
1. Go to https://search.google.com/search-console → **Add property** → **URL prefix** →
   enter `https://unlikelyhuman.github.io/nibblecheck/`.
2. Choose the **HTML tag** method. Google shows a token like
   `<meta name="google-site-verification" content="ABC123...">`.
3. Copy just the token value (`ABC123...`) into `site.config.js` → `googleSiteVerification`,
   commit, and let the deploy run. Every page then emits the verification meta.
4. Back in Search Console, click **Verify**.

## One-time: submit the sitemap
- In Search Console → **Sitemaps** → submit `sitemap.xml` (full URL:
  `https://unlikelyhuman.github.io/nibblecheck/sitemap.xml`). It's already linked from `robots.txt`.
- Optional but worth it: add the site to **Bing Webmaster Tools** the same way (it feeds other
  engines + some AI answer engines) and submit the same sitemap.

## What to watch (give it time — SEO is weeks, not days)
- **Pages → Indexed count** climbing toward ~814. New pages take days–weeks to index; don't panic early.
- **Rich results / Enhancements**: FAQ, Breadcrumb, and Q&A should be detected with 0 errors.
  Spot-check any page in the **URL Inspection** tool → "Test live URL" → confirm the structured data.
- **Performance → Queries/Pages**: which animals + foods bring impressions/clicks, average position.

## The decision this data drives (per the doctrine — quality-gated, not a firehose)
After ~3–6 weeks of data:
- **Hubs indexing well + ranking?** → expand depth/breadth deliberately. Two levers:
  - *Category sub-pages* ("Vegetables guinea pigs can eat") = more long-tail surface + internal links.
  - *New animals* via the ingest pipeline (`docs/research-prompt-template.md` → `npm run ingest`).
  Pick based on which existing queries show demand. Coverage gaps per animal: run `npm run ingest`
  on a batch and read its coverage report (e.g. guinea-pig 64/363 master foods).
- **Pages not indexing?** → don't add more pages; investigate (thin/duplicate signals, internal
  linking, backlinks). More pages won't fix an indexing problem.

## Reference
- Sitemap: `dist/sitemap.xml` (regenerated each build, `<lastmod>` from each row's `last_reviewed`).
- Doctrine + standing rules: see project memory `nibblecheck-seo-quality-doctrine`.
