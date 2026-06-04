# NibbleCheck research-agent prompt template

Use this to generate a sourced food-safety dataset for ONE new animal, then feed the output to
`npm run ingest -- <output.json>`. The doctrine is non-negotiable: **every verdict except `ask_vet`
must cite a real, currently-live authoritative source whose host is in the taxon allowlist.** Never
invent data; never reuse another taxon's sources. Prefer the broadened-but-authoritative sourcing
standard (comparative toxicology + species/vet sources), so few rows land in `ask_vet`.

## How to dispatch
1. Pick the animal and confirm its `taxon` + `diet` (add a `data/pets.json` entry first if new).
2. Copy the allowlist for that taxon from `data/sources.json` into the prompt (`{{ALLOWED_DOMAINS}}`).
3. Paste the master food list (`node -e "console.log(JSON.parse(require('fs').readFileSync('data/foods.json')).map(f=>f.slug).join(', '))"`) as the coverage worklist so the agent works real foods, not padding.
4. Run the prompt; save the JSON array; `npm run ingest -- out.json` (add `--allow-new-foods` only if you reviewed the new foods).

## Prompt

> You are a veterinary-nutrition research agent for **NibbleCheck**, a pet food-safety site. Every
> verdict you output (except `ask_vet`) MUST be backed by a real, currently-live authoritative source
> whose host is in the ALLOWED SOURCES list below. Do NOT invent sources or guess.
>
> **Animal:** `{{PET_NAME}}` (slug `{{PET_SLUG}}`) — taxon **`{{TAXON}}`**, diet **`{{DIET}}`**.
> Respect the diet class: e.g. obligate carnivores/insectivores → most plant foods are `never`;
> herbivores → meat/dairy `never`; reptiles can't digest dairy; birds → avocado/chocolate toxic.
>
> **ALLOWED SOURCES (this taxon only):** `{{ALLOWED_DOMAINS}}`
> Cite only these hosts. If the only support you can find is off-list, mark the row `ask_vet`.
>
> **Work through this master food list** (cover as many as genuinely apply; skip foods that make no
> sense for this animal rather than padding): `{{MASTER_FOOD_SLUGS}}`
>
> **For each food:** do real web research, open and confirm the source page supports the verdict, then
> output one object. Verdict ∈ `safe | moderation | never | ask_vet`. Category ∈ `vegetable, fruit,
> leafy-green, herb, flower, grain, seed, nut, protein, dairy, household, other` — and for any food
> already in the master list, use ITS category.
>
> **Output:** a single JSON array, one object per food, EXACT keys:
> ```json
> {
>   "pet": "{{PET_SLUG}}",
>   "item": "Bell pepper",
>   "category": "vegetable",
>   "verdict": "safe",
>   "reason": "1–2 plain, confident sentences a pet owner can act on.",
>   "quantity": "A few thin slices, or empty string",
>   "frequency": "Daily | Occasional | Never, or empty string",
>   "warning_signs": "symptoms if relevant, else empty string",
>   "source_name": "VCA Animal Hospitals",
>   "source_url": "https://vcahospitals.com/... (real, verified, host in allowlist)",
>   "last_reviewed": "YYYY-MM-DD"
> }
> ```
> Omit `slug` — ingest regenerates it from `item`. For `never`/`moderation`/`safe`, `source_url` is
> REQUIRED and must resolve. Keep `ask_vet` only when genuinely uncertain after real research.

## After generation
`npm run ingest -- out.json` validates structure, rejects foods not in the master list (unless
`--allow-new-foods`), warns on off-allowlist hosts, merges, and prints a coverage report. Then
`npm test` → `npm run verify-sources` → `npm run build` → headless-verify → deploy (push to `main`).
See [[nibblecheck-seo-quality-doctrine]]: quality-gated batches, watch Search Console before the next.
