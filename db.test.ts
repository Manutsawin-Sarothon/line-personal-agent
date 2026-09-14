import { describe, expect, it } from "vitest";
import { ReminderStore } from "../src/db.js";

describe("ReminderStore", () => {
  it("creates, lists and cancels a reminder per user", () => {
    const store = new ReminderStore(":memory:");
    const reminder = store.create("Uowner", "ส่งงาน", "2030-01-01T02:00:00.000Z", "none");
    expect(store.list("Uowner")).toHaveLength(1);
    expect(store.list("Uother")).toHaveLength(0);
    expect(store.cancel("Uother", reminder.id)).toBe(false);
    expect(store.cancel("Uowner", reminder.id)).toBe(true);
    expect(store.list("Uowner")).toHaveLength(0);
    store.close();
  });

  it("deduplicates webhook events", () => {
    const store = new ReminderStore(":memory:");
    expect(store.claimEvent("event-1")).toBe(true);
    expect(store.claimEvent("event-1")).toBe(false);
    store.releaseEvent("event-1");
    expect(store.claimEvent("event-1")).toBe(true);
    store.close();
  });
});
