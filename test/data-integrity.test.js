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
