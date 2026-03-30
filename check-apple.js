import { chromium } from "playwright";

const TARGET_URLS = [
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.3%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC",
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.9%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC"
];

const TARGET_STORES = [
  "Apple 新宿",
  "Apple 渋谷",
  "Apple 表参道",
  "Apple 銀座",
  "Apple 丸の内",
  "Apple 川崎"
];

function isTargetPickupText(text) {
  if (!text) return false;
  return text.includes("本日") || text.includes("明日");
}

function safeString(value) {
  return typeof value === "string" ? value : JSON.stringify(value ?? "");
}

function collectStoreHits(obj, hits = []) {
  if (!obj || typeof obj !== "object") return hits;

  const storeName =
    obj.storeName ||
    obj.storeNameWithLineBreak ||
    obj.store ||
    obj.name ||
    "";

  const pickupText =
    obj.pickupSearchQuote ||
    obj.pickupDisplayMessage ||
    obj.pickupMessage ||
    obj.message ||
    obj.fulfillmentMessage ||
    "";

  const availabilityText = safeString(obj).toLowerCase();

  const isTargetStore = TARGET_STORES.some((name) => storeName.includes(name));
  const hasPickupKeyword = isTargetPickupText(pickupText);
  const looksAvailable =
    availabilityText.includes("available") ||
    availabilityText.includes("pickup") ||
    hasPickupKeyword;

  if (isTargetStore && hasPickupKeyword && looksAvailable) {
    hits.push({
      storeName,
      pickupText,
      raw: obj,
    });
  }

  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) collectStoreHits(item, hits);
    } else if (value && typeof value === "object") {
      collectStoreHits(value, hits);
    }
  }

  return hits;
}

async function inspectOnePage(page, url) {
  const captured = [];

  page.on("response", async (response) => {
    try {
      const responseUrl = response.url();
      const contentType = response.headers()["content-type"] || "";

      if (
        !responseUrl.includes("apple.com") ||
        (!responseUrl.includes("fulfillment") &&
          !responseUrl.includes("pickup") &&
          !responseUrl.includes("store") &&
          !responseUrl.includes("availability"))
      ) {
        return;
      }

      if (!contentType.includes("json")) return;

      const data = await response.json().catch(() => null);
      if (!data) return;

      captured.push({
        url: responseUrl,
        data,
      });
    } catch (e) {
      console.error("response parse error:", e.message);
    }
  });

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  try {
  await page.fill('input[type="search"]', '160-0022');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
} catch (e) {
  console.log("ZIP INPUT SKIP:", e.message);
}

  await page.waitForTimeout(8000);

  return captured;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const allHits = [];

  for (const url of TARGET_URLS) {
    console.log("CHECK URL:", url);

    const captured = await inspectOnePage(page, url);

    console.log("CAPTURED JSON COUNT:", captured.length);

    for (const item of captured) {
      const hits = collectStoreHits(item.data);
      if (hits.length > 0) {
        allHits.push({
          sourceUrl: url,
          apiUrl: item.url,
          hits,
        });
      }
    }
  }

  if (allHits.length === 0) {
    console.log("NO_TARGET_HITS");
  } else {
    console.log("TARGET_HITS_START");
    for (const block of allHits) {
      console.log("PAGE:", block.sourceUrl);
      console.log("API:", block.apiUrl);
      for (const hit of block.hits) {
        console.log(`STORE: ${hit.storeName}`);
        console.log(`PICKUP: ${hit.pickupText}`);
      }
    }
    console.log("TARGET_HITS_END");
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
