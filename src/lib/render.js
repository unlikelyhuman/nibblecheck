import { site } from "../../site.config.js";
import {
  qaPageSchema,
  breadcrumbSchema,
  faqPageSchema,
  websiteSchema,
  organizationSchema,
  VERDICT_LEAD,
} from "./schema.js";

const VERDICT_LABEL = {
  safe: "✅ Safe", moderation: "⚠️ In moderation",
  never: "⛔ Never", ask_vet: "❓ Ask your vet",
};

// Plain-language diet guidance per diet class (factual, not marketing). Surfaced on hub pages.
const DIET_PRINCIPLE = {
  herbivore: "Base the diet on grass hay and leafy greens; fruit and starchy or sugary foods stay occasional treats.",
  omnivore: "Build the diet on a complete formulated food, adding only small amounts of safe vegetables, fruit and protein.",
  "obligate-carnivore": "Feed mainly meat, organ and a complete carnivore food — most fruit, vegetables, grains and dairy are unsuitable.",
  insectivore: "Feed only appropriate gut-loaded, calcium-dusted live insects; this animal cannot digest plant foods.",
};

const P = site.pathPrefix || "";

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// Attribute-safe: esc() does not handle quotes, which would break content="...".
function escAttr(s) {
  return esc(s).replace(/"/g, "&quot;");
}

export function questionFor(pet, row) {
  return `Can ${pet.name_plural} eat ${row.item.toLowerCase()}?`;
}

function ldBlocks(jsonLd) {
  const arr = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  return arr.map((j) => `<script type="application/ld+json">${j}</script>`).join("\n");
}

function ogMeta({ title, description, canonical, ogType }) {
  return `<meta property="og:title" content="${escAttr(title)}">
<meta property="og:description" content="${escAttr(description)}">
<meta property="og:type" content="${escAttr(ogType)}">
<meta property="og:url" content="${escAttr(canonical)}">
<meta property="og:site_name" content="${escAttr(site.brand)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escAttr(title)}">
<meta name="twitter:description" content="${escAttr(description)}">`;
}

export function layout({ title, description, canonical, body, jsonLd, ogType = "website" }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escAttr(description)}">
<link rel="canonical" href="${escAttr(canonical)}">
${ogMeta({ title, description, canonical, ogType })}
<link rel="stylesheet" href="${P}/styles.css">
${ldBlocks(jsonLd)}
</head><body>
<header class="site-header"><a class="brand" href="${P}/">${esc(site.brand)}</a></header>
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
    ? `<p class="source">Source: <a href="${escAttr(row.source_url)}" rel="nofollow noopener" target="_blank">${esc(row.source_name)}</a></p>`
    : "";
  const reviewed = row.last_reviewed ? `<p class="last-reviewed">Last reviewed ${esc(row.last_reviewed)}</p>` : "";
  const relatedHtml = related.length
    ? `<section class="related"><h2>More ${esc(pet.name_plural)} foods</h2><ul>` +
      related.map((r) => `<li><a href="${P}/${pet.slug}/${r.slug}/">${esc(r.item)}</a></li>`).join("") +
      `</ul></section>`
    : "";
  const body = `<article class="item">
<nav class="crumbs"><a href="${P}/">${esc(site.brand)}</a> / <a href="${P}/${pet.slug}/">${esc(pet.name)}</a> / ${esc(row.item)}</nav>
<h1>${esc(q)}</h1>
<p class="verdict verdict--${row.verdict}">${VERDICT_LABEL[row.verdict]}</p>
<p class="reason">${esc(row.reason)}</p>
${details ? `<dl class="details">${details}</dl>` : ""}
${source}
${reviewed}
<p class="cta"><a href="${P}/checker/">Check another food &rarr;</a></p>
${relatedHtml}
</article>`;
  const crumbs = [
    { name: site.brand, url: `${site.baseUrl}/` },
    { name: pet.name, url: `${site.baseUrl}/${pet.slug}/` },
    { name: row.item, url },
  ];
  return layout({
    title: `${q} | ${site.brand}`,
    description: `${VERDICT_LABEL[row.verdict].replace(/[^\w ]/g, "").trim()}. ${row.reason}`.slice(0, 155),
    canonical: url,
    ogType: "article",
    jsonLd: [qaPageSchema(row, q), breadcrumbSchema(crumbs)],
    body,
  });
}

