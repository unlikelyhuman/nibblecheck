import { readFileSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { site } from "../site.config.js";
import { validateCollection, validateAgainstFoods, validateSourceDomains } from "./lib/validate.js";
import {
  renderItemPage, renderPetIndex, renderHome, renderCheckerPage,
} from "./lib/render.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = `${root}/dist`;

function writePage(relPath, html) {
  const full = `${OUT}/${relPath}`;
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
}

export async function build() {
  const pets = JSON.parse(readFileSync(`${root}/data/pets.json`));
  const items = JSON.parse(readFileSync(`${root}/data/items.json`));
  const foods = JSON.parse(readFileSync(`${root}/data/foods.json`));
  const sources = JSON.parse(readFileSync(`${root}/data/sources.json`));
  const petSlugs = pets.map((p) => p.slug);

  const errs = validateCollection(items, petSlugs);
  if (errs.length) throw new Error(`Dataset invalid:\n${errs.join("\n")}`);

  // Hard gate: every published verdict maps to a canonical food (same category).
  const foodErrs = validateAgainstFoods(items, foods);
  if (foodErrs.length) throw new Error(`Master-list gate failed:\n${foodErrs.join("\n")}`);

  // Soft gate: source hosts should match the pet's taxon allowlist (warn, don't block).
  const domainWarnings = validateSourceDomains(items, pets, sources);
  if (domainWarnings.length) {
    console.warn(`Source-domain warnings (${domainWarnings.length}):\n${domainWarnings.join("\n")}`);
  }

  mkdirSync(OUT, { recursive: true });

  // Newest review date across all data — used as lastmod for the home/checker pages.
  const maxDate = (rows) => rows.reduce((m, r) => (r.last_reviewed > m ? r.last_reviewed : m), "");
  const siteMax = maxDate(items);
  const urls = [
    { loc: `${site.baseUrl}/`, lastmod: siteMax },
    { loc: `${site.baseUrl}/checker/`, lastmod: siteMax },
  ];

  // Content-hash of the dataset — busts the browser cache of checker-data.json
  // and checker.js whenever the data actually changes.
  const version = createHash("sha1").update(JSON.stringify(items)).digest("hex").slice(0, 10);

  writePage("index.html", renderHome(pets, version));
  writePage("checker/index.html", renderCheckerPage(pets, version));

  let pageCount = 0;
  for (const pet of pets) {
    const rows = items.filter((r) => r.pet === pet.slug);
    writePage(`${pet.slug}/index.html`, renderPetIndex(pet, rows));
    urls.push({ loc: `${site.baseUrl}/${pet.slug}/`, lastmod: maxDate(rows) });
    for (const row of rows) {
      const related = rows.filter((r) => r.slug !== row.slug && r.category === row.category).slice(0, 6);
      writePage(`${pet.slug}/${row.slug}/index.html`, renderItemPage(pet, row, related));
      urls.push({ loc: `${site.baseUrl}/${pet.slug}/${row.slug}/`, lastmod: row.last_reviewed });
      pageCount++;
    }
  }

  // Client payload: only the fields the checker needs.
  const checkerData = items.map((r) => ({
    pet: r.pet, item: r.item, slug: r.slug, verdict: r.verdict, reason: r.reason,
  }));
  writeFileSync(`${OUT}/checker-data.json`, JSON.stringify(checkerData));

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}</url>`).join("\n")}
</urlset>`;
  writeFileSync(`${OUT}/sitemap.xml`, sitemap);
  writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`);

  copyFileSync(`${root}/assets/styles.css`, `${OUT}/styles.css`);
  copyFileSync(`${root}/assets/checker.js`, `${OUT}/checker.js`);

  return { pageCount, urlCount: urls.length };
}

// Allow `node src/build.js` (pathToFileURL handles spaces in the path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().then((r) => console.log(`Built ${r.pageCount} item pages, ${r.urlCount} urls.`));
}
