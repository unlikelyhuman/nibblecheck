import { test } from "node:test";
import assert from "node:assert/strict";
import {
  qaPageSchema,
  breadcrumbSchema,
  faqPageSchema,
  websiteSchema,
  organizationSchema,
} from "../src/lib/schema.js";

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

test("QAPage omits dateModified without last_reviewed, includes it with one", () => {
  assert.equal(JSON.parse(qaPageSchema(row, "q")).dateModified, undefined);
  const dated = JSON.parse(qaPageSchema({ ...row, last_reviewed: "2026-06-04" }, "q"));
  assert.equal(dated.dateModified, "2026-06-04");
  assert.equal(dated.datePublished, "2026-06-04");
});

test("breadcrumbSchema numbers positions from 1", () => {
  const obj = JSON.parse(breadcrumbSchema([
    { name: "NibbleCheck", url: "https://x/" },
    { name: "Guinea Pig", url: "https://x/guinea-pig/" },
  ]));
  assert.equal(obj["@type"], "BreadcrumbList");
  assert.equal(obj.itemListElement.length, 2);
  assert.equal(obj.itemListElement[0].position, 1);
  assert.equal(obj.itemListElement[1].name, "Guinea Pig");
});

test("faqPageSchema builds Question/Answer entries", () => {
  const obj = JSON.parse(faqPageSchema([
    { q: "Can guinea pigs eat bell pepper?", a: "Yes, in appropriate amounts. High in vitamin C." },
  ]));
  assert.equal(obj["@type"], "FAQPage");
  assert.equal(obj.mainEntity[0]["@type"], "Question");
  assert.ok(obj.mainEntity[0].acceptedAnswer.text.includes("vitamin C"));
});

test("website + organization schema carry the brand URL", () => {
  const w = JSON.parse(websiteSchema());
  const o = JSON.parse(organizationSchema());
  assert.equal(w["@type"], "WebSite");
  assert.equal(o["@type"], "Organization");
  assert.match(w.url, /^https?:\/\//);
  assert.equal(o.url, w.url);
});
