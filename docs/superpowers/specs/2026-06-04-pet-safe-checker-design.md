# Spec: "Is It Safe?" — Exotic-Pet Food & Safety Checker

**Date:** 2026-06-04
**Status:** Approved (design), ready for planning
**Owner:** Sam Harvey

## Goal

Build a free-to-run, programmatic-SEO content site that answers the high-volume
search pattern *"Can my [pet] eat/have [X]?"* for **underserved small/exotic pets**,
monetised later via display ads + affiliate. A compounding digital asset requiring
~1 hr/week of owner input after launch.

## Why this niche (research-backed)

- **Winning structure:** programmatic SEO = one repeatable keyword pattern × a
  structured dataset × one good template → hundreds of pages each answering a
  specific search. Volume is the moat; AI generation is the unfair advantage.
- **Avoids the YMYL trap:** dog/cat health queries are dominated by vet-reviewed
  content farms (Hepper, Chewy) that bury new domains for months/years. Exotic
  pets are fragmented across beatable forum/rescue/blog content.
- **Monetisation-friendly audience:** pet owners don't block ads and spend heavily
  ($188B market, growing). Small-mammal/reptile food market $4.19B (2025) → $5.88B
  (2030), 6.8% CAGR.
- **Groundable in authority:** RSPCA, PDSA, Oxbow, GuineaLynx, vet sources publish
  safe/unsafe data — every verdict cites a real source. Accuracy is the product.

## Strategy: depth-first, breadth-branded

- **Brand promise:** the safety checker for the exotic pets big sites ignore.
- **Execution:** go near-exhaustive on ONE pet first (topical authority), then
  expand. **Pet #1 = guinea pigs** (high demand, fragile diet drives obsessive
  searching, beatable SERP, clean authoritative sourcing). Roadmap: rabbits →
  reptiles (bearded dragon) → parrots.

## Architecture

- **Static site**, pre-rendered from a JSON dataset by a small Node build script.
  No server, no DB, no recurring cost.
- **Hosting:** Cloudflare Pages or GitHub Pages (free). Custom domain optional
  (~£10/yr) later.
- **Interactive checker:** client-side JS reading the JSON — pick pet + type/select
  food → instant verdict. The sticky, shareable centrepiece.

### Components (isolated, single-purpose)

1. **`data/` dataset** — JSON, one row per (pet, item):
   `{ pet, item, slug, category, verdict, reason, quantity, frequency,
   warning_signs, source_name, source_url }`. The single source of truth.
2. **`templates/`** — page template (verdict layout + schema.org QAPage/FAQ
   JSON-LD), checker page, homepage, index/category pages.
3. **`build/` script** — reads dataset → emits static HTML pages + `sitemap.xml`
   + `checker-data.json` (the client payload). Pure function of the dataset.
4. **`assets/`** — one stylesheet, the checker JS. No frameworks.
5. **Verdict vocabulary** — fixed enum: `safe` / `moderation` / `never` /
   `ask_vet` (the explicit "I won't guess" state).

### Data flow

`dataset.json` → build script → { static pages, sitemap, checker-data.json } →
deploy to Cloudflare/GitHub Pages. Checker JS fetches `checker-data.json` at runtime.

## Page structure (per item)

- One clear verdict above the fold (colour + icon + one-line summary).
- Why (the reason), how much / how often, warning signs to watch for.
- Cited source (named authority + link).
- Related items (same category), link back to the checker.
- `schema.org` QAPage/FAQPage JSON-LD for rich-result eligibility.
- Standard meta (title/description/canonical), disclaimer footer.

## Accuracy & ethics (hard constraints)

- Every verdict traces to a named authority. No fabricated safety data.
- Uncertain items → `ask_vet`, never a guessed safe/unsafe.
- Per-page disclaimer: informational, not a substitute for veterinary advice.

## Monetisation (deferred; honest timeline)

- Payment/ad setup is NOT part of MVP (per owner).
- Path: AdSense (day-one pennies) → Ezoic / Mediavine-Journey at traffic scale →
  Amazon Associates affiliate on contextual gear (hay, vitamin-C supplements, food).
- **Honest timeline:** ~3–6 months for Google trust + traffic to build; meaningful
  revenue after. Compounding asset, not a faucet. Income builds and fluctuates.

## Owner's ~1 hr/week

Approve new item/page batches I draft; paste affiliate links when added; occasionally
share a page (early backlinks accelerate ranking).

## MVP scope (build now)

- Guinea pigs, ~40–60 highest-search foods, each fully sourced.
- Interactive checker (client-side).
- Page template with schema, homepage, category index, auto sitemap.
- Deploy-ready static build. Expandable by adding JSON rows.

## Out of scope (MVP)

- Ad/affiliate wiring, custom domain, additional pets, user accounts, comments,
  CMS, analytics dashboards (basic analytics snippet optional).

## Risks

- SEO ranking takes months (inherent).
- Google may deprioritise thin programmatic content → mitigated by genuine per-page
  usefulness + citations + structured data.
- Revenue never "guaranteed constant" — it builds and fluctuates.
- Only cost at stake is build time.

## Success criteria

- Static build produces N valid, sourced, schema-marked pages + working checker.
- Every verdict has a named source or is `ask_vet`.
- Site deploys to free hosting with zero recurring cost.
- Dataset is trivially expandable (add rows → rebuild).
