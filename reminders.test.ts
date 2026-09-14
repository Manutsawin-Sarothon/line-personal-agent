import { describe, expect, it } from "vitest";
import { nextOccurrence } from "../src/reminders.js";

describe("nextOccurrence", () => {
  it("advances recurring reminders", () => {
    const base = {
      id: 1, userId: "Uowner", title: "กินยา",
      dueAt: "2030-01-01T13:00:00.000Z", status: "active" as const
    };
    expect(nextOccurrence({ ...base, recurrence: "daily" })).toBe("2030-01-02T13:00:00.000Z");
    expect(nextOccurrence({ ...base, recurrence: "weekly" })).toBe("2030-01-08T13:00:00.000Z");
    expect(nextOccurrence({ ...base, recurrence: "none" })).toBeUndefined();
  });
});
