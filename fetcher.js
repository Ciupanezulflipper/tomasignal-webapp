// fetcher.js — runs in GitHub Actions (Node 18) and writes static JSON to ./dist/data
const fs = require("fs/promises");

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchCommodities() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) throw new Error("Missing TWELVE_DATA_API_KEY");

  const base = "https://api.twelvedata.com/quote?symbol=";

  async function tdQuote(symbol) {
    const data = await fetchJSON(`${base}${encodeURIComponent(symbol)}&apikey=${apiKey}`);
    if (data && data.symbol && data.price) return data;
    throw new Error(`No quote for ${symbol}`);
  }

  // Metals (reliable on TwelveData)
  const xau = await tdQuote("XAU/USD").catch(() => null);
  const xag = await tdQuote("XAG/USD").catch(() => null);

  // Oil: try a few common symbols and keep the first that works
  const oilCandidates = ["WTI/USD", "CL", "CL=F", "WTICOUSD", "USO"];
  let oil = null, oilSymbol = null;
  for (const s of oilCandidates) {
    try { oil = await tdQuote(s); oilSymbol = s; break; } catch { /* try next */ }
  }

  return {
    generated_at: new Date().toISOString(),
    commodities: {
      XAUUSD: xau ? {
        price: Number(xau.price),
        percent_change: xau.percent_change ? Number(xau.percent_change) : null,
        prev_close: xau.previous_close ? Number(xau.previous_close) : null
      } : null,
      XAGUSD: xag ? {
        price: Number(xag.price),
        percent_change: xag.percent_change ? Number(xag.percent_change) : null,
        prev_close: xag.previous_close ? Number(xag.previous_close) : null
      } : null,
      OIL: oil ? {
        price: Number(oil.price),
        symbol_used: oilSymbol
      } : null
    }
  };
}

async function fetchPairs() {
  // Free, no key needed
  const url = "https://api.exchangerate.host/latest?base=USD&symbols=EUR,GBP,JPY,CHF,CAD,AUD";
  const data = await fetchJSON(url);
  const r = data.rates;

  // Convert to requested market notation
  const pairs = {
    "EUR/USD": r.EUR ? 1 / r.EUR : null,   // base=USD -> USD→EUR, invert to EUR→USD
    "GBP/USD": r.GBP ? 1 / r.GBP : null,
    "USD/JPY": r.JPY ?? null,
    "USD/CHF": r.CHF ?? null,
    "AUD/USD": r.AUD ? 1 / r.AUD : null,
    "USD/CAD": r.CAD ?? null
  };

  return {
    generated_at: new Date().toISOString(),
    pairs
  };
}

async function main() {
  await fs.mkdir("./dist/data", { recursive: true });

  const [commodities, fx] = await Promise.all([
    fetchCommodities(),
    fetchPairs()
  ]);

  await fs.writeFile("./dist/data/commodities.json", JSON.stringify(commodities, null, 2));
  await fs.writeFile("./dist/data/pairs.json", JSON.stringify(fx, null, 2));

  console.log("Wrote: dist/data/commodities.json, dist/data/pairs.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
