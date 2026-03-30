export default async function handler(req, res) {
  try {
    const url =
      "https://www.apple.com/jp/shop/fulfillment-messages?parts.0=MU7A3J/A&searchNearby=true&store=R091&fvip=13";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json,text/plain,*/*",
        "Referer": "https://www.apple.com/jp/shop/buy-iphone/",
      },
    });

    const text = await response.text();

    res.status(200).json({
      ok: true,
      status: response.status,
      preview: text.slice(0, 1200),
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: e.message,
    });
  }
}
