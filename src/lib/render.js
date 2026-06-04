import { site } from "../../site.config.js";
import { qaPageSchema } from "./schema.js";

const VERDICT_LABEL = {
  safe: "✅ Safe", moderation: "⚠️ In moderation",
  never: "⛔ Never", ask_vet: "❓ Ask your vet",
};

const P = site.pathPrefix || "";

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
<link rel="stylesheet" href="${P}/styles.css">
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
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
    ? `<p class="source">Source: <a href="${esc(row.source_url)}" rel="nofollow noopener" target="_blank">${esc(row.source_name)}</a></p>`
    : "";
  const relatedHtml = related.length
    ? `<section class="related"><h2>More ${esc(pet.name_plural)} foods</h2><ul>` +
      related.map((r) => `<li><a href="${P}/${pet.slug}/${r.slug}/">${esc(r.item)}</a></li>`).join("") +
      `</ul></section>`
    : "";
  const body = `<article class="item">
<nav class="crumbs"><a href="${P}/${pet.slug}/">${esc(pet.name)}</a> / ${esc(row.item)}</nav>
<h1>${esc(q)}</h1>
<p class="verdict verdict--${row.verdict}">${VERDICT_LABEL[row.verdict]}</p>
<p class="reason">${esc(row.reason)}</p>
${details ? `<dl class="details">${details}</dl>` : ""}
${source}
<p class="cta"><a href="${P}/checker/">Check another food &rarr;</a></p>
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
    .map((r) => `<li><a href="${P}/${pet.slug}/${r.slug}/"><span>${esc(r.item)}</span><span class="v v--${r.verdict}">${VERDICT_LABEL[r.verdict]}</span></a></li>`)
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
function finderLayout({ title, description, canonical, srText, pets, version }) {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<link rel="stylesheet" href="${P}/styles.css">
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
