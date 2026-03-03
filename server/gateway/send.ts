/**
 * Channel-specific message sending.
 * Telegram: Bot API sendMessage
 * Discord: Webhook POST
 * Slack: Webhook POST
 * Others: graceful no-op (self-hosted delivery not available)
 */

import fs from "node:fs";
import path from "node:path";

export async function sendToChannel(
  channel: string,
  target: string,
  text: string,
  token: string | null,
): Promise<void> {
  switch (channel) {
    case "telegram":
      if (!token) throw new Error("telegram requires a bot token");
      return sendTelegram(target, text, token);

    case "discord":
      // target = webhook URL
      return sendDiscordWebhook(target, text);

    case "slack":
      // target = webhook URL
      return sendSlackWebhook(target, text);

    case "whatsapp":
    case "googlechat":
    case "signal":
    case "imessage":
      // These channels require self-hosted infrastructure or vendor-specific API keys
      // not available in the open-source distribution. Graceful no-op with warning.
      console.warn(`[gateway] Channel '${channel}' relay not self-hosted, skipping`);
      return;

    default:
      throw new Error(`channel_not_implemented: ${channel}`);
  }
}

async function sendTelegram(chatId: string, text: string, token: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const truncated = text.length > 4096 ? text.slice(0, 4093) + "..." : text;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: truncated }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Telegram API ${resp.status}: ${body.slice(0, 200)}`);
  }
}

async function sendDiscordWebhook(webhookUrl: string, text: string): Promise<void> {
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text.slice(0, 2000) }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Discord webhook ${resp.status}: ${body.slice(0, 200)}`);
  }
}

async function sendSlackWebhook(webhookUrl: string, text: string): Promise<void> {
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Slack webhook ${resp.status}: ${body.slice(0, 200)}`);
  }
}

/**
 * Send a file to a channel. Currently supports Telegram sendDocument.
 * Max file size: 50MB (Telegram API limit).
 */
export async function sendFileToChannel(
  channel: string,
  target: string,
  filePath: string,
  caption: string,
  token: string | null,
): Promise<boolean> {
  if (channel !== "telegram" || !token) return false;
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size > 50 * 1024 * 1024) return false; // Telegram 50MB limit

  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: "application/octet-stream" });

  const form = new FormData();
  form.append("chat_id", target);
  form.append("document", blob, fileName);
  if (caption) form.append("caption", caption.slice(0, 1024));

  const url = `https://api.telegram.org/bot${token}/sendDocument`;
  const resp = await fetch(url, { method: "POST", body: form });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    console.warn(`[gateway] sendDocument failed: ${resp.status} ${body.slice(0, 200)}`);
    return false;
  }
  return true;
}

/** Remove any existing webhook so getUpdates polling works. */
export async function deleteTelegramWebhook(token: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
}
