import { DateTime } from "luxon";
import type { messagingApi } from "@line/bot-sdk";
import type { ReminderStore } from "./db.js";
import type { Reminder } from "./types.js";

export function formatReminder(reminder: Reminder, timezone: string): string {
  const when = DateTime.fromISO(reminder.dueAt, { zone: "utc" })
    .setZone(timezone)
    .setLocale("th")
    .toFormat("ccc d LLL yyyy เวลา HH:mm");
  const repeat = reminder.recurrence === "none" ? "" : ` • ซ้ำ${repeatThai(reminder.recurrence)}`;
  return `#${reminder.id} ${reminder.title}\n${when}${repeat}`;
}

function repeatThai(value: Reminder["recurrence"]): string {
  return ({ daily: "ทุกวัน", weekly: "ทุกสัปดาห์", monthly: "ทุกเดือน", none: "" })[value];
}

export function nextOccurrence(reminder: Reminder): string | undefined {
  const due = DateTime.fromISO(reminder.dueAt, { zone: "utc" });
  if (reminder.recurrence === "daily") return due.plus({ days: 1 }).toUTC().toISO()!;
  if (reminder.recurrence === "weekly") return due.plus({ weeks: 1 }).toUTC().toISO()!;
  if (reminder.recurrence === "monthly") return due.plus({ months: 1 }).toUTC().toISO()!;
  return undefined;
}

export function startReminderWorker(
  store: ReminderStore,
  line: messagingApi.MessagingApiClient,
  timezone: string,
  intervalMs = 15_000
): NodeJS.Timeout {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (const reminder of store.due(DateTime.utc().toISO()!)) {
        try {
          await line.pushMessage({
            to: reminder.userId,
            messages: [{ type: "text", text: `⏰ ถึงเวลาแล้ว\n${reminder.title}` }]
          });
          store.markSent(reminder.id, nextOccurrence(reminder));
        } catch (error) {
          console.error("Failed to send reminder", reminder.id, error);
        }
      }
    } finally {
      running = false;
    }
  };
  void tick();
  return setInterval(() => void tick(), intervalMs);
}
