import { chromium } from "playwright";

const PRODUCT_URL =
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.9%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC";

async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.count()) {
      try {
        await loc.click({ timeout: 3000 });
        console.log("CLICKED:", selector);
        return true;
      } catch {}
    }
  }
  return false;
}

async function fillFirstVisible(page, selectors, value) {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.count()) {
      try {
        await loc.fill(value, { timeout: 3000 });
        console.log("FILLED:", selector, value);
        return true;
      } catch {}
    }
  }
  return false;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const captured = [];

  page.on("response", async (response) => {
    try {
      const url = response.url();
      const status = response.status();
      const headers = response.headers();
      const contentType = headers["content-type"] || "";

      if (!url.includes("apple.com")) return;
      if (!contentType.includes("json")) return;

      const text = await response.text().catch(() => "");
      captured.push({
        url,
        status,
        contentType,
        preview: text.slice(0, 500),
      });

      console.log("JSON_RESPONSE:", status, url);
    } catch (e) {
      console.log("RESPONSE_PARSE_SKIP:", e.message);
    }
  });

  await page.goto(PRODUCT_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  console.log("TITLE:", await page.title());

  await page.waitForTimeout(3000);

  // 受け取り系UIを開く候補
  await clickFirstVisible(page, [
    'text=Apple Storeで受け取る',
    'text=受け取る',
    'text=受け取れる日',
    'text=次の地域のApple Storeで受け取る',
    'button:has-text("受け取る")',
    'button:has-text("Apple Storeで受け取る")'
  ]);

  await page.waitForTimeout(2000);

  // 郵便番号入力候補
  await fillFirstVisible(page, [
    'input[type="search"]',
    'input[placeholder*="郵便番号"]',
    'input[placeholder*="現在地"]',
    'input[aria-label*="郵便番号"]',
    'input[aria-label*="検索"]',
    'input[type="text"]'
  ], "160-0022");

  await page.waitForTimeout(1000);

  // Enter or 続ける
  try {
    await page.keyboard.press("Enter");
    console.log("PRESSED: Enter");
  } catch {}

  await clickFirstVisible(page, [
    'text=続ける',
    'button:has-text("続ける")',
    'button:has-text("検索")',
    'button:has-text("確認")'
  ]);

  await page.waitForTimeout(8000);

  console.log("CAPTURED_COUNT:", captured.length);

  for (const item of captured) {
    console.log("CAPTURED_URL:", item.url);
    console.log("CAPTURED_STATUS:", item.status);
    console.log("CAPTURED_PREVIEW:", item.preview);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
