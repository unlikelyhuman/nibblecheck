import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateAgainstFoods } from "../src/lib/validate.js";

const items = JSON.parse(readFileSync(new URL("../data/items.json", import.meta.url)));
const foods = JSON.parse(readFileSync(new URL("../data/foods.json", import.meta.url)));

test("every item maps to a canonical food with a matching category", () => {
  const errs = validateAgainstFoods(items, foods);
  assert.deepEqual(errs, [], errs.join("\n"));
});
