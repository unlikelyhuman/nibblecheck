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
<header class="site-header"><a class="brand" href="${P}/">${esc(site.brand)}</a>
<a class="nav-check" href="${P}/checker/">Safety checker</a></header>
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

export function renderHome(pets) {
  const cards = pets.map((p) =>
    `<a class="pet-card" href="${P}/${p.slug}/"><h2>${esc(p.name)}</h2><p>${esc(p.blurb)}</p></a>`).join("");
  const body = `<section class="hero"><h1>${esc(site.brand)}</h1>
<p class="tagline">${esc(site.tagline)}</p>
<a class="big-cta" href="${P}/checker/">Open the safety checker</a></section>
<section class="pets"><h2>Pick your pet</h2><div class="pet-cards">${cards}</div></section>`;
  return layout({
    title: `${site.brand} — ${site.tagline}`,
    description: "Sourced, easy answers on what your pet can safely eat.",
    canonical: `${site.baseUrl}/`,
    body,
  });
}

export function renderCheckerPage(pets, version = "") {
  const options = pets.map((p) => `<option value="${p.slug}">${esc(p.name)}</option>`).join("");
  const v = version ? `?v=${version}` : "";
  const body = `<section class="checker">
<h1>Pet food safety checker</h1>
<label>My pet is a <select id="pet">${options}</select></label>
<label>Can it eat <input id="food" type="text" placeholder="e.g. bell pepper" autocomplete="off"></label>
<div id="result" class="result" aria-live="polite"></div>
<ul id="suggestions" class="suggestions"></ul>
</section>
<script>window.__BASE__=${JSON.stringify(P)};window.__DATA_V__=${JSON.stringify(version)}</script>
<script src="${P}/checker.js${v}" type="module"></script>`;
  return layout({
    title: `Pet food safety checker | ${site.brand}`,
    description: "Type a food and your pet to instantly see if it's safe.",
    canonical: `${site.baseUrl}/checker/`,
    body,
  });
}
