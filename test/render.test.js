import { test } from "node:test";
import assert from "node:assert/strict";
import { renderItemPage, renderPetIndex, renderHome, questionFor } from "../src/lib/render.js";

const pet = { slug: "guinea-pig", name: "Guinea Pig", name_plural: "guinea pigs" };
const row = {
  pet: "guinea-pig", item: "Bell pepper", slug: "bell-pepper",
  category: "vegetable", verdict: "safe", reason: "High in vitamin C.",
  quantity: "A few slices", frequency: "Daily", warning_signs: "Soft stool if overfed",
  source_name: "RSPCA", source_url: "https://www.rspca.org.uk/x",
};

const petFull = {
  slug: "guinea-pig", name: "Guinea Pig", name_plural: "guinea pigs",
  taxon: "small-mammal", diet: "herbivore", blurb: "b",
  intro: "Guinea pigs need a daily source of vitamin C.",
};
const hubRows = [
  { ...row, item: "Bell pepper", slug: "bell-pepper", verdict: "safe", last_reviewed: "2026-06-04" },
  { ...row, item: "Onion", slug: "onion", verdict: "never", reason: "Toxic to guinea pigs.", last_reviewed: "2026-06-03" },
  { ...row, item: "Banana", slug: "banana", verdict: "moderation", reason: "Sugary.", last_reviewed: "2026-06-02" },
];

function ldBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]));
}

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

test("item page emits QAPage (with dateModified) + BreadcrumbList + OG meta", () => {
  const html = renderItemPage(petFull, hubRows[0], []);
  const blocks = ldBlocks(html);
  const qa = blocks.find((b) => b["@type"] === "QAPage");
  const bc = blocks.find((b) => b["@type"] === "BreadcrumbList");
  assert.ok(qa && bc, "expected QAPage + BreadcrumbList");
  assert.equal(qa.dateModified, "2026-06-04");
  assert.equal(bc.itemListElement.length, 3);
  assert.match(html, /og:type" content="article"/);
  assert.match(html, /twitter:card/);
});

test("hub page is data-composed: overview, counts, toxic list, FAQ + breadcrumb JSON-LD", () => {
  const html = renderPetIndex(petFull, hubRows);
  assert.match(html, /Guinea pigs need a daily source of vitamin C\./); // overview
  assert.match(html, /hub-counts/);
  assert.match(html, /toxic-list/);
  assert.match(html, /Never feed guinea pigs/);
  assert.match(html, /Last reviewed 2026-06-04/); // max date
  const blocks = ldBlocks(html);
  assert.ok(blocks.some((b) => b["@type"] === "FAQPage"), "expected FAQPage");
  assert.ok(blocks.some((b) => b["@type"] === "BreadcrumbList"), "expected BreadcrumbList");
});

test("home page emits WebSite + Organization JSON-LD", () => {
  const html = renderHome([petFull], "v1");
  const blocks = ldBlocks(html);
  assert.ok(blocks.some((b) => b["@type"] === "WebSite"));
  assert.ok(blocks.some((b) => b["@type"] === "Organization"));
  assert.match(html, /og:type" content="website"/);
});

test("quotes in item/reason stay attribute-safe and JSON-LD still parses", () => {
  const qrow = { ...hubRows[0], item: 'Cat "treats"', slug: "cat-treats", reason: 'Risk of "xylitol".' };
  const html = renderItemPage(petFull, qrow, []);
  assert.match(html, /&quot;/); // OG/meta attribute escaped
  assert.doesNotThrow(() => ldBlocks(html)); // every JSON-LD block parses
});
