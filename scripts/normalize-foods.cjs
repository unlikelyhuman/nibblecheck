#!/usr/bin/env node
// One-off: normalize data/items.json to the canonical food vocabulary in data/food-aliases.json.
// Applies merges (re-slug + canonical name/category), drops generic-bucket rows, and de-dupes the
// resulting pet/slug collisions. If two colliding rows DISAGREE on verdict, it aborts (non-zero) so a
// human resolves it — safety verdicts are never silently dropped. Safe to delete after the run.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const FILE = path.join(root, "data", "items.json");
const aliases = JSON.parse(fs.readFileSync(path.join(root, "data", "food-aliases.json"), "utf8"));
const { merges, canonical, drop } = aliases;
const dropSet = new Set(drop);

// Sanity: every merge target must have a canonical name/category.
for (const target of new Set(Object.values(merges))) {
  if (!canonical[target]) {
    console.error(`ERROR: merge target '${target}' missing from canonical{}`);
    process.exit(1);
  }
}

const items = JSON.parse(fs.readFileSync(FILE, "utf8"));
const removed = [];
const reslugged = [];
const kept = [];

for (const row of items) {
  if (dropSet.has(row.slug)) {
    removed.push(`${row.pet}/${row.slug}`);
    continue;
  }
  if (merges[row.slug]) {
    const target = merges[row.slug];
    reslugged.push(`${row.pet}/${row.slug} -> ${target}`);
    row.slug = target;
  }
  // Normalise name/category for any row now sitting on a canonical slug.
  if (canonical[row.slug]) {
    row.item = canonical[row.slug].name;
    row.category = canonical[row.slug].category;
  }
  kept.push(row);
}

// Detect pet/slug collisions created by merging.
const byKey = new Map();
for (const row of kept) {
  const key = `${row.pet}/${row.slug}`;
  if (!byKey.has(key)) byKey.set(key, []);
  byKey.get(key).push(row);
}

const conflicts = [];
const mergedDupes = [];
const final = [];
for (const [key, rows] of byKey) {
  if (rows.length === 1) {
    final.push(rows[0]);
    continue;
  }
  const verdicts = new Set(rows.map((r) => r.verdict));
  if (verdicts.size > 1) {
    conflicts.push(`${key}: conflicting verdicts ${[...verdicts].join(", ")}`);
    continue;
  }
  // Same verdict — keep the most-specific row (has source, longest reason).
  rows.sort((a, b) => (b.source_url ? 1 : 0) - (a.source_url ? 1 : 0) || (b.reason || "").length - (a.reason || "").length);
  final.push(rows[0]);
  mergedDupes.push(`${key}: ${rows.length} rows -> 1 (verdict ${rows[0].verdict})`);
}

console.log(`Removed (dropped buckets/staples): ${removed.length}`);
removed.forEach((r) => console.log(`  - ${r}`));
console.log(`\nRe-slugged (merged variants): ${reslugged.length}`);
console.log(`\nSame-verdict collisions de-duped: ${mergedDupes.length}`);
mergedDupes.forEach((m) => console.log(`  - ${m}`));

if (conflicts.length) {
  console.error(`\nABORT: ${conflicts.length} collision(s) with CONFLICTING verdicts — resolve by hand first:`);
  conflicts.forEach((c) => console.error(`  - ${c}`));
  process.exit(1);
}

fs.writeFileSync(FILE, JSON.stringify(final, null, 2) + "\n");
console.log(`\nWrote ${final.length} rows (was ${items.length}). Net removed ${items.length - final.length}.`);
