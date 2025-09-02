// ---------- Theme ----------
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') root.classList.add('light');
themeToggle.addEventListener('click', () => {
  root.classList.toggle('light');
  localStorage.setItem('theme', root.classList.contains('light') ? 'light' : 'dark');
});

// ---------- Tabs ----------
const tabs = [...document.querySelectorAll('.tab')];
const panels = [...document.querySelectorAll('.tab-panel')];
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(b => b.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---------- Helpers ----------
const fmt = {
  price: (n, dp=2) => {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  }
};

const setStatus = (elId, text) => { const e=document.getElementById(elId); if(e) e.textContent=text; };

// Simple fetch with timeout + graceful error
async function fetchJSON(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(id); }
}

// ---------- Commodities (Gold, Silver, Oil) ----------
const elXAU = document.querySelector('#xau [data-field="price"]');
const elXAG = document.querySelector('#xag [data-field="price"]');
const elOIL = document.querySelector('#oil [data-field="price"]');
const elOilSrc = document.getElementById('oilSource');

async function getXauUsd() {
  // exchangerate.host supports metals (XAU/XAG) -> currency
  // 1 XAU in USD
  const j = await fetchJSON('https://api.exchangerate.host/convert?from=XAU&to=USD');
  return j?.info?.rate || j?.result;
}
async function getXagUsd() {
  const j = await fetchJSON('https://api.exchangerate.host/convert?from=XAG&to=USD');
  return j?.info?.rate || j?.result;
}

async function getOilUsd() {
  // Try Brent first (XBR->USD). If missing, try WTI (XTI->USD).
  // Some providers expose these as commodities-like codes.
  try {
    const br = await fetchJSON('https://api.exchangerate.host/convert?from=XBR&to=USD');
    if (br?.info?.rate || br?.result) {
      elOilSrc.textContent = 'Brent (XBR/USD)';
      return br.info?.rate || br.result;
    }
  } catch (_) {}

  try {
    const wti = await fetchJSON('https://api.exchangerate.host/convert?from=XTI&to=USD');
    if (wti?.info?.rate || wti?.result) {
      elOilSrc.textContent = 'WTI (XTI/USD)';
      return wti.info?.rate || wti.result;
    }
  } catch (_) {}

  // Fallback via Stooq CSV through a CORS proxy (best-effort)
  // WTI = CL.F, Brent = BR.F (end-of-day-ish)
  async function stooq(symbol) {
    const url = `https://stooq.com/q/l/?s=${symbol}&f=sd2t2ohlcv&h&e=csv`;
    const prox = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const txt = await (await fetch(prox)).text();
    // CSV header: Symbol,Date,Time,Open,High,Low,Close,Volume
    const line = txt.trim().split('\n')[1];
    const parts = line.split(',');
    const close = parseFloat(parts[6]);
    return isFinite(close) ? close : null;
  }
  try {
    const v = await stooq('cl.f');
    if (v) { elOilSrc.textContent = 'WTI (Stooq CL.F)'; return v; }
  } catch (_) {}
  try {
    const v = await stooq('br.f');
    if (v) { elOilSrc.textContent = 'Brent (Stooq BR.F)'; return v; }
  } catch (_) {}

  elOilSrc.textContent = 'Oil (unavailable)';
  return null;
}

async function loadCommodities() {
  setStatus('commoditiesStatus', 'updating…');
  try {
    const [xau, xag, oil] = await Promise.allSettled([getXauUsd(), getXagUsd(), getOilUsd()]);
    elXAU.textContent = fmt.price(xau.value, 2);
    elXAG.textContent = fmt.price(xag.value, 3);
    elOIL.textContent = fmt.price(oil.value, 2);
    setStatus('commoditiesStatus', 'live • 60s refresh');
  } catch (err) {
    setStatus('commoditiesStatus', 'error');
    console.error('Commodities error:', err);
  }
}

// ---------- Forex Pairs ----------
const pairs = [
  { name: 'EUR/USD', base:'EUR', quote:'USD' },
  { name: 'GBP/USD', base:'GBP', quote:'USD' },
  { name: 'USD/JPY', base:'USD', quote:'JPY' },
  { name: 'USD/CHF', base:'USD', quote:'CHF' },
  { name: 'AUD/USD', base:'AUD', quote:'USD' },
  { name: 'USD/CAD', base:'USD', quote:'CAD' },
  { name: 'NZD/USD', base:'NZD', quote:'USD' },
  { name: 'EUR/GBP', base:'EUR', quote:'GBP' },
  { name: 'EUR/JPY', base:'EUR', quote:'JPY' },
  { name: 'GBP/JPY', base:'GBP', quote:'JPY' }
];

const pairsGrid = document.getElementById('pairsGrid');

function pairCard(id, title){
  const div = document.createElement('div');
  div.className = 'card metric';
  div.id = id;
  div.innerHTML = `
    <div class="metric-head"><span class="metric-name">${title}</span></div>
    <div class="metric-body">
      <div class="metric-value" data-field="price">—</div>
      <div class="metric-sub">mid price</div>
    </div>`;
  return div;
}

pairs.forEach(p => pairsGrid.appendChild(pairCard(`pair-${p.base}${p.quote}`, p.name)));

async function fetchPair(base, quote){
  // https://api.exchangerate.host/convert?from=EUR&to=USD
  const j = await fetchJSON(`https://api.exchangerate.host/convert?from=${base}&to=${quote}`);
  return j?.info?.rate || j?.result || null;
}

async function loadPairs(){
  setStatus('pairsStatus', 'updating…');
  try {
    const out = await Promise.allSettled(pairs.map(p => fetchPair(p.base, p.quote)));
    out.forEach((r, i) => {
      const p = pairs[i];
      const el = document.querySelector(`#pair-${p.base}${p.quote} [data-field="price"]`);
      const dp = (p.quote === 'JPY') ? 3 : 5;
      el.textContent = fmt.price(r.value, dp);
    });
    setStatus('pairsStatus', 'live • 60s refresh');
  } catch (err){
    setStatus('pairsStatus', 'error');
    console.error('Pairs error:', err);
  }
}

// ---------- Start + Auto Refresh ----------
function start(){
  loadCommodities();
  loadPairs();
  setInterval(loadCommodities, 60_000);
  setInterval(loadPairs, 60_000);
}
document.addEventListener('DOMContentLoaded', start);
