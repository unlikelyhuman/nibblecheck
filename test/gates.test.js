import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hostOf,
  isDomainAllowed,
  isValidReviewDate,
  validateSourceDomains,
  verdictDistributionReport,
} from "../src/lib/validate.js";

test("hostOf strips www and lowercases; null on garbage", () => {
  assert.equal(hostOf("https://www.RSPCA.org.uk/x"), "rspca.org.uk");
  assert.equal(hostOf("https://kb.rspca.org.au/a/b"), "kb.rspca.org.au");
  assert.equal(hostOf("not a url"), null);
});

test("isDomainAllowed matches host and subdomains, not lookalikes", () => {
  assert.equal(isDomainAllowed("rspca.org.au", ["rspca.org.au"]), true);
  assert.equal(isDomainAllowed("kb.rspca.org.au", ["rspca.org.au"]), true);
  assert.equal(isDomainAllowed("healthtopics.vetmed.ucdavis.edu", ["ucdavis.edu"]), true);
  assert.equal(isDomainAllowed("notrspca.org.au", ["rspca.org.au"]), false);
  assert.equal(isDomainAllowed("evil.com", ["rspca.org.au"]), false);
  assert.equal(isDomainAllowed(null, ["rspca.org.au"]), false);
});

test("isValidReviewDate: format, real date, not future", () => {
  const today = new Date("2026-06-05T00:00:00Z");
  assert.equal(isValidReviewDate("2026-06-04", today), true);
  assert.equal(isValidReviewDate("2026-06-05", today), true);
  assert.equal(isValidReviewDate("2026-06-06", today), false); // future
  assert.equal(isValidReviewDate("2026-02-31", today), false); // not a real date
  assert.equal(isValidReviewDate("2026-6-4", today), false); // bad format
  assert.equal(isValidReviewDate("", today), false);
});

test("validateSourceDomains warns on off-allowlist hosts, skips ask_vet/no-source", () => {
  const pets = [{ slug: "p", taxon: "bird" }];
  const sources = { bird: { allowed_domains: ["lafeber.com"] } };
  const rows = [
    { pet: "p", slug: "ok", verdict: "safe", source_url: "https://lafeber.com/a" },
    { pet: "p", slug: "bad", verdict: "never", source_url: "https://random.com/b" },
    { pet: "p", slug: "av", verdict: "ask_vet", source_url: "" },
  ];
  const warns = validateSourceDomains(rows, pets, sources);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /p\/bad/);
  assert.match(warns[0], /random\.com/);
});

test("verdictDistributionReport flags implausible distributions by diet", () => {
  const pets = [
    { slug: "carn", diet: "obligate-carnivore" },
    { slug: "herb", diet: "herbivore" },
  ];
  const rows = [
    // carnivore but mostly 'safe' plants -> expected never-heavy, should warn
    { pet: "carn", verdict: "safe" },
    { pet: "carn", verdict: "safe" },
    { pet: "carn", verdict: "never" },
    // herbivore that is never-heavy (>55%) -> should warn
    { pet: "herb", verdict: "never" },
    { pet: "herb", verdict: "never" },
    { pet: "herb", verdict: "safe" },
  ];
  const report = verdictDistributionReport(rows, pets);
  const carn = report.find((r) => r.pet === "carn");
  const herb = report.find((r) => r.pet === "herb");
  assert.ok(carn.warn.length > 0, "carnivore should warn");
  assert.ok(herb.warn.length > 0, "never-heavy herbivore should warn");
  assert.equal(carn.counts.total, 3);
});
