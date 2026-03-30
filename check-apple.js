import { chromium } from "playwright";

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

const PRODUCT_URL =
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.9%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC";

// いったん1SKUで確認
const PART_NUMBER = "MTXW3J/A";

const API_URL =
  `https://www.apple.com/jp/shop/fulfillment-messages?parts.0=${encodeURIComponent(PART_NUMBER)}&searchNearby=true&store=R045`;

const TARGET_STORES = ["新宿", "渋谷", "銀座", "表参道", "丸の内", "川崎"];

async function sendDiscord(msg) {
  if (!DISCORD_WEBHOOK) throw new Error("DISCORD_WEBHOOK is not set");

  const res = await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: msg }),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${res.statusText}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    const title = await page.title();
    console.log("TITLE:", title);

    // ブラウザ文脈からApple APIを叩く
    const result = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json, text/plain, */*",
        },
      });

      const text = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        text,
      };
    }, API_URL);

    console.log("APPLE_STATUS:", result.status);
    console.log("APPLE_PREVIEW:", result.text.slice(0, 300));

    if (!result.ok) {
      throw new Error(`Apple API error: ${result.status} ${result.text.slice(0, 300)}`);
    }

    let data;
    try {
      data = JSON.parse(result.text);
    } catch {
      throw new Error(`Apple API did not return JSON: ${result.text.slice(0, 300)}`);
    }

    const stores = data.body?.content?.pickupMessage?.stores || [];
    console.log("STORE_COUNT:", stores.length);

    const hits = [];

    for (const store of stores) {
      const name = store.storeName || "";
      const message =
        store.partsAvailability?.[PART_NUMBER]?.pickupSearchQuote || "";

      if (!name || !message) continue;

      console.log("STORE_LOG:", name, "|", message);

      const isTargetStore = TARGET_STORES.some((s) => name.includes(s));
      const isTargetDay = message.includes("本日") || message.includes("明日");

      if (isTargetStore && isTargetDay) {
        hits.push({ name, message });
      }
    }

    if (hits.length === 0) {
      console.log("NO_TARGET_HITS");
    } else {
      console.log("TARGET_HITS_START");
      for (const hit of hits) {
        console.log(`STORE: ${hit.name}`);
        console.log(`PICKUP: ${hit.message}`);
        await sendDiscord(`🔥在庫あり\n${hit.name}\n${hit.message}`);
      }
      console.log("TARGET_HITS_END");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
