import { chromium } from "playwright";

const PRODUCT_URL =
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.9%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC";

async function clickFirstVisible(page, selectors) {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    try {
      if (await loc.count()) {
        await loc.click({ timeout: 5000 });
        console.log("CLICKED:", selector);
        return true;
      }
    } catch (e) {
      console.log("CLICK_SKIP:", selector, e.message);
    }
  }
  return false;
}

async function fillFirstVisible(page, selectors, value) {
  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    try {
      if (await loc.count()) {
        await loc.fill(value, { timeout: 5000 });
        console.log("FILLED:", selector, value);
        return true;
      }
    } catch (e) {
      console.log("FILL_SKIP:", selector, e.message);
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
        preview: text.slice(0, 600),
      });

      console.log("JSON_RESPONSE:", status, url);
    } catch (e) {
      console.log("RESPONSE_PARSE_SKIP:", e.message);
    }
  });

  try {
    await page.goto(PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("TITLE:", await page.title());

    await page.waitForTimeout(3000);

    // まず「受け取り」UIを開きにいく
    await clickFirstVisible(page, [
      'text=Apple Storeで受け取る',
      'text=次の地域のApple Storeで受け取る',
      'text=受け取る',
      'text=受け取れる日',
      'button:has-text("Apple Storeで受け取る")',
      'button:has-text("受け取る")',
      'button:has-text("受け取れる日")',
      '[data-autom="pickupOption"]',
      '[data-autom="pickupButton"]'
    ]);

    await page.waitForTimeout(2500);

    // 念のためもう一回候補を叩く
    await clickFirstVisible(page, [
      'text=Apple Storeで受け取る',
      'text=受け取る',
      'button:has-text("受け取る")'
    ]);

    await page.waitForTimeout(2500);

    // 郵便番号入力
    const filled = await fillFirstVisible(page, [
      'input[type="search"]',
      'input[placeholder*="郵便番号"]',
      'input[aria-label*="郵便番号"]',
      'input[aria-label*="検索"]',
      'input[type="text"]'
    ], "160-0022");

    if (!filled) {
      console.log("ZIP_INPUT_NOT_FOUND");
    }

    await page.waitForTimeout(1000);

    try {
      await page.keyboard.press("Enter");
      console.log("PRESSED: Enter");
    } catch (e) {
      console.log("ENTER_SKIP:", e.message);
    }

    await page.waitForTimeout(1500);

    await clickFirstVisible(page, [
      'text=続ける',
      'button:has-text("続ける")',
      'button:has-text("検索")',
      'button:has-text("確認")',
      'button:has-text("表示")'
    ]);

    await page.waitForTimeout(8000);

    console.log("CAPTURED_COUNT:", captured.length);

    for (const item of captured) {
      console.log("CAPTURED_URL:", item.url);
      console.log("CAPTURED_STATUS:", item.status);
      console.log("CAPTURED_PREVIEW:", item.preview);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
