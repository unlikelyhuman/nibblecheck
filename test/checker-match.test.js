import { test } from "node:test";
import assert from "node:assert/strict";
import { matchFood } from "../assets/checker.js";

const data = [
  { pet: "guinea-pig", item: "Bell pepper", slug: "bell-pepper", verdict: "safe", reason: "x" },
  { pet: "guinea-pig", item: "Onion", slug: "onion", verdict: "never", reason: "y" },
  { pet: "rabbit", item: "Bell pepper", slug: "bell-pepper", verdict: "safe", reason: "z" },
];

test("exact match within selected pet", () => {
  const m = matchFood(data, "guinea-pig", "bell pepper");
  assert.equal(m.exact.slug, "bell-pepper");
  assert.equal(m.exact.pet, "guinea-pig");
});
test("partial matches become suggestions", () => {
  const m = matchFood(data, "guinea-pig", "on");
  assert.ok(m.suggestions.some((s) => s.slug === "onion"));
});
test("no match returns ask_vet fallback", () => {
  const m = matchFood(data, "guinea-pig", "plutonium");
  assert.equal(m.exact, null);
  assert.equal(m.suggestions.length, 0);
});
