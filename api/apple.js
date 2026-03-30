import { chromium as playwright } from "playwright-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  let browser;

  try {
    browser = await playwright.launch({
      args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    await page.goto(
      "https://www.apple.com/jp/shop/buy-iphone/iphone-17-pro/6.3%E3%82%A4%E3%83%B3%E3%83%81%E3%83%87%E3%82%A3%E3%82%B9%E3%83%97%E3%83%AC%E3%82%A4-256gb-%E3%82%B7%E3%83%AB%E3%83%90%E3%83%BC-sim%E3%83%95%E3%83%AA%E3%83%BC",
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );

    const title = await page.title();
    const html = await page.content();

    res.status(200).json({
      ok: true,
      title,
      preview: html.slice(0, 1200),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: String(e),
    });
  } finally {
    if (browser) await browser.close();
  }
}
