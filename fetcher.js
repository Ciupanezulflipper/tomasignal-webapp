// fetcher.js — pulls data from API and saves into dist/data/*.json

const fs = require("fs");
const path = require("path");
const https = require("https");

const apiKey = process.env.TWELVE_DATA_API_KEY;
if (!apiKey) {
  console.error("❌ Missing API key in secrets");
  process.exit(1);
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

async function fetchCommodities() {
  const symbols = ["XAU/USD", "XAG/USD", "OIL"];
  const commodities = {};
  for (const s of symbols) {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(
      s
    )}&apikey=${apiKey}`;
    try {
      const json = await fetchJSON(url);
      if (json && json.price) {
        commodities[s.replace("/", "")] = { price: Number(json.price) };
      } else {
        console.warn(`⚠️ No data for ${s}`, json);
      }
    } catch (e) {
      console.warn(`⚠️ Error fetching ${s}`, e.message);
    }
  }
  return commodities;
}

async function fetchPairs() {
  const pairs = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "USD/CAD"];
  const fx = {};
  for (const p of pairs) {
    const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(
      p
    )}&apikey=${apiKey}`;
    try {
      const json = await fetchJSON(url);
      if (json && json.price) {
        fx[p] = Number(json.price);
      } else {
        console.warn(`⚠️ No data for ${p}`, json);
      }
    } catch (e) {
      console.warn(`⚠️ Error fetching ${p}`, e.message);
    }
  }
  return fx;
}

async function main() {
  const commodities = await fetchCommodities();
  const pairs = await fetchPairs();
  const generated_at = new Date().toISOString();

  const distDir = path.join(__dirname, "dist", "data");
  fs.mkdirSync(distDir, { recursive: true });

  fs.writeFileSync(
    path.join(distDir, "commodities.json"),
    JSON.stringify({ commodities, generated_at }, null, 2)
  );
  fs.writeFileSync(
    path.join(distDir, "pairs.json"),
    JSON.stringify({ pairs, generated_at }, null, 2)
  );

  console.log("✅ Data written into dist/data/");
}

main().catch((err) => {
  console.error("❌ Fatal error", err);
  process.exit(1);
});
