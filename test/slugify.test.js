import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/lib/slugify.js";

test("lowercases and hyphenates", () => {
  assert.equal(slugify("Bell Pepper"), "bell-pepper");
});
test("strips punctuation and apostrophes", () => {
  assert.equal(slugify("Cat's claw (root)"), "cats-claw-root");
});
test("collapses repeated separators and trims", () => {
  assert.equal(slugify("  Spring  --  Onion  "), "spring-onion");
});