function foodLinks(pet, rows) {
  return rows
    .slice()
    .sort((a, b) => a.item.localeCompare(b.item))
    .map((r) => `<li><a href="${P}/${pet.slug}/${r.slug}/">${esc(r.item)}</a></li>`)
    .join("");
}

export function renderPetIndex(pet, rows) {
  const by = (v) => rows.filter((r) => r.verdict === v);
  const safe = by("safe");
  const moderation = by("moderation");
  const never = by("never");
  const askVet = by("ask_vet");

  const counts = [
    ["safe", safe.length, "safe to feed"],
    ["moderation", moderation.length, "in moderation"],
    ["never", never.length, "never feed"],
    ["ask_vet", askVet.length, "ask a vet"],
  ]
    .filter(([, n]) => n > 0)
    .map(([v, n, label]) => `<li class="hub-count hub-count--${v}"><span class="hub-count-n">${n}</span> ${label}</li>`)
    .join("");

  const principle = DIET_PRINCIPLE[pet.diet]
    ? `<p class="hub-principle">${esc(DIET_PRINCIPLE[pet.diet])}</p>`
    : "";

  const bestFoods = safe.length
    ? `<section class="best-foods"><h2>Best everyday foods (${safe.length} safe)</h2><ul>${foodLinks(pet, safe.slice().sort((a, b) => a.item.localeCompare(b.item)).slice(0, 8))}</ul></section>`
    : "";

  const toxic = never.length
    ? `<section class="toxic-list"><h2>Never feed ${esc(pet.name_plural)} (${never.length})</h2><ul>${foodLinks(pet, never)}</ul></section>`
    : "";

  const reviewedDates = rows.map((r) => r.last_reviewed).filter(Boolean);
  const lastReviewed = reviewedDates.length ? reviewedDates.reduce((a, b) => (a > b ? a : b)) : "";
  const reviewed = lastReviewed ? `<p class="last-reviewed">Last reviewed ${esc(lastReviewed)}</p>` : "";

  const allItems = rows
    .slice()
    .sort((a, b) => a.item.localeCompare(b.item))
    .map((r) => `<li><a href="${P}/${pet.slug}/${r.slug}/"><span>${esc(r.item)}</span><span class="v v--${r.verdict}">${VERDICT_LABEL[r.verdict]}</span></a></li>`)
    .join("");

  const body = `<section class="pet-index">
<nav class="crumbs"><a href="${P}/">${esc(site.brand)}</a> / ${esc(pet.name)}</nav>
<h1>What can ${esc(pet.name_plural)} eat?</h1>
<p class="hub-overview">${esc(pet.intro)}</p>
${counts ? `<ul class="hub-counts">${counts}</ul>` : ""}
${principle}
${reviewed}
${bestFoods}
${toxic}
<section class="full-list"><h2>Every food, A–Z</h2><ul class="food-list">${allItems}</ul></section>
</section>`;

  // FAQ: data-derived, representative (never-heavy, the high-value queries), capped to keep payload sane.
  const faqRows = [...never.slice(0, 12), ...safe.slice(0, 6)];
  const faqPairs = faqRows.map((r) => ({ q: questionFor(pet, r), a: `${VERDICT_LEAD[r.verdict]} ${r.reason}` }));
  const petUrl = `${site.baseUrl}/${pet.slug}/`;
  const crumbs = [
    { name: site.brand, url: `${site.baseUrl}/` },
    { name: pet.name, url: petUrl },
  ];
  const jsonLd = [breadcrumbSchema(crumbs)];
  if (faqPairs.length) jsonLd.unshift(faqPageSchema(faqPairs));

  return layout({
    title: `What can ${pet.name_plural} eat? Full safe food list | ${site.brand}`,
    description: `${safe.length} foods ${pet.name_plural} can eat and ${never.length} to avoid — every verdict vet-sourced.`.slice(0, 155),
    canonical: petUrl,
    jsonLd,
    body,
  });
}

