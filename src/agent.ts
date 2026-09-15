import { z } from "zod";
import { DateTime } from "luxon";

const AgentResultSchema = z.object({
  action: z.enum(["create", "list", "cancel", "help", "chat"]),
  title: z.string().nullable(),
  scheduledAt: z.string().nullable(),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
  reminderId: z.number().int().positive().nullable(),
  reply: z.string()
});

export type AgentResult = z.infer<typeof AgentResultSchema>;

export class PersonalAgent {
  constructor(private apiKey: string, private model: string, private timezone: string) {}

  async understand(message: string, now = DateTime.utc()): Promise<AgentResult> {
    const localNow = now.setZone(this.timezone);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `คุณคือ Lynn – PA ผู้ช่วยส่วนตัวใน LINE ภาษาไทย หน้าที่หลักคือจัดการการแจ้งเตือน
เวลาปัจจุบันคือ ${localNow.toISO()} เขตเวลา ${this.timezone}
ตีความคำอย่าง วันนี้ พรุ่งนี้ วันจันทร์ และเวลาแบบไทยตามเวลานี้
scheduledAt ต้องเป็น ISO 8601 พร้อม offset และต้องอยู่ในอนาคต
ถ้าเวลาหรือวันที่ไม่ครบจนเดาไม่ได้ ให้ action=chat และถามกลับสั้น ๆ ใน reply
ถ้าขอสร้างเตือน: action=create, ใส่ title/scheduledAt/recurrence
ถ้าขอดูรายการ: action=list
ถ้าขอยกเลิก: action=cancel และ reminderId ต้องเป็นเลขจากรายการ
ถ้าขอวิธีใช้: action=help
เรื่องทั่วไป: action=chat และตอบเป็นผู้ช่วยที่กระชับ สุภาพ ไม่อ้างว่าทำสิ่งที่ไม่ได้ทำ
ฟิลด์ที่ไม่เกี่ยวข้องให้เป็น null และ recurrence=none` }] },
        contents: [{ role: "user", parts: [{ text: message }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              action: { type: "STRING", enum: ["create", "list", "cancel", "help", "chat"] },
              title: { type: "STRING", nullable: true },
              scheduledAt: { type: "STRING", nullable: true },
              recurrence: { type: "STRING", enum: ["none", "daily", "weekly", "monthly"] },
              reminderId: { type: "INTEGER", nullable: true },
              reply: { type: "STRING" }
            },
            required: ["action", "title", "scheduledAt", "recurrence", "reminderId", "reply"]
          }
        }
      })
    });

    // Do not log request headers or provider error bodies, which may contain secrets.
    if (!response.ok) throw new Error(`Gemini API request failed (HTTP ${response.status})`);
    const data = await response.json() as {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
    };
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw new Error("Gemini returned an incomplete or blocked response");
    const text = candidate.content?.parts?.map(part => part.text ?? "").join("");
    if (!text) throw new Error("Gemini returned no structured result");
    return AgentResultSchema.parse(JSON.parse(text));
  }
}
