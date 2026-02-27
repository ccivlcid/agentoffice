/**
 * Channel-specific message sending.
 * Currently supports Telegram; other channels throw "channel_not_implemented".
 */

export async function sendToChannel(
  channel: string,
  target: string,
  text: string,
  token: string | null,
): Promise<void> {
  if (channel === "telegram" && token) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: target, text }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`Telegram API ${resp.status}: ${body.slice(0, 200)}`);
    }
    return;
  }
  throw new Error(`channel_not_implemented: ${channel}`);
}

/** Remove any existing webhook so getUpdates polling works. */
export async function deleteTelegramWebhook(token: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
}
