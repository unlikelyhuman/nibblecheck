const VERDICTS = new Set(["safe", "moderation", "never", "ask_vet"]);
const CATEGORIES = new Set([
  "vegetable", "fruit", "leafy-green", "herb", "flower", "grain", "seed",
  "nut", "protein", "dairy", "household", "other",
]);
const REQUIRED = ["pet", "item", "slug", "category", "verdict", "reason"];

export function validateRow(row, knownPets) {
  const errs = [];
  for (const f of REQUIRED) {
    if (!row[f] || String(row[f]).trim() === "") errs.push(`missing ${f}`);
  }
  if (row.verdict && !VERDICTS.has(row.verdict)) errs.push(`bad verdict: ${row.verdict}`);
  if (row.category && !CATEGORIES.has(row.category)) errs.push(`bad category: ${row.category}`);
  if (row.pet && !knownPets.includes(row.pet)) errs.push(`unknown pet: ${row.pet}`);
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