// The whole product: search your pet, then a food drops in, then the answer.
// Visible labels are hidden (sr-only) to keep the landing uncluttered.
function finderTool() {
  return `<div class="finder">
<div class="step">
<label class="sr-only" for="pet-input">Search your pet</label>
<div class="combo">
<input id="pet-input" type="text" placeholder="Search your pet…" autocomplete="off" inputmode="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="pet-list">
<ul id="pet-list" class="dropdown" role="listbox" hidden></ul>
</div>
</div>
<div class="step" id="step-food" hidden>
<label class="sr-only" for="food-input">Search a food</label>
<div class="combo">
<input id="food-input" type="text" placeholder="Type a food…" autocomplete="off" inputmode="search" aria-autocomplete="list" aria-controls="food-list">
<ul id="food-list" class="dropdown" role="listbox" hidden></ul>
</div>
</div>
<div id="result" class="result" aria-live="polite"></div>
</div>`;
}

function finderScripts(pets, version) {
  const v = version ? `?v=${version}` : "";
  const petsJson = JSON.stringify(
    pets.map((p) => ({ slug: p.slug, name: p.name, name_plural: p.name_plural })),
  );
  return `<script>window.__BASE__=${JSON.stringify(P)};window.__DATA_V__=${JSON.stringify(version)};window.__PETS__=${petsJson}</script>
<script src="${P}/checker.js${v}" type="module"></script>`;
}

function browseLinks(pets) {
  const links = pets.map((p) => `<a href="${P}/${p.slug}/">${esc(p.name_plural)}</a>`).join(" · ");
  return `<p class="browse">Browse every food: ${links}</p>`;
}

// A bare, centred shell with no header — just the brand and the search.
function finderLayout({ title, description, canonical, srText, pets, version, jsonLd, ogType = "website" }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${escAttr(description)}">
<link rel="canonical" href="${escAttr(canonical)}">
${ogMeta({ title, description, canonical, ogType })}
<link rel="stylesheet" href="${P}/styles.css">
${ldBlocks(jsonLd)}
</head><body class="finder-body">
<main class="stage">
<div class="hero">
<h1 class="brand-name">${esc(site.brand)}</h1>
<p class="sr-only">${esc(srText)}</p>
${finderTool()}
</div>
</main>
<footer class="mini-footer">${browseLinks(pets)}<p class="disclaimer">${esc(site.disclaimer)}</p></footer>
${finderScripts(pets, version)}
</body></html>`;
}

export function renderHome(pets, version = "") {
  return finderLayout({
    title: `${site.brand} — is it safe for your pet to eat?`,
    description: "Pick your pet and a food for a clear, vet-sourced safe / not-safe answer in seconds.",
    srText: "Search your pet, then a food, for a clear vet-sourced answer on whether it's safe to feed.",
    canonical: `${site.baseUrl}/`,
    pets,
    version,
    jsonLd: [websiteSchema(), organizationSchema()],
  });
}

export function renderCheckerPage(pets, version = "") {
  return finderLayout({
    title: `Pet food safety checker | ${site.brand}`,
    description: "Type your pet and a food to instantly see if it's safe, with a vet-sourced explanation.",
    srText: "Search your pet, then a food, for a clear vet-sourced answer on whether it's safe to feed.",
    canonical: `${site.baseUrl}/checker/`,
    pets,
    version,
  });
}
