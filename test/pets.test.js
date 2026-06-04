import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIETS } from "../src/lib/validate.js";

const pets = JSON.parse(readFileSync(new URL("../data/pets.json", import.meta.url)));
const sources = JSON.parse(readFileSync(new URL("../data/sources.json", import.meta.url)));
const taxa = new Set(Object.keys(sources));

test("every pet has a taxon present in sources.json", () => {
  for (const p of pets) {
    assert.ok(taxa.has(p.taxon), `pet '${p.slug}' taxon '${p.taxon}' not in sources.json`);
  }
});
test("every pet has a valid diet", () => {
  for (const p of pets) {
    assert.ok(DIETS.has(p.diet), `pet '${p.slug}' diet '${p.diet}' invalid`);
  }
});
