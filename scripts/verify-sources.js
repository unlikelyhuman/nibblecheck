// Network-side source health check — run per batch and in CI (NOT part of `node --test`).
//
//   npm run verify-sources            # dead links fail the run; domain/distribution = warnings
//   npm run verify-sources -- --strict  # also fail on off-allowlist source hosts
//
// Checks the UNIQUE set of source_urls (HEAD, falling back to GET), reports non-2xx/3xx,
// then prints the source-domain allowlist report and the verdict-distribution advisory.
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSourceDomains, verdictDistributionReport } from "../src/lib/validate.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const strict = process.argv.includes("--strict");
const CONCURRENCY = 6;
const TIMEOUT_MS = 10000;
// A realistic UA cuts down anti-bot 403s from authoritative vet sites.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
// A genuinely dead resource: gone, or unreachable. 401/403/405/429/5xx mean "blocked/transient",
// not dead — those become warnings so live-but-bot-hostile authorities don't redden CI.
const DEAD_STATUSES = new Set([404, 410]);

async function fetchStatus(url) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method,
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*" },
      });
      clearTimeout(t);
      if (method === "HEAD" && [403, 405, 429, 501].includes(res.status)) continue; // retry as GET
      return res.status;
    } catch {
      if (method === "GET") return 0; // network error / timeout
    }
  }
  return 0;
}

function classify(status) {
  if (status >= 200 && status < 400) return "ok";
  if (status === 0 || DEAD_STATUSES.has(status)) return "dead";
  return "blocked"; // 401/403/429/5xx — live but refusing automated requests
}

async function checkUrl(url) {
  let status = await fetchStatus(url);
  if (classify(status) !== "ok") status = await fetchStatus(url); // one retry to absorb flakiness
  return { url, status, state: classify(status) };
}

async function mapPool(items, fn, size) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const items = JSON.parse(readFileSync(`${root}/data/items.json`));
  const pets = JSON.parse(readFileSync(`${root}/data/pets.json`));
  const sources = JSON.parse(readFileSync(`${root}/data/sources.json`));

  // 1) Dead-link check over the UNIQUE url set.
  const urlToRows = new Map();
  for (const r of items) {
    if (!r.source_url) continue;
    if (!urlToRows.has(r.source_url)) urlToRows.set(r.source_url, []);
    urlToRows.get(r.source_url).push(`${r.pet}/${r.slug}`);
  }
  const urls = [...urlToRows.keys()];
  console.log(`Checking ${urls.length} unique source URLs (concurrency ${CONCURRENCY})...`);
  const results = await mapPool(urls, checkUrl, CONCURRENCY);
  const dead = results.filter((r) => r.state === "dead");
  const blocked = results.filter((r) => r.state === "blocked");
  const okCount = results.length - dead.length - blocked.length;
  console.log(`${okCount}/${urls.length} OK, ${dead.length} dead, ${blocked.length} blocked (live but bot-hostile).`);
  for (const d of dead) {
    console.log(`  DEAD (${d.status}) ${d.url}\n    used by: ${urlToRows.get(d.url).join(", ")}`);
  }
  for (const b of blocked) {
    console.log(`  BLOCKED (${b.status}) ${b.url} — likely anti-bot, verify manually if recently added`);
  }

  // 2) Source-domain allowlist report.
  const domainWarnings = validateSourceDomains(items, pets, sources);
  console.log(`\nSource-domain allowlist: ${domainWarnings.length} off-allowlist host(s).`);
  for (const w of domainWarnings) console.log(`  ${w}`);

  // 3) Verdict-distribution advisory.
  console.log("\nVerdict-distribution advisory (WARN-only):");
  for (const row of verdictDistributionReport(items, pets)) {
    if (row.warn.length) {
      const c = row.counts;
      console.log(`  WARN ${row.pet} (${row.diet}) safe=${c.safe} mod=${c.moderation} never=${c.never} of ${c.total}`);
      row.warn.forEach((w) => console.log(`       - ${w}`));
    }
  }

  // Exit policy: genuinely dead links (404/410/unreachable) always fail; off-allowlist hosts
  // fail only with --strict. Blocked (bot-hostile but live) and distribution are advisory.
  const failures = dead.length + (strict ? domainWarnings.length : 0);
  if (failures > 0) {
    console.error(`\nFAILED: ${dead.length} dead link(s)${strict ? `, ${domainWarnings.length} off-allowlist host(s)` : ""}.`);
    process.exit(1);
  }
  console.log(`\nverify-sources passed${blocked.length ? ` (${blocked.length} blocked host(s) treated as advisory)` : ""}.`);
}

main();
