import { test } from "node:test";
import assert from "node:assert/strict";
import { validateRow, validateCollection } from "../src/lib/validate.js";

const ok = {
  pet: "guinea-pig", item: "Bell pepper", slug: "bell-pepper",
  category: "vegetable", verdict: "safe", reason: "Vitamin C.",
  quantity: "A few slices", frequency: "Daily", warning_signs: "",
  source_name: "RSPCA", source_url: "https://www.rspca.org.uk/x",
};

test("accepts a valid row", () => {
  assert.deepEqual(validateRow(ok, ["guinea-pig"]), []);
});
test("rejects unknown verdict", () => {
  const errs = validateRow({ ...ok, verdict: "maybe" }, ["guinea-pig"]);
  assert.ok(errs.some((e) => e.includes("verdict")));
});
test("requires source unless verdict is ask_vet", () => {
  const errs = validateRow({ ...ok, source_name: "", source_url: "" }, ["guinea-pig"]);
  assert.ok(errs.some((e) => e.includes("source")));
  const okAskVet = validateRow(
    { ...ok, verdict: "ask_vet", source_name: "", source_url: "" }, ["guinea-pig"]);
  assert.deepEqual(okAskVet, []);
});
test("rejects pet not in known list", () => {
  const errs = validateRow({ ...ok, pet: "dragon" }, ["guinea-pig"]);
  assert.ok(errs.some((e) => e.includes("pet")));
});
test("collection flags duplicate pet+slug", () => {
  const errs = validateCollection([ok, { ...ok }], ["guinea-pig"]);
  assert.ok(errs.some((e) => e.includes("duplicate")));
});
