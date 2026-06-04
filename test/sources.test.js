import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sources = JSON.parse(readFileSync(new URL("../data/sources.json", import.meta.url)));

const TAXA = ["small-mammal", "bird", "reptile"];

test("sources.json has exactly the expected taxa", () => {
  assert.deepEqual(Object.keys(sources).sort(), [...TAXA].sort());
});

test("each taxon has a non-empty, well-formed allowlist", () => {
  for (const t of TAXA) {
    const reg = sources[t];
    assert.ok(Array.isArray(reg.allowed_domains) && reg.allowed_domains.length > 0, `${t} allowed_domains`);
    for (const d of reg.allowed_domains) {
      assert.equal(d, d.toLowerCase(), `domain not lowercase: ${d}`);
      assert.doesNotMatch(d, /:\/\/|\/|^www\.|\s/, `domain not a bare host: ${d}`);
    }
  }
});

test("authorities are a subset of allowed_domains", () => {
  for (const t of TAXA) {
    const reg = sources[t];
    const allowed = new Set(reg.allowed_domains);
    for (const a of reg.authorities) {
      assert.ok(a.name && a.domain, `authority needs name+domain in ${t}`);
      assert.ok(allowed.has(a.domain), `authority domain '${a.domain}' not in ${t} allowed_domains`);
    }
  }
});
