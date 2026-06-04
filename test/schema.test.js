import { test } from "node:test";
import assert from "node:assert/strict";
import { qaPageSchema } from "../src/lib/schema.js";

const row = {
  pet: "guinea-pig", item: "Bell pepper", verdict: "safe",
  reason: "High in vitamin C.", source_name: "RSPCA",
  source_url: "https://www.rspca.org.uk/x",
};

test("produces valid QAPage JSON-LD", () => {
  const obj = JSON.parse(qaPageSchema(row, "Can guinea pigs eat bell pepper?"));
  assert.equal(obj["@type"], "QAPage");
  assert.equal(obj.mainEntity["@type"], "Question");
  assert.ok(obj.mainEntity.acceptedAnswer.text.includes("vitamin C"));
});
