import { chromium } from "playwright";

const TARGET_URL =
  "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.3%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  const title = await page.title();
  console.log("TITLE:", title);

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
