export default async function handler(req, res) {
  await fetch(process.env.DISCORD_WEBHOOK, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: "テスト通知OK🔥",
    }),
  });

  res.status(200).json({ message: "sent" });
}
