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

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// DOM wiring only runs in the browser.
if (typeof document !== "undefined") {
  const BASE = window.__BASE__ || "";
  const V = window.__DATA_V__ || "";
  const PETS = window.__PETS__ || [];

  const petInput = document.getElementById("pet-input");
  const petList = document.getElementById("pet-list");
  const stepFood = document.getElementById("step-food");
  const foodInput = document.getElementById("food-input");
  const foodList = document.getElementById("food-list");
  const resultEl = document.getElementById("result");

  let data = [];
  let selectedPet = null;

  // Make the whole finder exactly as wide as the brand name.
  const brandEl = document.querySelector(".brand-name");
  const heroEl = document.querySelector(".hero");
  function sizeToBrand() {
    if (!brandEl || !heroEl) return;
    const w = Math.ceil(brandEl.getBoundingClientRect().width);
    heroEl.style.width = Math.min(w, Math.floor(window.innerWidth * 0.94)) + "px";
  }
  sizeToBrand();
  window.addEventListener("resize", sizeToBrand);

  fetch(`${BASE}/checker-data.json${V ? `?v=${V}` : ""}`)
    .then((r) => r.json())
    .then((d) => { data = d; if (selectedPet && foodInput.value) renderFood(); });

  // ---- Step 1: pick the pet ----
  function petMatches() {
    const q = petInput.value.trim().toLowerCase();
    if (!q) return PETS;
    const words = (p) => `${p.name} ${p.name_plural}`.toLowerCase().split(/[\s-]+/);
    // Prefer word-prefix matches ("r" -> Rabbit, Rat; "ge" -> Leopard Gecko).
    const prefix = PETS.filter((p) => words(p).some((w) => w.startsWith(q)));
    if (prefix.length) return prefix;
    // Fall back to substring so "tiel" still finds Cockatiel.
    return PETS.filter((p) => `${p.name} ${p.name_plural}`.toLowerCase().includes(q));
  }

  function openPetList() {
    // Dropdown appears only once the user starts typing.
    if (!petInput.value.trim()) { petList.hidden = true; petList.innerHTML = ""; petInput.setAttribute("aria-expanded", "false"); return; }
    const matches = petMatches();
    if (!matches.length) { petList.hidden = true; petList.innerHTML = ""; return; }
    petList.innerHTML = matches
      .map((p) => `<li role="option" data-slug="${p.slug}"><span>${esc(p.name)}</span></li>`)
      .join("");
    petList.hidden = false;
    petInput.setAttribute("aria-expanded", "true");
  }

  function choosePet(slug) {
    const pet = PETS.find((p) => p.slug === slug);
    if (!pet) return;
    selectedPet = pet;
    petInput.value = pet.name;
    petList.hidden = true;
    petInput.setAttribute("aria-expanded", "false");
    stepFood.hidden = false;
    foodInput.value = "";
    foodInput.placeholder = `Can ${pet.name_plural} eat…?`;
    resultEl.innerHTML = "";
    foodInput.focus();
  }

  petInput.addEventListener("focus", openPetList);
  petInput.addEventListener("input", () => {
    selectedPet = null;
    stepFood.hidden = true;
    resultEl.innerHTML = "";
    openPetList();
  });
  petInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const m = petMatches();
      if (m.length) { e.preventDefault(); choosePet(m[0].slug); }
    }
  });
  // mousedown fires before blur, so the selection isn't lost
  petList.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-slug]");
    if (li) { e.preventDefault(); choosePet(li.dataset.slug); }
  });
  petInput.addEventListener("blur", () => setTimeout(() => { petList.hidden = true; }, 120));

  // ---- Step 2: pick the food ----
  function showResult(row) {
    resultEl.innerHTML =
      `<div class="verdict-card verdict--${row.verdict}">` +
      `<p class="verdict-label">${LABEL[row.verdict]}</p>` +
      `<p class="verdict-q">Can ${esc(selectedPet.name_plural)} eat ${esc(row.item.toLowerCase())}?</p>` +
      `<p class="reason">${esc(row.reason)}</p>` +
      `<p><a href="${BASE}/${row.pet}/${row.slug}/">Full details &amp; source &rarr;</a></p>` +
      `</div>`;
  }

  function renderFood() {
    if (!selectedPet) return;
    const q = foodInput.value.trim();
    if (!q) { foodList.hidden = true; foodList.innerHTML = ""; resultEl.innerHTML = ""; return; }
    const { exact, suggestions } = matchFood(data, selectedPet.slug, q);
    if (exact) {
      foodList.hidden = true; foodList.innerHTML = "";
      showResult(exact);
    } else if (suggestions.length) {
      foodList.innerHTML = suggestions
        .map((s) => `<li role="option" data-slug="${s.slug}"><span>${esc(s.item)}</span><span class="v v--${s.verdict}">${LABEL[s.verdict]}</span></li>`)
        .join("");
      foodList.hidden = false;
      resultEl.innerHTML = "";
    } else {
      foodList.hidden = true; foodList.innerHTML = "";
      resultEl.innerHTML =
        `<div class="verdict-card verdict--ask_vet"><p class="verdict-label">${LABEL.ask_vet}</p>` +
        `<p class="reason">We don't have “${esc(q)}” listed for ${esc(selectedPet.name_plural)} yet. When in doubt, check with your vet before feeding.</p></div>`;
    }
  }

  function pickFood(slug) {
    const row = data.find((r) => r.pet === selectedPet.slug && r.slug === slug);
    if (row) { foodInput.value = row.item; foodList.hidden = true; showResult(row); }
  }

  foodInput.addEventListener("input", renderFood);
  foodInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const { exact, suggestions } = matchFood(data, selectedPet.slug, foodInput.value);
      if (exact) { e.preventDefault(); showResult(exact); }
      else if (suggestions.length) { e.preventDefault(); pickFood(suggestions[0].slug); }
    }
  });
  foodList.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-slug]");
    if (li) { e.preventDefault(); pickFood(li.dataset.slug); }
  });
  foodInput.addEventListener("blur", () => setTimeout(() => { foodList.hidden = true; }, 120));
}
