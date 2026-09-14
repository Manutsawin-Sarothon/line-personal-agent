export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export type Reminder = {
  id: number;
  userId: string;
  title: string;
  dueAt: string;
  recurrence: Recurrence;
  status: "active" | "sent" | "cancelled";
};
