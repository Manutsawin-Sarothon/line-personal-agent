import express from "express";
import { middleware, messagingApi, type WebhookEvent } from "@line/bot-sdk";
import { DateTime } from "luxon";
import { loadConfig } from "./config.js";
import { ReminderStore } from "./db.js";
import { PersonalAgent } from "./agent.js";
import { formatReminder, startReminderWorker } from "./reminders.js";

const config = loadConfig();
const store = new ReminderStore(config.DATABASE_PATH);
const line = new messagingApi.MessagingApiClient({ channelAccessToken: config.LINE_CHANNEL_ACCESS_TOKEN });
const agent = new PersonalAgent(config.GEMINI_API_KEY, config.GEMINI_MODEL, config.TIMEZONE);
const app = express();

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post(
  "/webhook",
  middleware({ channelSecret: config.LINE_CHANNEL_SECRET }),
  async (req, res) => {
    try {
      await Promise.all((req.body.events as WebhookEvent[]).map(handleEvent));
      res.sendStatus(200);
    } catch (error) {
      console.error("Webhook processing failed", error);
      res.sendStatus(500);
    }
  }
);

async function handleEvent(event: WebhookEvent): Promise<void> {
  if (!store.claimEvent(event.webhookEventId)) return;
  try {
    await processEvent(event);
  } catch (error) {
    store.releaseEvent(event.webhookEventId);
    throw error;
  }
}

async function processEvent(event: WebhookEvent): Promise<void> {
  if (event.source.userId !== config.OWNER_LINE_USER_ID) {
    if ("replyToken" in event) {
      await line.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: "บอตนี้เป็นผู้ช่วยส่วนตัวและยังไม่เปิดให้บุคคลอื่นใช้งานค่ะ" }]
      });
    }
    return;
  }

  if (event.type === "follow") {
    await reply(event.replyToken, helpText());
    return;
  }
  if (event.type !== "message" || event.message.type !== "text") return;

  try {
    const result = await agent.understand(event.message.text);
    if (result.action === "create") {
      if (!result.title || !result.scheduledAt) {
        await reply(event.replyToken, result.reply || "ต้องการให้เตือนวันไหนและกี่โมงคะ?");
        return;
      }
      const due = DateTime.fromISO(result.scheduledAt, { setZone: true });
      if (!due.isValid || due <= DateTime.now()) {
        await reply(event.replyToken, "เวลานั้นผ่านไปแล้วค่ะ กรุณาระบุวันและเวลาใหม่");
        return;
      }
      const reminder = store.create(
        config.OWNER_LINE_USER_ID,
        result.title,
        due.toUTC().toISO()!,
        result.recurrence
      );
      await reply(event.replyToken, `บันทึกแล้ว ✅\n${formatReminder(reminder, config.TIMEZONE)}`);
      return;
    }
    if (result.action === "list") {
      const reminders = store.list(config.OWNER_LINE_USER_ID);
      await reply(event.replyToken, reminders.length
        ? `รายการแจ้งเตือน\n\n${reminders.map(r => formatReminder(r, config.TIMEZONE)).join("\n\n")}`
        : "ยังไม่มีรายการแจ้งเตือนค่ะ");
      return;
    }
    if (result.action === "cancel") {
      const removed = result.reminderId && store.cancel(config.OWNER_LINE_USER_ID, result.reminderId);
      await reply(event.replyToken, removed
        ? `ยกเลิกการแจ้งเตือน #${result.reminderId} แล้วค่ะ`
        : "ไม่พบหมายเลขแจ้งเตือนนั้น ลองพิมพ์ “ดูรายการเตือน” ก่อนนะคะ");
      return;
    }
    await reply(event.replyToken, result.action === "help" ? helpText() : result.reply);
  } catch (error) {
    console.error("Event handler failed", error);
    await reply(event.replyToken, "ขออภัย ระบบขัดข้องชั่วคราว ลองส่งข้อความอีกครั้งนะคะ");
  }
}

async function reply(replyToken: string, text: string): Promise<void> {
  await line.replyMessage({ replyToken, messages: [{ type: "text", text: text.slice(0, 5000) }] });
}

function helpText(): string {
  return [
    "สวัสดีค่ะ ฉันคือผู้ช่วยส่วนตัวของคุณ 👋",
    "ลองพิมพ์:",
    "• เตือนส่งงานพรุ่งนี้ 9 โมง",
    "• เตือนกินยาทุกวัน 2 ทุ่ม",
    "• ดูรายการเตือน",
    "• ยกเลิกเตือน 3"
  ].join("\n");
}

startReminderWorker(store, line, config.TIMEZONE);
app.listen(config.PORT, () => console.log(`LINE agent listening on port ${config.PORT}`));

function shutdown() {
  store.close();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
