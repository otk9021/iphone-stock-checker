import { chromium } from "playwright";

const PRODUCT_URL =
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.9%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC";

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

async function logVisibleCandidates(page, label) {
  const data = await page.evaluate(() => {
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

    const keywordRe =
      /受け取|在庫|Apple Store|店舗|郵便番号|現在地|続ける|配送|本日|明日|検索/;

    const result = [];

    document
      .querySelectorAll("button, a, [role='button'], input, label, summary, div, span")
      .forEach((el) => {
        if (!isVisible(el)) return;

        const text =
          el.tagName.toLowerCase() === "input"
            ? el.value ||
              el.getAttribute("placeholder") ||
              el.getAttribute("aria-label") ||
              ""
            : el.innerText || el.textContent || "";

        const normalized = (text || "").replace(/\s+/g, " ").trim();
        if (!normalized) return;
        if (!keywordRe.test(normalized)) return;

        result.push({
          tag: el.tagName.toLowerCase(),
          text: normalized.slice(0, 120),
          type: el.getAttribute("type") || "",
          name: el.getAttribute("name") || "",
          ariaLabel: el.getAttribute("aria-label") || "",
          placeholder: el.getAttribute("placeholder") || "",
          dataAutom: el.getAttribute("data-autom") || "",
          id: el.id || "",
          className: (el.className || "").toString().slice(0, 120),
          outerHTML: (el.outerHTML || "").slice(0, 300),
        });
      });

    return result.slice(0, 80);
  });

  console.log(`===== ${label}: VISIBLE CANDIDATES START =====`);
  data.forEach((item, idx) => {
    console.log(
      `[${idx}] tag=${item.tag} text="${item.text}" type="${item.type}" aria="${item.ariaLabel}" placeholder="${item.placeholder}" data-autom="${item.dataAutom}" id="${item.id}" class="${item.className}"`
    );
    console.log(`OUTER: ${item.outerHTML}`);
  });
  console.log(`===== ${label}: VISIBLE CANDIDATES END =====`);
}

async function tryClickText(page, texts) {
  for (const text of texts) {
    try {
      const loc = page.getByText(text, { exact: false }).first();
      if ((await loc.count()) > 0) {
        await loc.click({ timeout: 4000 });
        console.log("CLICKED_TEXT:", text);
        return true;
      }
    } catch (e) {
      console.log("CLICK_TEXT_SKIP:", text, e.message);
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
      const contentType = response.headers()["content-type"] || "";

      if (!url.includes("apple.com")) return;
      if (!contentType.includes("json")) return;

      const text = await response.text().catch(() => "");
      captured.push({
        url,
        status,
        preview: text.slice(0, 300),
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

    await logVisibleCandidates(page, "BEFORE_CLICK");

    // 受け取り系の候補だけを限定してクリック
    await tryClickText(page, [
      "Apple Storeで受け取る",
      "次の地域のApple Storeで受け取る",
      "店舗の在庫",
      "在庫を確認",
      "受け取れる日",
      "受け取る",
    ]);

    await page.waitForTimeout(3000);

    await logVisibleCandidates(page, "AFTER_CLICK");

    console.log("CAPTURED_COUNT:", captured.length);
    captured.forEach((item) => {
      console.log("CAPTURED_URL:", item.url);
      console.log("CAPTURED_STATUS:", item.status);
      console.log("CAPTURED_PREVIEW:", item.preview);
    });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
