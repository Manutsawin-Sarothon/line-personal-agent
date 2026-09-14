import { DatabaseSync } from "node:sqlite";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import type { Recurrence, Reminder } from "./types.js";

export class ReminderStore {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        due_at TEXT NOT NULL,
        recurrence TEXT NOT NULL DEFAULT 'none',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_sent_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_due
        ON reminders(status, due_at);
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT PRIMARY KEY,
        processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  create(userId: string, title: string, dueAt: string, recurrence: Recurrence): Reminder {
    const result = this.db.prepare(
      "INSERT INTO reminders (user_id, title, due_at, recurrence) VALUES (?, ?, ?, ?)"
    ).run(userId, title, dueAt, recurrence);
    return this.get(Number(result.lastInsertRowid))!;
  }

  get(id: number): Reminder | undefined {
    const row = this.db.prepare("SELECT * FROM reminders WHERE id = ?").get(id) as DbRow | undefined;
    return row && mapRow(row);
  }

  list(userId: string): Reminder[] {
    const rows = this.db.prepare(
      "SELECT * FROM reminders WHERE user_id = ? AND status = 'active' ORDER BY due_at LIMIT 50"
    ).all(userId) as DbRow[];
    return rows.map(mapRow);
  }

  cancel(userId: string, id: number): boolean {
    return Number(this.db.prepare(
      "UPDATE reminders SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'active'"
    ).run(id, userId).changes) > 0;
  }

  due(nowIso: string): Reminder[] {
    return (this.db.prepare(
      "SELECT * FROM reminders WHERE status = 'active' AND due_at <= ? ORDER BY due_at LIMIT 100"
    ).all(nowIso) as DbRow[]).map(mapRow);
  }

  markSent(id: number, nextDueAt?: string): void {
    if (nextDueAt) {
      this.db.prepare(
        "UPDATE reminders SET due_at = ?, last_sent_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(nextDueAt, id);
    } else {
      this.db.prepare(
        "UPDATE reminders SET status = 'sent', last_sent_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(id);
    }
  }

  claimEvent(eventId: string): boolean {
    return Number(this.db.prepare("INSERT OR IGNORE INTO processed_events (event_id) VALUES (?)")
      .run(eventId).changes) > 0;
  }

  releaseEvent(eventId: string): void {
    this.db.prepare("DELETE FROM processed_events WHERE event_id = ?").run(eventId);
  }

  pruneEvents(): void {
    this.db.prepare("DELETE FROM processed_events WHERE processed_at < datetime('now', '-7 days')").run();
  }

  close(): void { this.db.close(); }
}

type DbRow = {
  id: number; user_id: string; title: string; due_at: string;
  recurrence: Recurrence; status: Reminder["status"];
};

function mapRow(row: DbRow): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    dueAt: row.due_at,
    recurrence: row.recurrence,
    status: row.status
  };
}
