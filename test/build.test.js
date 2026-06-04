import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "../src/build.js";

test("build emits pages, sitemap and checker data", async () => {
  const out = fileURLToPath(new URL("../dist/", import.meta.url));
  rmSync(out, { recursive: true, force: true });
  const result = await build();
  assert.ok(result.pageCount >= 15);
  assert.ok(existsSync(`${out}index.html`));
  assert.ok(existsSync(`${out}guinea-pig/index.html`));
  assert.ok(existsSync(`${out}guinea-pig/bell-pepper/index.html`));
  assert.ok(existsSync(`${out}checker/index.html`));
  assert.ok(existsSync(`${out}sitemap.xml`));
  assert.ok(existsSync(`${out}checker-data.json`));
  assert.ok(existsSync(`${out}styles.css`));
  assert.ok(existsSync(`${out}checker.js`));
  const data = JSON.parse(readFileSync(`${out}checker-data.json`));
  assert.ok(Array.isArray(data) && data[0].verdict);
  const sitemap = readFileSync(`${out}sitemap.xml`, "utf8");
  assert.match(sitemap, /guinea-pig\/bell-pepper/);

  // SEO-depth must not add pages: URL count stays fixed.
  assert.equal(result.urlCount, 814, "URL count must stay 814 (no new page types)");

  // Hub page carries FAQPage + BreadcrumbList; item page carries dateModified.
  const hub = readFileSync(`${out}guinea-pig/index.html`, "utf8");
  assert.match(hub, /"@type":"FAQPage"/);
  assert.match(hub, /"@type":"BreadcrumbList"/);
  assert.match(hub, /toxic-list/);
  const item = readFileSync(`${out}guinea-pig/bell-pepper/index.html`, "utf8");
  assert.match(item, /"@type":"BreadcrumbList"/);
  assert.match(item, /"dateModified"/);
});
