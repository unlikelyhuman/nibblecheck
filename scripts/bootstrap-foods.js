// One-off generator for data/foods.json — the canonical food master list.
// Derives the list by deduping data/items.json on slug, resolving name- and
// category-conflicts deterministically. Idempotent: re-running yields byte-identical output.
//
//   npm run bootstrap-foods
//
// Category conflicts must be resolved via the committed OVERRIDES table below — a blind
// majority vote is unsafe (e.g. peanut-butter, seeds, cat-food). Any conflicting slug NOT in
// OVERRIDES causes a non-zero exit so a human commits a decision.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "../src/lib/slugify.js";
import { CATEGORIES } from "../src/lib/validate.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// Human-reviewed canonical category for every slug that appears with >1 category in items.json.
const OVERRIDES = {
  alcohol: "household",
  "apple-seeds": "seed",
  bread: "grain",
  cabbage: "vegetable",
  caffeine: "household",
  "cat-food": "protein",
  cheese: "dairy",
  chocolate: "household",
  "cooked-beans": "protein",
  corn: "vegetable",
  "dog-food": "protein",
  "fruit-pits-cherry-plum-apricot-peach": "seed",
  meat: "protein",
  nuts: "nut",
  "peanut-butter": "protein",
  seeds: "seed",
  tomato: "fruit",
  xylitol: "household",
};

const upperCount = (s) => (s.match(/[A-Z]/g) || []).length;

// Most frequent display name wins; on a tie prefer the sentence-case variant (fewer capitals).
function resolveName(nameCounts) {
  return Object.entries(nameCounts)
    .sort((a, b) => b[1] - a[1] || upperCount(a[0]) - upperCount(b[0]) || a[0].localeCompare(b[0]))[0][0];
}

function main() {
  const items = JSON.parse(readFileSync(`${root}/data/items.json`));
  // Reverse the normalization merge map so each canonical food records its deprecated aliases.
  let aliasMap = {};
  try {
    const { merges } = JSON.parse(readFileSync(`${root}/data/food-aliases.json`));
    for (const [from, to] of Object.entries(merges)) (aliasMap[to] ||= []).push(from);
    for (const k of Object.keys(aliasMap)) aliasMap[k].sort();
  } catch { /* aliases optional */ }

  const bySlug = new Map();
  for (const r of items) {
    if (!bySlug.has(r.slug)) bySlug.set(r.slug, { cats: {}, names: {} });
    const g = bySlug.get(r.slug);
    g.cats[r.category] = (g.cats[r.category] || 0) + 1;
    g.names[r.item] = (g.names[r.item] || 0) + 1;
  }

  let nameConflicts = 0;
  let catConflicts = 0;
  const unresolved = [];
  const foods = [];

  for (const [slug, g] of bySlug) {
    const cats = Object.keys(g.cats);
    const names = Object.keys(g.names);
    if (names.length > 1) nameConflicts++;
    const name = resolveName(g.names);

    let category;
    if (cats.length === 1) {
      category = cats[0];
    } else {
      catConflicts++;
      if (OVERRIDES[slug]) {
        category = OVERRIDES[slug];
      } else {
        unresolved.push(`${slug}: ${JSON.stringify(g.cats)}`);
        continue;
      }
    }

    if (slugify(name) !== slug) {
      console.error(`WARN ${slug}: slugify('${name}') = '${slugify(name)}' != slug; using slug as-is`);
    }
    if (!CATEGORIES.has(category)) {
      console.error(`ERROR ${slug}: resolved category '${category}' not in enum`);
      process.exit(1);
    }
    foods.push({ slug, name, category, aliases: aliasMap[slug] || [] });
  }

  if (unresolved.length) {
    console.error(`\nERROR: ${unresolved.length} category conflict(s) missing from OVERRIDES:`);
    unresolved.forEach((u) => console.error(`  - ${u}`));
    console.error("Add each to the OVERRIDES table in scripts/bootstrap-foods.js, then re-run.");
    process.exit(1);
  }

  foods.sort((a, b) => a.slug.localeCompare(b.slug));
  writeFileSync(`${root}/data/foods.json`, JSON.stringify(foods, null, 2) + "\n");
  console.log(
    `${foods.length} foods written. ${nameConflicts} name conflicts auto-resolved, ` +
      `${catConflicts} category conflicts (${catConflicts} resolved via OVERRIDES, 0 unresolved).`,
  );
}

main();
