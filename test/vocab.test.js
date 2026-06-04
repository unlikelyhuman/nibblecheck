import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const items = JSON.parse(readFileSync(new URL("../data/items.json", import.meta.url)));
const foods = JSON.parse(readFileSync(new URL("../data/foods.json", import.meta.url)));
const vocab = JSON.parse(readFileSync(new URL("../data/food-aliases.json", import.meta.url)));

const deprecated = new Set([...Object.keys(vocab.merges), ...vocab.drop]);

test("no item uses a deprecated (merged or dropped) slug", () => {
  const bad = items.filter((r) => deprecated.has(r.slug)).map((r) => `${r.pet}/${r.slug}`);
  assert.deepEqual(bad, []);
});

test("no food uses a deprecated slug", () => {
  const bad = foods.filter((f) => deprecated.has(f.slug)).map((f) => f.slug);
  assert.deepEqual(bad, []);
});

// Guard against generic catch-all buckets creeping back into the vocabulary.
const BUCKET_RE = /^(fresh|other|sugary|fatty|misc)-|-foods$|-mixes?$|-any$|table-foods/;
test("no food slug matches a generic-bucket pattern", () => {
  const bad = foods.filter((f) => BUCKET_RE.test(f.slug)).map((f) => f.slug);
  assert.deepEqual(bad, [], `bucket-like food slugs: ${bad.join(", ")}`);
});

test("every merge target is itself a real canonical food", () => {
  const foodSlugs = new Set(foods.map((f) => f.slug));
  const missing = [...new Set(Object.values(vocab.merges))].filter((t) => !foodSlugs.has(t));
  assert.deepEqual(missing, [], `merge targets absent from foods.json: ${missing.join(", ")}`);
});
