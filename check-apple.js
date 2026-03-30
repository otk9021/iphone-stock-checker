import { chromium } from "playwright";

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

const START_URLS = [
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.3%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC",
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.9%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC"
];

const ZIP_CODE = "160-0022";

const TARGET_STORES = [
  "Apple 新宿",
  "Apple 渋谷",
  "Apple 表参道",
  "Apple 銀座",
  "Apple 丸の内",
  "Apple 川崎"
];

const TARGET_DAYS = ["本日", "明日"];

function normalizeText(text) {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function sendDiscord(message) {
  if (!DISCORD_WEBHOOK) {
    throw new Error("DISCORD_WEBHOOK is not set");
  }

  const res = await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: message })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord webhook failed: ${res.status} ${text}`);
  }
}

async function clickFirstText(page, texts) {
  for (const text of texts) {
    try {
      const loc = page.getByText(text, { exact: false }).first();
      if ((await loc.count()) > 0 && (await loc.isVisible())) {
        await loc.click({ timeout: 4000 });
        console.log("CLICKED_TEXT:", text);
        return true;
      }
    } catch (e) {
      console.log("CLICK_SKIP:", text, e.message);
    }
  }
  return false;
}

async function clickFirstSelector(page, selectors) {
  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).first();
      if ((await loc.count()) > 0 && (await loc.isVisible())) {
        await loc.click({ timeout: 4000 });
        console.log("CLICKED_SELECTOR:", selector);
        return true;
      }
    } catch (e) {
      console.log("CLICK_SELECTOR_SKIP:", selector, e.message);
    }
  }
  return false;
}

async function openPickupUi(page) {
  await page.waitForTimeout(3000);

  await clickFirstText(page, [
    "最短で翌日店舗で受け取り",
    "店舗での受け取り",
    "ストアでの受け取り",
    "Apple Storeで受け取る",
    "受け取る"
  ]);

  await page.waitForTimeout(2500);

  await clickFirstText(page, [
    "店舗での受け取り",
    "受け取る",
    "Apple Storeで受け取る"
  ]);

  await page.waitForTimeout(2500);

  // 念のため data-autom 系も試す
  await clickFirstSelector(page, [
    '[data-autom*="pickup"]',
    '[data-autom*="store"]'
  ]);

  await page.waitForTimeout(2500);
}

async function fillZipCode(page) {
  const selectors = [
    'input[placeholder*="郵便"]',
    'input[aria-label*="郵便"]',
    'input[type="search"]'
  ];

  for (const selector of selectors) {
    try {
      const loc = page.locator(selector).first();
      if ((await loc.count()) > 0 && (await loc.isVisible())) {
        await loc.fill(ZIP_CODE, { timeout: 5000 });
        console.log("ZIP_INPUT_OK:", selector, ZIP_CODE);
        return true;
      }
    } catch (e) {
      console.log("ZIP_INPUT_SKIP:", selector, e.message);
    }
  }

  console.log("ZIP_INPUT_NOT_FOUND");
  return false;
}

async function getVisibleText(page) {
  return page.evaluate(() => {
    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const root = document.body;
    if (!root) return "";

    const lines = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

    while (walker.nextNode()) {
      const el = walker.currentNode;
      if (!(el instanceof HTMLElement)) continue;
      if (!isVisible(el)) continue;

      const text = (el.innerText || "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      if (text.length > 400) continue;

      lines.push(text);
    }

    return Array.from(new Set(lines)).join("\n");
  });
}

function parseHitsFromText(text) {
  const normalized = normalizeText(text);

  console.log("VISIBLE_TEXT_PREVIEW:", normalized.slice(0, 2000));

  const hits = [];
  const seen = new Set();

  for (const store of TARGET_STORES) {
    for (const day of TARGET_DAYS) {
      const re1 = new RegExp(
        `${escapeRegExp(store)}[\\s\\S]{0,220}?受け取れる日\\s*${escapeRegExp(day)}`
      );
      const re2 = new RegExp(
        `受け取れる日\\s*${escapeRegExp(day)}[\\s\\S]{0,220}?${escapeRegExp(store)}`
      );
      const re3 = new RegExp(
        `${escapeRegExp(store)}[\\s\\S]{0,220}?${escapeRegExp(day)}`
      );

      if (re1.test(normalized) || re2.test(normalized) || re3.test(normalized)) {
        const key = `${store}__${day}`;
        if (!seen.has(key)) {
          seen.add(key);
          hits.push({ store, day });
        }
      }
    }
  }

  return hits;
}

async function inspectOne(page, url) {
  console.log("CHECK_URL:", url);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  console.log("TITLE:", await page.title());

  await openPickupUi(page);

  const zipOk = await fillZipCode(page);
  if (zipOk) {
    try {
      await page.keyboard.press("Enter");
      console.log("PRESSED: Enter");
    } catch (e) {
      console.log("ENTER_SKIP:", e.message);
    }
  }

  await page.waitForTimeout(8000);

  await clickFirstText(page, ["続ける", "確認", "検索", "表示"]);
  await page.waitForTimeout(5000);

  const visibleText = await getVisibleText(page);
  const hits = parseHitsFromText(visibleText);

  console.log("HITS_FOR_URL:", hits.length);
  hits.forEach((hit, idx) => {
    console.log(`HIT[${idx}]: ${hit.store} | ${hit.day}`);
  });

  return hits;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const allHits = [];

    for (const url of START_URLS) {
      const hits = await inspectOne(page, url);
      allHits.push(...hits);
    }

    const deduped = [];
    const seen = new Set();

    for (const hit of allHits) {
      const key = `${hit.store}__${hit.day}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(hit);
      }
    }

    if (deduped.length === 0) {
      console.log("NO_TARGET_HITS");
      return;
    }

    console.log("TARGET_HITS_START");

    for (const hit of deduped) {
      console.log(`STORE: ${hit.store}`);
      console.log(`DAY: ${hit.day}`);

      const message = [
        "🔥 iPhone在庫あり（類似モデル含む）",
        `店舗: ${hit.store}`,
        `受取日: ${hit.day}`,
        `郵便番号: ${ZIP_CODE}`
      ].join("\n");

      await sendDiscord(message);
    }

    console.log("TARGET_HITS_END");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
