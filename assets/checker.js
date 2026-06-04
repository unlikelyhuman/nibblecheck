export function matchFood(data, pet, query) {
  const q = query.trim().toLowerCase();
  const pool = data.filter((r) => r.pet === pet);
  if (!q) return { exact: null, suggestions: [] };
  const exact = pool.find((r) => r.item.toLowerCase() === q || r.slug === q) || null;
  const suggestions = exact
    ? []
    : pool.filter((r) => r.item.toLowerCase().includes(q)).slice(0, 8);
  return { exact, suggestions };
}

const LABEL = { safe: "✅ Safe", moderation: "⚠️ In moderation", never: "⛔ Never", ask_vet: "❓ Ask your vet" };

// DOM wiring only runs in the browser.
if (typeof document !== "undefined") {
  const BASE = (typeof window !== "undefined" && window.__BASE__) || "";
  const V = (typeof window !== "undefined" && window.__DATA_V__) || "";
  const petEl = document.getElementById("pet");
  const foodEl = document.getElementById("food");
  const resultEl = document.getElementById("result");
  const sugEl = document.getElementById("suggestions");
  let data = [];
  fetch(`${BASE}/checker-data.json${V ? `?v=${V}` : ""}`)
    .then((r) => r.json()).then((d) => { data = d; render(); });

  function render() {
    const { exact, suggestions } = matchFood(data, petEl.value, foodEl.value);
    sugEl.innerHTML = "";
    if (!foodEl.value.trim()) { resultEl.innerHTML = ""; return; }
    if (exact) {
      resultEl.innerHTML =
        `<p class="verdict verdict--${exact.verdict}">${LABEL[exact.verdict]}</p>` +
        `<p class="reason">${exact.reason}</p>` +
        `<p><a href="${BASE}/${exact.pet}/${exact.slug}/">Full details &rarr;</a></p>`;
    } else if (suggestions.length) {
      resultEl.innerHTML = `<p>Did you mean…</p>`;
      sugEl.innerHTML = suggestions
        .map((s) => `<li><a href="${BASE}/${s.pet}/${s.slug}/">${s.item} — ${LABEL[s.verdict]}</a></li>`).join("");
    } else {
      resultEl.innerHTML =
        `<p class="verdict verdict--ask_vet">${LABEL.ask_vet}</p>` +
        `<p class="reason">We don't have this food listed yet. When in doubt, check with your vet before feeding.</p>`;
    }
  }
  petEl.addEventListener("change", render);
  foodEl.addEventListener("input", render);
}
