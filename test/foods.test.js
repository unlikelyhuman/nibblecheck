import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateFoods } from "../src/lib/validate.js";

const foods = JSON.parse(readFileSync(new URL("../data/foods.json", import.meta.url)));

test("foods.json is non-empty", () => {
  assert.ok(Array.isArray(foods) && foods.length > 0);
});
test("foods.json passes integrity (slug===slugify(name), valid category, no dupes)", () => {
  const errs = validateFoods(foods);
  assert.deepEqual(errs, [], errs.join("\n"));
});
test("foods are sorted by slug for stable diffs", () => {
  const sorted = [...foods].sort((a, b) => a.slug.localeCompare(b.slug));
  assert.deepEqual(foods.map((f) => f.slug), sorted.map((f) => f.slug));
});
