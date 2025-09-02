// fetcher.js — robust multi-provider fetch with graceful fallbacks
// Output: dist/data/commodities.json, dist/data/pairs.json

const fs = require("fs");
const path = require("path");
const https = require("https");

const TD_KEY = process.env.TWELVE_DATA_API_KEY || "";
const AV_KEY = process.env.ALPHA_VANTAGE_API_KEY || "";

// ---------- tiny helpers ----------
function httpGetJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error(`Bad JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on("error", (e) => reject(e));
  });
}

function safeNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : undefined;
}

function outDir() {
  const p = path.join(__dirname, "dist", "data");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

// ---------- providers ----------
async function tdPrice(symbol) {
  if (!TD_KEY) return;
  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${TD_KEY}`;
  const j = await httpGetJSON(url);
  return safeNumber(j?.price);
}

// Yahoo Finance (no key) – futures quotes
// GC=F (gold), SI=F (silver), CL=F (WTI)
async function yahooFutures(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const j = await httpGetJSON(url);
  const q = j?.quoteResponse?.result?.[0];
  return safeNumber(q?.regularMarketPrice);
}

// Alpha Vantage FX (keyed)
async function avFx(from, to) {
  if (!AV_KEY) return;
  const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${encodeURIComponent(
    from
  )}&to_currency=${encodeURIComponent(to)}&apikey=${AV_KEY}`;
  const j = await httpGetJSON(url);
  const r = j?.["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"];
  return safeNumber(r);
}

// Frankfurter FX (no key)
async function frankfurterFx(from, to) {
  const url = `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const j = await httpGetJSON(url);
  return safeNumber(j?.rates?.[to]);
}

// ---------- commodity fetch with fallbacks ----------
async function fetchCommodity(symbol) {
  // symbol: "XAU/USD" | "XAG/USD" | "OIL"
  try {
    // Primary: Twelve Data (for XAU/USD, XAG/USD, OIL)
    const td = await tdPrice(symbol);
    if (td) return td;
  } catch (e) {
    console.warn(`TD fail ${symbol}:`, e.message);
  }

  // Fallbacks via Yahoo
  try {
    if (symbol === "XAU/USD") {
      const y = await yahooFutures("GC=F");
      if (y) return y;
    } else if (symbol === "XAG/USD") {
      const y = await yahooFutures("SI=F");
      if (y) return y;
    } else if (symbol === "OIL") {
      const y = await yahooFutures("CL=F");
      if (y) return y;
    }
  } catch (e) {
    console.warn(`Yahoo fail ${symbol}:`, e.message);
  }

  return undefined;
}

// ---------- FX fetch with fallbacks ----------
async function fetchFxPair(pair) {
  // pair like "EUR/USD"
  const [from, to] = pair.split("/");
  // 1) Twelve Data
  try {
    const td = await tdPrice(pair);
    if (td) return td;
  } catch (e) {
    console.warn(`TD FX fail ${pair}:`, e.message);
  }
  // 2) Alpha Vantage
  try {
    const av = await avFx(from, to);
    if (av) return av;
  } catch (e) {
    console.warn(`AV FX fail ${pair}:`, e.message);
  }
  // 3) Frankfurter
  try {
    const fr = await frankfurterFx(from, to);
    if (fr) return fr;
  } catch (e) {
    console.warn(`Frankfurter FX fail ${pair}:`, e.message);
  }
  return undefined;
}

// ---------- main ----------
async function main() {
  const commoditySymbols = ["XAU/USD", "XAG/USD", "OIL"];
  const pairSymbols = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD"];

  const commodities = {};
  for (const s of commoditySymbols) {
    const v = await fetchCommodity(s);
    if (v) {
      commodities[s.replace("/", "")] = { price: v };
    } else {
      console.warn(`⚠️ No commodity price for ${s}`);
    }
  }

  const pairs = {};
  for (const p of pairSymbols) {
    const v = await fetchFxPair(p);
    if (v) {
      pairs[p] = v;
    } else {
      console.warn(`⚠️ No FX price for ${p}`);
    }
  }

  const generated_at = new Date().toISOString();
  const dir = outDir();
  fs.writeFileSync(
    path.join(dir, "commodities.json"),
    JSON.stringify({ commodities, generated_at }, null, 2)
  );
  fs.writeFileSync(
    path.join(dir, "pairs.json"),
    JSON.stringify({ pairs, generated_at }, null, 2)
  );
  console.log("✅ Wrote dist/data/commodities.json and pairs.json");
}

main().catch((e) => {
  console.error("❌ Fatal:", e);
  process.exit(1);
});
