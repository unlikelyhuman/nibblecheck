import { test } from "node:test";
import assert from "node:assert/strict";
import { renderItemPage, questionFor } from "../src/lib/render.js";

const pet = { slug: "guinea-pig", name: "Guinea Pig", name_plural: "guinea pigs" };
const row = {
  pet: "guinea-pig", item: "Bell pepper", slug: "bell-pepper",
  category: "vegetable", verdict: "safe", reason: "High in vitamin C.",
  quantity: "A few slices", frequency: "Daily", warning_signs: "Soft stool if overfed",
  source_name: "RSPCA", source_url: "https://www.rspca.org.uk/x",
};

test("questionFor builds the search phrase", () => {
  assert.equal(questionFor(pet, row), "Can guinea pigs eat bell pepper?");
});
test("item page contains verdict, reason, source link and JSON-LD", () => {
  const html = renderItemPage(pet, row, []);
  assert.match(html, /Can guinea pigs eat bell pepper\?/);
  assert.match(html, /High in vitamin C/);
  assert.match(html, /rspca\.org\.uk/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /verdict--safe/);
});
test("ask_vet page renders without a source block", () => {
  const html = renderItemPage(pet, { ...row, verdict: "ask_vet", source_name: "", source_url: "" }, []);
  assert.match(html, /verdict--ask_vet/);
  assert.doesNotMatch(html, /Source:/);
});
