# Pet-Safe Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a free-to-host static programmatic-SEO site answering "Can my [pet] eat/have [X]?" for guinea pigs (pet #1), with an interactive checker, sourced verdicts, and schema.org markup — expandable to more pets by adding data rows.

**Architecture:** A small dependency-free Node build script reads a JSON dataset (one row per pet×item), validates it, and emits static HTML pages + sitemap.xml + a client JSON payload. Page rendering and the checker use plain JS template literals and vanilla client JS. No framework, no server, no database.

**Tech Stack:** Node 25 (built-in `node:test`, ESM), vanilla HTML/CSS/JS, deploy to Cloudflare Pages or GitHub Pages.

---

## File Structure

```
petsafe-checker/
  package.json                 # ESM, test + build scripts, zero runtime deps
  site.config.js               # brand, baseUrl, disclaimer — single config point
  data/
    pets.json                  # pet metadata (name, slug, blurb, intro)
    items.json                 # the dataset: array of {pet,item,...,source}
  src/
    lib/slugify.js             # string -> url slug
    lib/validate.js            # dataset row + collection validation
    lib/schema.js              # schema.org QAPage JSON-LD generator
    lib/render.js              # layout + item/index/home/checker page renderers
    build.js                   # orchestrator: read -> validate -> emit dist/
  assets/
    styles.css                 # one stylesheet
    checker.js                 # client-side checker (uses checker-data.json)
  test/
    slugify.test.js
    validate.test.js
    schema.test.js
    render.test.js
    build.test.js
    data-integrity.test.js     # runs validate over the REAL dataset
  dist/                        # build output (gitignored)
```

**Verdict enum (fixed everywhere):** `"safe" | "moderation" | "never" | "ask_vet"`.

**Item row shape:**
```js
{
  pet: "guinea-pig",          // slug, must exist in pets.json
  item: "Bell pepper",        // display name
  slug: "bell-pepper",        // url slug (derived, but stored for stability)
  category: "vegetable",      // vegetable|fruit|herb|leafy-green|household|other
  verdict: "safe",            // enum
  reason: "High in vitamin C, low in sugar...",
  quantity: "A few thin slices",        // "" allowed for never/ask_vet
  frequency: "Daily",                    // "" allowed
  warning_signs: "Soft stool if overfed",// "" allowed
  source_name: "RSPCA",       // required UNLESS verdict==="ask_vet"
  source_url: "https://www.rspca.org.uk/..."  // required UNLESS ask_vet
}
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `site.config.js`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "petsafe-checker",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test",
    "build": "node src/build.js"
  }
}
```

- [ ] **Step 2: Write site.config.js**

```js
export const site = {
  brand: "NibbleSafe",
  tagline: "Is it safe for your pet?",
  baseUrl: "https://nibblesafe.pages.dev", // placeholder; set at deploy
  disclaimer:
    "This information is for general guidance only and is not a substitute " +
    "for professional veterinary advice. When in doubt, ask your vet.",
};
```

- [ ] **Step 3: Verify Node test runner works**

Run: `node --test`
Expected: exits 0 with "tests 0" (no tests yet) — confirms toolchain.

- [ ] **Step 4: Commit**

```bash
git add package.json site.config.js
git commit -m "chore: scaffold project (package.json, site config)"
```

---

### Task 2: slugify utility

**Files:**
- Create: `src/lib/slugify.js`
- Test: `test/slugify.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/lib/slugify.js";

test("lowercases and hyphenates", () => {
  assert.equal(slugify("Bell Pepper"), "bell-pepper");
});
test("strips punctuation and apostrophes", () => {
  assert.equal(slugify("Cat's claw (root)"), "cats-claw-root");
});
test("collapses repeated separators and trims", () => {
  assert.equal(slugify("  Spring  --  Onion  "), "spring-onion");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/slugify.test.js`
Expected: FAIL — cannot find module `slugify.js`.

- [ ] **Step 3: Write minimal implementation**

```js
export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/slugify.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slugify.js test/slugify.test.js
git commit -m "feat: add slugify utility"
```

---

### Task 3: dataset validation

**Files:**
- Create: `src/lib/validate.js`
- Test: `test/validate.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRow, validateCollection } from "../src/lib/validate.js";

const ok = {
  pet: "guinea-pig", item: "Bell pepper", slug: "bell-pepper",
  category: "vegetable", verdict: "safe", reason: "Vitamin C.",
  quantity: "A few slices", frequency: "Daily", warning_signs: "",
  source_name: "RSPCA", source_url: "https://www.rspca.org.uk/x",
};

test("accepts a valid row", () => {
  assert.deepEqual(validateRow(ok, ["guinea-pig"]), []);
});
test("rejects unknown verdict", () => {
  const errs = validateRow({ ...ok, verdict: "maybe" }, ["guinea-pig"]);
  assert.ok(errs.some((e) => e.includes("verdict")));
});
test("requires source unless verdict is ask_vet", () => {
  const errs = validateRow({ ...ok, source_name: "", source_url: "" }, ["guinea-pig"]);
  assert.ok(errs.some((e) => e.includes("source")));
  const okAskVet = validateRow(
    { ...ok, verdict: "ask_vet", source_name: "", source_url: "" }, ["guinea-pig"]);
  assert.deepEqual(okAskVet, []);
});
test("rejects pet not in known list", () => {
  const errs = validateRow({ ...ok, pet: "dragon" }, ["guinea-pig"]);
  assert.ok(errs.some((e) => e.includes("pet")));
});
test("collection flags duplicate pet+slug", () => {
  const errs = validateCollection([ok, { ...ok }], ["guinea-pig"]);
  assert.ok(errs.some((e) => e.includes("duplicate")));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/validate.test.js`
