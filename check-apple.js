import fetch from "node-fetch";

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

const URL =
  "https://www.apple.com/jp/shop/fulfillment-messages?parts.0=MTXW3J/A&searchNearby=true&store=R045";

async function sendDiscord(msg) {
  await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: msg }),
  });
}

async function main() {
  const res = await fetch(URL);
  const data = await res.json();

  const stores =
    data.body?.content?.pickupMessage?.stores || [];

  for (const store of stores) {
    const name = store.storeName;
    const message = store.partsAvailability?.["MTXW3J/A"]?.pickupSearchQuote;

    if (!name || !message) continue;

    console.log(name, message);

    if (
      name.includes("新宿") ||
      name.includes("渋谷") ||
      name.includes("銀座") ||
      name.includes("表参道") ||
      name.includes("丸の内") ||
      name.includes("川崎")
    ) {
      if (message.includes("本日") || message.includes("明日")) {
        await sendDiscord(`🔥在庫あり\n${name}\n${message}`);
      }
    }
  }
}

main().catch(console.error);
