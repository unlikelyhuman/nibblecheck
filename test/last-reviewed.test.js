import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isValidReviewDate } from "../src/lib/validate.js";

const items = JSON.parse(readFileSync(new URL("../data/items.json", import.meta.url)));

test("every item has a valid, non-future last_reviewed date", () => {
  const bad = items.filter((r) => !isValidReviewDate(r.last_reviewed));
  assert.deepEqual(
    bad.map((r) => `${r.pet}/${r.slug}: ${r.last_reviewed}`),
    [],
  );
});