Expected: FAIL — cannot find module `validate.js`.

- [ ] **Step 3: Write minimal implementation**

```js
const VERDICTS = new Set(["safe", "moderation", "never", "ask_vet"]);
const CATEGORIES = new Set([
  "vegetable", "fruit", "herb", "leafy-green", "household", "other",
]);
const REQUIRED = ["pet", "item", "slug", "category", "verdict", "reason"];

export function validateRow(row, knownPets) {
  const errs = [];
  for (const f of REQUIRED) {
    if (!row[f] || String(row[f]).trim() === "") errs.push(`missing ${f}`);
  }
  if (row.verdict && !VERDICTS.has(row.verdict)) errs.push(`bad verdict: ${row.verdict}`);
  if (row.category && !CATEGORIES.has(row.category)) errs.push(`bad category: ${row.category}`);
  if (row.pet && !knownPets.includes(row.pet)) errs.push(`unknown pet: ${row.pet}`);
  if (row.verdict !== "ask_vet") {
    if (!row.source_name || !row.source_url) {
      errs.push(`missing source for ${row.item} (${row.verdict})`);
    }
  }
  return errs.map((e) => `[${row.pet}/${row.slug || row.item}] ${e}`);
}

export function validateCollection(rows, knownPets) {
  const errs = [];
  const seen = new Set();
  for (const row of rows) {
    errs.push(...validateRow(row, knownPets));
    const key = `${row.pet}/${row.slug}`;
    if (seen.has(key)) errs.push(`duplicate row: ${key}`);
    seen.add(key);
  }
  return errs;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/validate.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.js test/validate.test.js
git commit -m "feat: add dataset validation with source-required rule"
```

---

### Task 4: schema.org JSON-LD generator

**Files:**
- Create: `src/lib/schema.js`
- Test: `test/schema.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { qaPageSchema } from "../src/lib/schema.js";

const row = {
  pet: "guinea-pig", item: "Bell pepper", verdict: "safe",
  reason: "High in vitamin C.", source_name: "RSPCA",
  source_url: "https://www.rspca.org.uk/x",
};

test("produces valid QAPage JSON-LD", () => {
  const obj = JSON.parse(qaPageSchema(row, "Can guinea pigs eat bell pepper?"));
  assert.equal(obj["@type"], "QAPage");
  assert.equal(obj.mainEntity["@type"], "Question");
  assert.ok(obj.mainEntity.acceptedAnswer.text.includes("vitamin C"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/schema.test.js`
Expected: FAIL — cannot find module `schema.js`.

- [ ] **Step 3: Write minimal implementation**

```js
const VERDICT_LEAD = {
  safe: "Yes, in appropriate amounts.",
  moderation: "Only in moderation.",
  never: "No — this is not safe.",
  ask_vet: "Check with your vet first.",
};

export function qaPageSchema(row, question) {
  const answer = `${VERDICT_LEAD[row.verdict]} ${row.reason}`;
  const obj = {
    "@context": "https://schema.org",
    "@type": "QAPage",
    mainEntity: {
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    },
  };
  return JSON.stringify(obj);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/schema.test.js`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/lib/schema.js test/schema.test.js
git commit -m "feat: add schema.org QAPage JSON-LD generator"
```

---

### Task 5: page renderers (layout, item, index, home, checker)

**Files:**
- Create: `src/lib/render.js`
- Test: `test/render.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderItemPage, questionFor } from "../src/lib/render.js";

const pet = { slug: "guinea-pig", name: "Guinea Pig", name_plural: "guinea pigs" };
const row = {
  pet: "guinea-pig", item: "Bell pepper", slug: "bell-pepper",
  category: "vegetable", verdict: "safe", reason: "High in vitamin C.",
  quantity: "A few slices", frequency: "Daily", warning_signs: "Soft stool if overfed",
  source_name: "RSPCA", source_url: "https://www.rspca.org.uk/x",
};

