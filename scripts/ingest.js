// Ingest a batch of research-agent rows for an animal into data/items.json.
// Replaces the old ephemeral /tmp/merge.mjs. Offline only (no network, no test run).
//
//   npm run ingest -- path/to/research-output.json
//   npm run ingest -- path/to/research-output.json --allow-new-foods
//
// Pipeline: regenerate slugs -> stamp last_reviewed -> validateRow -> master-list gate
// (new foods rejected unless --allow-new-foods) -> source-domain warnings -> merge (dedupe
// pet/slug) -> coverage report. After this: `npm test`, then `npm run verify-sources`, then build.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "../src/lib/slugify.js";
import {
  validateRow,
  validateAgainstFoods,
  validateSourceDomains,
} from "../src/lib/validate.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const allowNewFoods = args.includes("--allow-new-foods");
const inputPath = args.find((a) => !a.startsWith("--"));

function die(msg) {
  console.error(`\nERROR: ${msg}`);
  process.exit(1);
}

if (!inputPath) die("usage: npm run ingest -- <research-output.json> [--allow-new-foods]");

const today = new Date().toISOString().slice(0, 10);

const items = JSON.parse(readFileSync(`${root}/data/items.json`));
const pets = JSON.parse(readFileSync(`${root}/data/pets.json`));
const foods = JSON.parse(readFileSync(`${root}/data/foods.json`));
const sources = JSON.parse(readFileSync(`${root}/data/sources.json`));
const petSlugs = pets.map((p) => p.slug);

let incoming = JSON.parse(readFileSync(resolve(inputPath)));
if (!Array.isArray(incoming)) die("research output must be a JSON array of rows");

// 1) Normalise: regenerate slug from item; stamp last_reviewed if missing.
incoming = incoming.map((r) => ({
  ...r,
  slug: slugify(r.item || ""),
  last_reviewed: r.last_reviewed || today,
}));

// 2) Pet sanity: every row's pet must exist with taxon + diet.
const petsInBatch = [...new Set(incoming.map((r) => r.pet))];
for (const slug of petsInBatch) {
  const p = pets.find((x) => x.slug === slug);
  if (!p) die(`pet '${slug}' is not in data/pets.json — add it (with taxon + diet) first`);
  if (!p.taxon || !p.diet) die(`pet '${slug}' is missing taxon/diet in data/pets.json`);
}

// 3) Structural validation.
const rowErrs = incoming.flatMap((r) => validateRow(r, petSlugs));
if (rowErrs.length) die(`row validation failed:\n${rowErrs.join("\n")}`);

// 4) Master-list: which incoming slugs are not yet canonical foods?
const foodSlugs = new Set(foods.map((f) => f.slug));
const newFoods = [];
const seenNew = new Set();
for (const r of incoming) {
  if (!foodSlugs.has(r.slug) && !seenNew.has(r.slug)) {
    seenNew.add(r.slug);
    newFoods.push({ slug: r.slug, name: r.item, category: r.category, aliases: [] });
  }
}
if (newFoods.length) {
  console.log(`NEW FOODS NOT IN MASTER (${newFoods.length}): ${newFoods.map((f) => f.slug).join(", ")}`);
  if (!allowNewFoods) {
    die("re-run with --allow-new-foods to add these to data/foods.json (reviewed action)");
  }
  const merged = [...foods, ...newFoods].sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(`${root}/data/foods.json`, JSON.stringify(merged, null, 2) + "\n");
  newFoods.forEach((f) => foodSlugs.add(f.slug));
  foods.length = 0;
  foods.push(...merged);
  console.log(`Added ${newFoods.length} new food(s) to data/foods.json.`);
}

// 5) Master-list gate (category coherence) on the incoming rows.
const foodErrs = validateAgainstFoods(incoming, foods);
if (foodErrs.length) die(`master-list gate failed:\n${foodErrs.join("\n")}`);

// 6) Source-domain warnings (advisory).
const domainWarnings = validateSourceDomains(incoming, pets, sources);
if (domainWarnings.length) {
  console.log(`\nSource-domain warnings (${domainWarnings.length}) — verify these hosts belong in sources.json:`);
  domainWarnings.forEach((w) => console.log(`  ${w}`));
}

// 7) Merge: append new rows (skip existing pet/slug), keep existing data in place.
const existing = new Set(items.map((r) => `${r.pet}/${r.slug}`));
const toAdd = [];
let skipped = 0;
for (const r of incoming) {
  const key = `${r.pet}/${r.slug}`;
  if (existing.has(key)) { skipped++; continue; }
  existing.add(key);
  toAdd.push(r);
}
toAdd.sort((a, b) => a.pet.localeCompare(b.pet) || a.slug.localeCompare(b.slug));
const merged = [...items, ...toAdd];
writeFileSync(`${root}/data/items.json`, JSON.stringify(merged, null, 2) + "\n");
console.log(`\nMerged: ${toAdd.length} new rows added, ${skipped} duplicate(s) skipped. Total now ${merged.length}.`);

// 8) Coverage report per pet in the batch (the SEO completeness signal).
const total = foods.length;
console.log("\nCoverage vs master food list:");
for (const slug of petsInBatch) {
  const covered = new Set(merged.filter((r) => r.pet === slug).map((r) => r.slug));
  const missing = foods.filter((f) => !covered.has(f.slug)).map((f) => f.slug);
  console.log(`  ${slug}: ${covered.size}/${total} foods covered (${missing.length} missing)`);
  if (missing.length) console.log(`    missing e.g.: ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? " …" : ""}`);
}

console.log("\nNext: `npm test`, then `npm run verify-sources`, then `npm run build`.");
