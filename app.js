// app.js — UI logic for tabs + loading data from local JSON files built by GitHub Actions

/* ========== Tabs ========== */
function selectTab(tab) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.add("active");
  document.getElementById(tab)?.classList.add("active");
}
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  const t = btn.getAttribute("data-tab");
  selectTab(t);
  if (t === "commodities") loadCommodities();
  if (t === "pairs") loadPairs();
});

/* ========== Theme toggle ========== */
const themeToggle = document.getElementById("themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
  });
}

/* ========== Utilities ========== */
function fmtPrice(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const n = Number(v);
  if (n >= 100) return n.toFixed(2);
  if (n >= 10) return n.toFixed(3);
  return n.toFixed(4);
}
function fmtFx(v) {
  if (v == null || Number.isNaN(v)) return "—";
  const n = Number(v);
  // broader ranges for majors
  if (n >= 100) return n.toFixed(2);     // e.g., USD/JPY
  if (n >= 10) return n.toFixed(3);
  return n.toFixed(5);                   // e.g., EUR/USD ~1.09
}
function colorize(el, delta) {
  if (!el) return;
  el.classList.remove("up", "down");
  if (delta > 0) el.classList.add("up");
  else if (delta < 0) el.classList.add("down");
}
async function fetchLocalJSON(path) {
  const url = `${path}?ts=${Date.now()}`; // cache-bust
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${path}`);
  return res.json();
}

/* ========== Commodities ========== */
function fillMetric(id, obj) {
  const root = document.getElementById(id);
  if (!root) return;
  const valEl = root.querySelector('[data-field="price"]');
  const chgEl = root.querySelector('[data-field="change"]');

  if (!obj) {
    valEl.textContent = "—";
    if (chgEl) chgEl.textContent = "";
    root.classList.remove("up", "down");
    return;
  }

  let change = null;
  if (typeof obj.percent_change === "number") change = obj.percent_change;
  else if (typeof obj.change === "number") change = obj.change;

  valEl.textContent = fmtPrice(obj.price);
  if (chgEl) {
    const sign = change > 0 ? "+" : "";
    const unit = (typeof obj.percent_change === "number") ? "%" : "";
    chgEl.textContent = change == null ? "" : `(${sign}${change}${unit})`;
  }
  colorize(root, change);
}

async function loadCommodities() {
  const status = document.getElementById("commoditiesStatus");
  try {
    if (status) status.textContent = "updating…";
    const data = await fetchLocalJSON("./data/commodities.json");
    fillMetric("xau", data.commodities?.XAUUSD || null);
    fillMetric("xag", data.commodities?.XAGUSD || null);
    fillMetric("oil", data.commodities?.OIL || null);
    if (status) status.textContent = `updated ${new Date(data.generated_at).toLocaleTimeString()}`;
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "error";
  }
}

/* ========== FX Pairs ========== */
function fillPair(id, rate) {
  const root = document.getElementById(id);
  if (!root) return;
  const valEl = root.querySelector('[data-field="price"]');
  valEl.textContent = fmtFx(rate);
}
async function loadPairs() {
  const status = document.getElementById("pairsStatus");
  try {
    if (status) status.textContent = "updating…";
    const data = await fetchLocalJSON("./data/pairs.json");
    fillPair("eurusd", data.pairs?.["EUR/USD"] ?? null);
    fillPair("gbpusd", data.pairs?.["GBP/USD"] ?? null);
    fillPair("usdjpy", data.pairs?.["USD/JPY"] ?? null);
    fillPair("usdchf", data.pairs?.["USD/CHF"] ?? null);
    fillPair("audusd", data.pairs?.["AUD/USD"] ?? null);
    fillPair("usdcad", data.pairs?.["USD/CAD"] ?? null);
    if (status) status.textContent = `updated ${new Date(data.generated_at).toLocaleTimeString()}`;
  } catch (e) {
    console.error(e);
    if (status) status.textContent = "error";
  }
}

/* ========== Init ========== */
document.addEventListener("DOMContentLoaded", () => {
  // default to News tab visible; nothing to load yet
  // prefetch data quietly, so switching tabs feels instant
  loadCommodities().catch(() => {});
  loadPairs().catch(() => {});

  // periodic refresh (page pulls new JSON; GitHub Actions also refreshes every ~10m)
  setInterval(() => {
    const active = document.querySelector(".tab.active")?.getAttribute("data-tab");
    if (active === "commodities") loadCommodities();
    if (active === "pairs") loadPairs();
  }, 60_000);
});