test("questionFor builds the search phrase", () => {
  assert.equal(questionFor(pet, row), "Can guinea pigs eat bell pepper?");
});
test("item page contains verdict, reason, source link and JSON-LD", () => {
  const html = renderItemPage(pet, row, []);
  assert.match(html, /Can guinea pigs eat bell pepper\?/);
  assert.match(html, /High in vitamin C/);
  assert.match(html, /rspca\.org\.uk/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /verdict--safe/);
});
test("ask_vet page renders without a source block", () => {
  const html = renderItemPage(pet, { ...row, verdict: "ask_vet", source_name: "", source_url: "" }, []);
  assert.match(html, /verdict--ask_vet/);
  assert.doesNotMatch(html, /Source:/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/render.test.js`
Expected: FAIL — cannot find module `render.js`.

- [ ] **Step 3: Write minimal implementation**

```js
import { site } from "../../site.config.js";
import { qaPageSchema } from "./schema.js";

const VERDICT_LABEL = {
  safe: "✅ Safe", moderation: "⚠️ In moderation",
  never: "⛔ Never", ask_vet: "❓ Ask your vet",
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function questionFor(pet, row) {
  return `Can ${pet.name_plural} eat ${row.item.toLowerCase()}?`;
}

export function layout({ title, description, canonical, body, jsonLd }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="stylesheet" href="/styles.css">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
</head><body>
<header class="site-header"><a class="brand" href="/">${esc(site.brand)}</a>
<a class="nav-check" href="/checker/">Safety checker</a></header>
<main>${body}</main>
<footer class="site-footer"><p class="disclaimer">${esc(site.disclaimer)}</p></footer>
</body></html>`;
}

export function renderItemPage(pet, row, related) {
  const q = questionFor(pet, row);
  const url = `${site.baseUrl}/${pet.slug}/${row.slug}/`;
  const details = [
    row.quantity && `<dt>How much</dt><dd>${esc(row.quantity)}</dd>`,
    row.frequency && `<dt>How often</dt><dd>${esc(row.frequency)}</dd>`,
    row.warning_signs && `<dt>Watch for</dt><dd>${esc(row.warning_signs)}</dd>`,
  ].filter(Boolean).join("");
  const source = row.verdict !== "ask_vet" && row.source_name
    ? `<p class="source">Source: <a href="${esc(row.source_url)}" rel="nofollow noopener" target="_blank">${esc(row.source_name)}</a></p>`
    : "";
  const relatedHtml = related.length
    ? `<section class="related"><h2>More ${esc(pet.name_plural)} foods</h2><ul>` +
      related.map((r) => `<li><a href="/${pet.slug}/${r.slug}/">${esc(r.item)}</a></li>`).join("") +
      `</ul></section>`
    : "";
  const body = `<article class="item">
<nav class="crumbs"><a href="/${pet.slug}/">${esc(pet.name)}</a> / ${esc(row.item)}</nav>
<h1>${esc(q)}</h1>
<p class="verdict verdict--${row.verdict}">${VERDICT_LABEL[row.verdict]}</p>
<p class="reason">${esc(row.reason)}</p>
${details ? `<dl class="details">${details}</dl>` : ""}
${source}
<p class="cta"><a href="/checker/">Check another food &rarr;</a></p>
${relatedHtml}
</article>`;
  return layout({
    title: `${q} | ${site.brand}`,
    description: `${VERDICT_LABEL[row.verdict].replace(/[^\w ]/g, "").trim()}. ${row.reason}`.slice(0, 155),
    canonical: url,
    jsonLd: qaPageSchema(row, q),
    body,
  });
}

export function renderPetIndex(pet, rows) {
  const items = rows
    .slice()
    .sort((a, b) => a.item.localeCompare(b.item))
    .map((r) => `<li><a href="/${pet.slug}/${r.slug}/"><span>${esc(r.item)}</span><span class="v v--${r.verdict}">${VERDICT_LABEL[r.verdict]}</span></a></li>`)
    .join("");
  const body = `<section class="pet-index">
<h1>Can ${esc(pet.name_plural)} eat... ?</h1>
<p>${esc(pet.intro)}</p>
<ul class="food-list">${items}</ul></section>`;
  return layout({
    title: `What can ${pet.name_plural} eat? Full safe food list | ${site.brand}`,
    description: `A sourced list of foods ${pet.name_plural} can and can't eat, with safe amounts.`,
    canonical: `${site.baseUrl}/${pet.slug}/`,
    body,
  });
}

export function renderHome(pets) {
  const cards = pets.map((p) =>
    `<a class="pet-card" href="/${p.slug}/"><h2>${esc(p.name)}</h2><p>${esc(p.blurb)}</p></a>`).join("");
  const body = `<section class="hero"><h1>${esc(site.brand)}</h1>
<p class="tagline">${esc(site.tagline)}</p>
<a class="big-cta" href="/checker/">Open the safety checker</a></section>
<section class="pets"><h2>Pick your pet</h2><div class="pet-cards">${cards}</div></section>`;
  return layout({
    title: `${site.brand} — ${site.tagline}`,
    description: "Sourced, easy answers on what your pet can safely eat.",
    canonical: `${site.baseUrl}/`,
    body,
  });
}

export function renderCheckerPage(pets) {
  const options = pets.map((p) => `<option value="${p.slug}">${esc(p.name)}</option>`).join("");
  const body = `<section class="checker">
<h1>Pet food safety checker</h1>
<label>My pet is a <select id="pet">${options}</select></label>
<label>Can it eat <input id="food" type="text" placeholder="e.g. bell pepper" autocomplete="off"></label>
<div id="result" class="result" aria-live="polite"></div>
<ul id="suggestions" class="suggestions"></ul>
</section>
<script src="/checker.js" type="module"></script>`;
  return layout({
    title: `Pet food safety checker | ${site.brand}`,
    description: "Type a food and your pet to instantly see if it's safe.",
    canonical: `${site.baseUrl}/checker/`,
    body,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/render.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/render.js test/render.test.js
git commit -m "feat: add page renderers (item, index, home, checker)"
```

---

### Task 6: pets metadata + seed dataset (sourced)

**Files:**
- Create: `data/pets.json`
- Create: `data/items.json`
- Test: `test/data-integrity.test.js`

- [ ] **Step 1: Write data/pets.json**

```json
[
  {
    "slug": "guinea-pig",
    "name": "Guinea Pig",
    "name_plural": "guinea pigs",
    "blurb": "Fragile guts and a daily vitamin C need — check before you feed.",
    "intro": "Guinea pigs can't make their own vitamin C and have sensitive digestion, so the right vegetables and fruits matter. Every verdict below cites a veterinary or rescue source."
  }
]
```

- [ ] **Step 2: Write the data-integrity test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCollection } from "../src/lib/validate.js";
import { slugify } from "../src/lib/slugify.js";

const pets = JSON.parse(readFileSync(new URL("../data/pets.json", import.meta.url)));
const items = JSON.parse(readFileSync(new URL("../data/items.json", import.meta.url)));
const petSlugs = pets.map((p) => p.slug);

test("dataset passes validation (sources present unless ask_vet)", () => {
  const errs = validateCollection(items, petSlugs);
  assert.deepEqual(errs, [], errs.join("\n"));
});
test("every slug matches slugify(item)", () => {
  for (const r of items) assert.equal(r.slug, slugify(r.item), `slug mismatch for ${r.item}`);
});
test("seed has at least 15 guinea pig items", () => {
  assert.ok(items.filter((r) => r.pet === "guinea-pig").length >= 15);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/data-integrity.test.js`
Expected: FAIL — cannot find `data/items.json`.

- [ ] **Step 4: Author data/items.json — START with these 15 fully-sourced rows**

These are grounded in the sources surfaced during research (RSPCA, PDSA, Oxbow,
GuineaLynx). Each `reason`/`quantity`/`frequency` reflects those sources. Begin
with this exact seed, then **expand to 40–60 rows during execution by reading the
cited authority pages** — never invent a verdict.

```json
[
  { "pet": "guinea-pig", "item": "Bell pepper", "slug": "bell-pepper", "category": "vegetable", "verdict": "safe", "reason": "One of the best foods for guinea pigs — very high in vitamin C and low in sugar. Remove the seeds and core.", "quantity": "A few thin slices", "frequency": "Daily", "warning_signs": "", "source_name": "RSPCA", "source_url": "https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/diet" },
  { "pet": "guinea-pig", "item": "Romaine lettuce", "slug": "romaine-lettuce", "category": "leafy-green", "verdict": "safe", "reason": "A good leafy green that's higher in nutrients than iceberg. Rich in vitamin C.", "quantity": "A few leaves", "frequency": "Daily", "warning_signs": "Loose stool if introduced too fast", "source_name": "PDSA", "source_url": "https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/your-guinea-pig-s-diet" },
  { "pet": "guinea-pig", "item": "Iceberg lettuce", "slug": "iceberg-lettuce", "category": "leafy-green", "verdict": "never", "reason": "Almost no nutritional value, mostly water, and can cause digestive upset and diarrhoea.", "quantity": "", "frequency": "", "warning_signs": "Diarrhoea", "source_name": "PDSA", "source_url": "https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/your-guinea-pig-s-diet" },
  { "pet": "guinea-pig", "item": "Cucumber", "slug": "cucumber", "category": "vegetable", "verdict": "moderation", "reason": "Safe and hydrating but low in nutrients and high in water, so it's a treat rather than a staple.", "quantity": "A thin slice or two", "frequency": "A few times a week", "warning_signs": "Watery stool if overfed", "source_name": "RSPCA", "source_url": "https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/diet" },
  { "pet": "guinea-pig", "item": "Carrot", "slug": "carrot", "category": "vegetable", "verdict": "moderation", "reason": "Safe but high in sugar, so feed as an occasional treat. Carrot tops (leaves) are a healthier daily option.", "quantity": "A small piece", "frequency": "1–2 times a week", "warning_signs": "Weight gain if overfed", "source_name": "Oxbow Animal Health", "source_url": "https://oxbowanimalhealth.com/blog/foods-guinea-pigs-should-never-eat/" },
  { "pet": "guinea-pig", "item": "Spinach", "slug": "spinach", "category": "leafy-green", "verdict": "moderation", "reason": "Nutritious and rich in vitamin C but high in calcium, which can contribute to bladder or kidney stones if fed too often.", "quantity": "A small leaf or two", "frequency": "1–2 times a week", "warning_signs": "Signs of bladder discomfort", "source_name": "Oxbow Animal Health", "source_url": "https://oxbowanimalhealth.com/blog/foods-guinea-pigs-should-never-eat/" },
  { "pet": "guinea-pig", "item": "Broccoli", "slug": "broccoli", "category": "vegetable", "verdict": "moderation", "reason": "Safe and high in vitamin C but can cause gas and bloating if eaten too often.", "quantity": "A small floret or leaf", "frequency": "1–2 times a week", "warning_signs": "Bloating, discomfort", "source_name": "PDSA", "source_url": "https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/your-guinea-pig-s-diet" },
  { "pet": "guinea-pig", "item": "Tomato", "slug": "tomato", "category": "fruit", "verdict": "moderation", "reason": "The ripe fruit is safe in small amounts, but it's acidic and can cause mouth sores or upset if overfed. The leaves, stems and unripe (green) tomato are toxic.", "quantity": "A small piece of ripe fruit", "frequency": "Occasionally", "warning_signs": "Mouth sores, refusal to eat", "source_name": "RSPCA", "source_url": "https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/diet" },
  { "pet": "guinea-pig", "item": "Strawberry", "slug": "strawberry", "category": "fruit", "verdict": "moderation", "reason": "A good source of vitamin C but high in sugar, so an occasional treat only.", "quantity": "A small slice", "frequency": "1–2 times a week", "warning_signs": "Soft stool, weight gain", "source_name": "RSPCA", "source_url": "https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/diet" },
  { "pet": "guinea-pig", "item": "Orange", "slug": "orange", "category": "fruit", "verdict": "moderation", "reason": "Very high in vitamin C but also acidic and sugary, so feed sparingly as a treat.", "quantity": "A small segment", "frequency": "1–2 times a week", "warning_signs": "Mouth sores from acidity", "source_name": "PDSA", "source_url": "https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/your-guinea-pig-s-diet" },
  { "pet": "guinea-pig", "item": "Kale", "slug": "kale", "category": "leafy-green", "verdict": "moderation", "reason": "A nutritious leafy green high in vitamin C, but also high in calcium, so rotate it rather than feeding daily.", "quantity": "A small leaf", "frequency": "2–3 times a week", "warning_signs": "Bladder issues if overfed", "source_name": "Oxbow Animal Health", "source_url": "https://oxbowanimalhealth.com/blog/foods-guinea-pigs-should-never-eat/" },
  { "pet": "guinea-pig", "item": "Coriander (cilantro)", "slug": "coriander-cilantro", "category": "herb", "verdict": "safe", "reason": "A well-loved herb that's a good source of vitamin C and safe to feed regularly.", "quantity": "A small handful of leaves", "frequency": "Daily", "warning_signs": "", "source_name": "RSPCA", "source_url": "https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/diet" },
  { "pet": "guinea-pig", "item": "Onion", "slug": "onion", "category": "vegetable", "verdict": "never", "reason": "Toxic to guinea pigs — onions (and garlic, chives, leeks) can damage red blood cells and cause serious illness.", "quantity": "", "frequency": "", "warning_signs": "Weakness, pale gums — seek a vet urgently", "source_name": "PDSA", "source_url": "https://www.pdsa.org.uk/pet-help-and-advice/looking-after-your-pet/small-pets/your-guinea-pig-s-diet" },
  { "pet": "guinea-pig", "item": "Garlic", "slug": "garlic", "category": "vegetable", "verdict": "never", "reason": "Toxic — like onion, garlic can damage blood cells and cause potentially fatal illness in guinea pigs.", "quantity": "", "frequency": "", "warning_signs": "Lethargy, pale gums — seek a vet urgently", "source_name": "RSPCA", "source_url": "https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/diet" },
  { "pet": "guinea-pig", "item": "Avocado", "slug": "avocado", "category": "fruit", "verdict": "never", "reason": "Contains persin and is very high in fat — toxic to guinea pigs and can cause severe illness.", "quantity": "", "frequency": "", "warning_signs": "Breathing trouble, lethargy — seek a vet urgently", "source_name": "RSPCA", "source_url": "https://www.rspca.org.uk/adviceandwelfare/pets/rodents/guineapigs/diet" }
]
```

- [ ] **Step 5: Run integrity test to verify it passes**

Run: `node --test test/data-integrity.test.js`
Expected: PASS (3 tests) — collection valid, slugs match, ≥15 items.

- [ ] **Step 6: Commit**

```bash
git add data/pets.json data/items.json test/data-integrity.test.js
git commit -m "feat: add pets metadata and sourced guinea pig seed dataset"
```

---

### Task 7: build orchestrator

**Files:**
- Create: `src/build.js`
- Test: `test/build.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { build } from "../src/build.js";

test("build emits pages, sitemap and checker data", async () => {
  const out = new URL("../dist/", import.meta.url).pathname;
  rmSync(out, { recursive: true, force: true });
  const result = await build();
  assert.ok(result.pageCount >= 15);
  assert.ok(existsSync(`${out}index.html`));
  assert.ok(existsSync(`${out}guinea-pig/index.html`));
  assert.ok(existsSync(`${out}guinea-pig/bell-pepper/index.html`));
  assert.ok(existsSync(`${out}checker/index.html`));
  assert.ok(existsSync(`${out}sitemap.xml`));
  assert.ok(existsSync(`${out}checker-data.json`));
  assert.ok(existsSync(`${out}styles.css`));
  assert.ok(existsSync(`${out}checker.js`));
  const data = JSON.parse(readFileSync(`${out}checker-data.json`));
  assert.ok(Array.isArray(data) && data[0].verdict);
  const sitemap = readFileSync(`${out}sitemap.xml`, "utf8");
  assert.match(sitemap, /guinea-pig\/bell-pepper/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build.test.js`
Expected: FAIL — cannot find module `build.js`.

- [ ] **Step 3: Write the implementation**

```js
import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { site } from "../site.config.js";
import { validateCollection } from "./lib/validate.js";
import {
  renderItemPage, renderPetIndex, renderHome, renderCheckerPage,
} from "./lib/render.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = `${root}/dist`;

function writePage(relPath, html) {
  const full = `${OUT}/${relPath}`;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
}

export async function build() {
  const pets = JSON.parse(readFileSync(`${root}/data/pets.json`));
  const items = JSON.parse(readFileSync(`${root}/data/items.json`));
  const petSlugs = pets.map((p) => p.slug);

  const errs = validateCollection(items, petSlugs);
  if (errs.length) throw new Error(`Dataset invalid:\n${errs.join("\n")}`);

  mkdirSync(OUT, { recursive: true });
  const urls = [`${site.baseUrl}/`, `${site.baseUrl}/checker/`];

  writePage("index.html", renderHome(pets));
  writePage("checker/index.html", renderCheckerPage(pets));

  let pageCount = 0;
  for (const pet of pets) {
    const rows = items.filter((r) => r.pet === pet.slug);
    writePage(`${pet.slug}/index.html`, renderPetIndex(pet, rows));
    urls.push(`${site.baseUrl}/${pet.slug}/`);
    for (const row of rows) {
      const related = rows.filter((r) => r.slug !== row.slug && r.category === row.category).slice(0, 6);
      writePage(`${pet.slug}/${row.slug}/index.html`, renderItemPage(pet, row, related));
      urls.push(`${site.baseUrl}/${pet.slug}/${row.slug}/`);
      pageCount++;
    }
  }

  // Client payload: only the fields the checker needs.
  const checkerData = items.map((r) => ({
    pet: r.pet, item: r.item, slug: r.slug, verdict: r.verdict, reason: r.reason,
  }));
  writeFileSync(`${OUT}/checker-data.json`, JSON.stringify(checkerData));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
  writeFileSync(`${OUT}/sitemap.xml`, sitemap);

  copyFileSync(`${root}/assets/styles.css`, `${OUT}/styles.css`);
  copyFileSync(`${root}/assets/checker.js`, `${OUT}/checker.js`);

  return { pageCount, urlCount: urls.length };
}

// Allow `node src/build.js`
if (import.meta.url === `file://${process.argv[1]}`) {
  build().then((r) => console.log(`Built ${r.pageCount} item pages, ${r.urlCount} urls.`));
}
```

- [ ] **Step 4: Create placeholder assets so build can run**

Create `assets/styles.css` with `/* styles added in Task 8 */` and
`assets/checker.js` with `// checker added in Task 9` so the copy step succeeds.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/build.test.js`
Expected: PASS — all output files exist.

- [ ] **Step 6: Commit**

```bash
git add src/build.js test/build.test.js assets/styles.css assets/checker.js
git commit -m "feat: add static build orchestrator (pages, sitemap, checker data)"
```

---

### Task 8: stylesheet

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Write the stylesheet**

Replace the placeholder with a clean, mobile-first stylesheet. Verdict colours
must map to the enum classes used in render.js: `verdict--safe` (green),
`verdict--moderation` (amber), `verdict--never` (red), `verdict--ask_vet` (grey).

```css
:root{--green:#1a7f3c;--amber:#b8860b;--red:#c0392b;--grey:#5a6675;--ink:#1c2430;--bg:#fbfaf7;--card:#fff;--line:#e7e3da}
*{box-sizing:border-box}body{margin:0;font:17px/1.6 system-ui,sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:760px;margin:0 auto;padding:24px}
a{color:#1a5fb4}
.site-header{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;background:var(--card);border-bottom:1px solid var(--line)}
.brand{font-weight:800;font-size:20px;text-decoration:none;color:var(--ink)}
.crumbs{font-size:14px;color:var(--grey);margin-bottom:8px}
h1{font-size:30px;line-height:1.2;margin:.2em 0 .4em}
.verdict{display:inline-block;font-weight:700;padding:10px 16px;border-radius:10px;color:#fff}
.verdict--safe{background:var(--green)}.verdict--moderation{background:var(--amber)}
.verdict--never{background:var(--red)}.verdict--ask_vet{background:var(--grey)}
.reason{font-size:19px}
.details{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:18px 0}
.details dt{font-weight:700;color:var(--grey)}.details dd{margin:0}
.source{font-size:14px;color:var(--grey)}
.food-list{list-style:none;padding:0;display:grid;gap:8px}
.food-list a{display:flex;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--card);border:1px solid var(--line);border-radius:10px;text-decoration:none;color:var(--ink)}
.v{font-size:13px;font-weight:700}.v--safe{color:var(--green)}.v--moderation{color:var(--amber)}.v--never{color:var(--red)}.v--ask_vet{color:var(--grey)}
.hero{text-align:center;padding:32px 0}.tagline{font-size:20px;color:var(--grey)}
.big-cta,.nav-check{display:inline-block;background:var(--green);color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700}
.nav-check{padding:8px 14px;font-size:14px}
.pet-cards{display:grid;gap:14px}.pet-card{display:block;padding:18px;background:var(--card);border:1px solid var(--line);border-radius:12px;text-decoration:none;color:var(--ink)}
.checker label{display:block;margin:14px 0 6px;font-weight:600}
.checker select,.checker input{font-size:18px;padding:10px;border:1px solid var(--line);border-radius:8px;width:100%}
.result{margin-top:18px;min-height:40px}
.suggestions{list-style:none;padding:0;display:grid;gap:6px}
.site-footer{max-width:760px;margin:24px auto;padding:24px;border-top:1px solid var(--line)}
.disclaimer{font-size:13px;color:var(--grey)}
```

- [ ] **Step 2: Rebuild and eyeball**

Run: `npm run build` then open `dist/guinea-pig/bell-pepper/index.html` in a browser.
Expected: styled verdict page renders, green "Safe" badge.

- [ ] **Step 3: Commit**

```bash
git add assets/styles.css
git commit -m "feat: add stylesheet with verdict colour system"
```

---

### Task 9: client-side checker

**Files:**
- Modify: `assets/checker.js`
- Test: `test/checker-match.test.js`

- [ ] **Step 1: Write the failing test for the pure matcher**

The matching logic is a pure function exported alongside the DOM code so it can be
tested in Node.

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchFood } from "../assets/checker.js";

const data = [
  { pet: "guinea-pig", item: "Bell pepper", slug: "bell-pepper", verdict: "safe", reason: "x" },
  { pet: "guinea-pig", item: "Onion", slug: "onion", verdict: "never", reason: "y" },
  { pet: "rabbit", item: "Bell pepper", slug: "bell-pepper", verdict: "safe", reason: "z" },
];

test("exact match within selected pet", () => {
  const m = matchFood(data, "guinea-pig", "bell pepper");
  assert.equal(m.exact.slug, "bell-pepper");
  assert.equal(m.exact.pet, "guinea-pig");
});
test("partial matches become suggestions", () => {
  const m = matchFood(data, "guinea-pig", "on");
  assert.ok(m.suggestions.some((s) => s.slug === "onion"));
});
test("no match returns ask_vet fallback", () => {
  const m = matchFood(data, "guinea-pig", "plutonium");
  assert.equal(m.exact, null);
  assert.equal(m.suggestions.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/checker-match.test.js`
Expected: FAIL — placeholder checker.js has no `matchFood` export.

- [ ] **Step 3: Write the implementation**

```js
export function matchFood(data, pet, query) {
  const q = query.trim().toLowerCase();
  const pool = data.filter((r) => r.pet === pet);
  if (!q) return { exact: null, suggestions: [] };
  const exact = pool.find((r) => r.item.toLowerCase() === q || r.slug === q) || null;
  const suggestions = exact
    ? []
    : pool.filter((r) => r.item.toLowerCase().includes(q)).slice(0, 8);
  return { exact, suggestions };
}

const LABEL = { safe: "✅ Safe", moderation: "⚠️ In moderation", never: "⛔ Never", ask_vet: "❓ Ask your vet" };

// DOM wiring only runs in the browser.
if (typeof document !== "undefined") {
  const petEl = document.getElementById("pet");
  const foodEl = document.getElementById("food");
  const resultEl = document.getElementById("result");
  const sugEl = document.getElementById("suggestions");
  let data = [];
  fetch("/checker-data.json").then((r) => r.json()).then((d) => { data = d; });

  function render() {
    const { exact, suggestions } = matchFood(data, petEl.value, foodEl.value);
    sugEl.innerHTML = "";
    if (!foodEl.value.trim()) { resultEl.innerHTML = ""; return; }
    if (exact) {
      resultEl.innerHTML =
        `<p class="verdict verdict--${exact.verdict}">${LABEL[exact.verdict]}</p>` +
        `<p class="reason">${exact.reason}</p>` +
        `<p><a href="/${exact.pet}/${exact.slug}/">Full details &rarr;</a></p>`;
    } else if (suggestions.length) {
      resultEl.innerHTML = `<p>Did you mean…</p>`;
      sugEl.innerHTML = suggestions
        .map((s) => `<li><a href="/${s.pet}/${s.slug}/">${s.item} — ${LABEL[s.verdict]}</a></li>`).join("");
    } else {
      resultEl.innerHTML =
        `<p class="verdict verdict--ask_vet">${LABEL.ask_vet}</p>` +
        `<p class="reason">We don't have this food listed yet. When in doubt, check with your vet before feeding.</p>`;
    }
  }
  petEl.addEventListener("change", render);
  foodEl.addEventListener("input", render);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/checker-match.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Rebuild and test in browser**

Run: `npm run build`, serve `dist/` (`npx --yes serve dist` or `python3 -m http.server -d dist`),
open `/checker/`, type "bell pepper" for guinea pig.
Expected: green "Safe" verdict appears live.

- [ ] **Step 6: Commit**

```bash
git add assets/checker.js test/checker-match.test.js
git commit -m "feat: add client-side safety checker with tested matcher"
```

---

### Task 10: expand dataset to 40–60 sourced items

**Files:**
- Modify: `data/items.json`

- [ ] **Step 1: Add ~30–45 more guinea pig rows**

Work through the highest-search foods (cabbage, celery, apple, banana, grapes,
blueberry, parsley, basil, mint, dill, cauliflower, courgette/zucchini, sweetcorn,
peas, green beans, watermelon, melon, pear, mango, pineapple, raspberry,
blackberry, sweet potato, beetroot, radish, asparagus, brussels sprouts, dandelion
greens, rocket/arugula, watercress, bok choy, chard, potato, rhubarb, mushroom,
bread, chocolate, dairy/cheese, meat, nuts, seeds). For each: read one of the cited
authority pages (RSPCA, PDSA, Oxbow, GuineaLynx, vet sources) and record the
verdict + reason + amounts + the specific source. **Mark anything you cannot
confidently source as `ask_vet`.** Keep slugs = `slugify(item)`.

- [ ] **Step 2: Validate**

Run: `node --test test/data-integrity.test.js`
Expected: PASS — collection valid, slugs match, count now 40–60.

- [ ] **Step 3: Rebuild**

Run: `npm run build`
Expected: `Built 40–60 item pages`.

- [ ] **Step 4: Commit**

```bash
git add data/items.json
git commit -m "content: expand guinea pig dataset to full sourced food list"
```

---

### Task 11: deploy config + README

**Files:**
- Create: `README.md`
- Create: `.github/workflows/deploy.yml` (GitHub Pages path) OR document Cloudflare Pages

- [ ] **Step 1: Write README.md**

Document: what the site is, `npm test` / `npm run build`, how to add a food (append
a sourced row to `data/items.json`, rebuild), the verdict enum, the source-required
rule, and both deploy options (Cloudflare Pages: connect repo, build `npm run build`,
output `dist`; GitHub Pages: the workflow below).

- [ ] **Step 2: Write GitHub Pages workflow**

```yaml
name: Deploy
on: { push: { branches: [main] } }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Full test + build gate**

Run: `node --test && npm run build`
Expected: all tests pass, build prints page count.

- [ ] **Step 4: Commit**

```bash
git add README.md .github/workflows/deploy.yml
git commit -m "docs: add README and GitHub Pages deploy workflow"
```

---

## Self-Review notes

- **Spec coverage:** programmatic pages (T5/T7), dataset+sourcing (T6/T10),
  checker (T9), schema.org (T4), sitemap (T7), free static hosting (T11),
  accuracy/ask_vet rule (T3 + enforced in T6/T10), disclaimer (T5 layout),
  expandability (add rows → T7 rebuild). Monetisation is intentionally out of MVP
  scope per spec.
- **Verdict enum** identical across validate.js, schema.js, render.js, checker.js:
  `safe|moderation|never|ask_vet`.
- **`matchFood` / `slugify` / `validateRow` / `qaPageSchema` / `renderItemPage`**
  signatures are consistent between definition and use.
- No placeholders: every code step is complete and runnable.
