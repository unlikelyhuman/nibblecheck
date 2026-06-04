import { slugify } from "./slugify.js";

export const VERDICTS = new Set(["safe", "moderation", "never", "ask_vet"]);
export const CATEGORIES = new Set([
  "vegetable", "fruit", "leafy-green", "herb", "flower", "grain", "seed",
  "nut", "protein", "dairy", "household", "other",
]);
export const DIETS = new Set(["herbivore", "omnivore", "obligate-carnivore", "insectivore"]);
const REQUIRED = ["pet", "item", "slug", "category", "verdict", "reason", "last_reviewed"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateRow(row, knownPets) {
  const errs = [];
  for (const f of REQUIRED) {
    if (!row[f] || String(row[f]).trim() === "") errs.push(`missing ${f}`);
  }
  if (row.verdict && !VERDICTS.has(row.verdict)) errs.push(`bad verdict: ${row.verdict}`);
  if (row.category && !CATEGORIES.has(row.category)) errs.push(`bad category: ${row.category}`);
  if (row.pet && !knownPets.includes(row.pet)) errs.push(`unknown pet: ${row.pet}`);
  if (row.last_reviewed && !isValidReviewDate(row.last_reviewed)) {
    errs.push(`bad last_reviewed: ${row.last_reviewed}`);
  }
  if (row.verdict !== "ask_vet") {
    if (!row.source_name || !row.source_url) {
      errs.push(`missing source for ${row.item} (${row.verdict})`);
    }
  }
  return errs.map((e) => `[${row.pet}/${row.slug || row.item}] ${e}`);
}

export function validateCollection(rows, knownPets) {
  const errs = [];
  const seen = new Set();
  for (const row of rows) {
    errs.push(...validateRow(row, knownPets));
    const key = `${row.pet}/${row.slug}`;
    if (seen.has(key)) errs.push(`duplicate row: ${key}`);
    seen.add(key);
  }
  return errs;
}

// A YYYY-MM-DD string that is a real calendar date and not in the future.
export function isValidReviewDate(value, today = new Date()) {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  if (d.toISOString().slice(0, 10) !== value) return false; // rejects e.g. 2026-02-31
  return d.getTime() <= today.getTime();
}

// Hard gate: every row's slug must map to a canonical food with a matching category.
export function validateAgainstFoods(rows, foods) {
  const bySlug = new Map(foods.map((f) => [f.slug, f]));
  const errs = [];
  for (const row of rows) {
    const f = bySlug.get(row.slug);
    if (!f) {
      errs.push(`[${row.pet}/${row.slug}] not in foods.json`);
      continue;
    }
    if (f.category !== row.category) {
      errs.push(`[${row.pet}/${row.slug}] category '${row.category}' != master '${f.category}'`);
    }
  }
  return errs;
}

export function hostOf(url) {
  try {
    return new URL(url).host.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Suffix match: host equals the domain or is a subdomain of it.
export function isDomainAllowed(host, allowedDomains) {
  if (!host) return false;
  return allowedDomains.some((d) => host === d || host.endsWith(`.${d}`));
}

// Soft gate (warnings): each non-ask_vet source host should be allow-listed for the pet's taxon.
export function validateSourceDomains(rows, pets, sources) {
  const taxonOf = new Map(pets.map((p) => [p.slug, p.taxon]));
  const warnings = [];
  for (const row of rows) {
    if (row.verdict === "ask_vet" || !row.source_url) continue;
    const taxon = taxonOf.get(row.pet);
    const reg = sources[taxon];
    const allowed = reg ? reg.allowed_domains : [];
    const h = hostOf(row.source_url);
    if (!isDomainAllowed(h, allowed)) {
      warnings.push(`[${row.pet}/${row.slug}] source host '${h}' not in '${taxon}' allowlist`);
    }
  }
  return warnings;
}

// Advisory report (never fatal): flags verdict distributions implausible for a pet's diet class.
export function verdictDistributionReport(rows, pets) {
  const dietOf = new Map(pets.map((p) => [p.slug, p.diet]));
  const byPet = {};
  for (const r of rows) {
    (byPet[r.pet] ||= { safe: 0, moderation: 0, never: 0, ask_vet: 0, total: 0 });
    if (byPet[r.pet][r.verdict] !== undefined) byPet[r.pet][r.verdict]++;
    byPet[r.pet].total++;
  }
  const report = [];
  for (const [pet, c] of Object.entries(byPet)) {
    const diet = dietOf.get(pet);
    const pct = (v) => (c.total ? c[v] / c.total : 0);
    const warn = [];
    if (diet === "obligate-carnivore" || diet === "insectivore") {
      if (pct("never") < 0.4) warn.push(`expected never-heavy (>40%) for ${diet}, got ${Math.round(pct("never") * 100)}%`);
    } else if (diet === "herbivore") {
      if (pct("never") > 0.55) warn.push(`never-heavy ${Math.round(pct("never") * 100)}% (>55%) for herbivore`);
    } else if (diet === "omnivore") {
      for (const v of ["safe", "moderation", "never"]) {
        if (pct(v) > 0.7) warn.push(`${v} ${Math.round(pct(v) * 100)}% (>70%) skew for omnivore`);
      }
    }
    report.push({
      pet,
      diet,
      counts: { safe: c.safe, moderation: c.moderation, never: c.never, ask_vet: c.ask_vet, total: c.total },
      warn,
    });
  }
  return report;
}

// Assert slug/name/category coherence for the canonical food list.
export function validateFoods(foods) {
  const errs = [];
  const seen = new Set();
  for (const f of foods) {
    if (!f.slug || !f.name || !f.category) {
      errs.push(`food missing field: ${JSON.stringify(f)}`);
      continue;
    }
    if (slugify(f.name) !== f.slug) errs.push(`[${f.slug}] slug != slugify(name '${f.name}')`);
    if (!CATEGORIES.has(f.category)) errs.push(`[${f.slug}] bad category: ${f.category}`);
    if (seen.has(f.slug)) errs.push(`duplicate food slug: ${f.slug}`);
    seen.add(f.slug);
  }
  return errs;
}
