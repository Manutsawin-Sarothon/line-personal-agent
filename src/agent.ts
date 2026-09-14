import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
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
  private client: OpenAI;

  constructor(apiKey: string, private model: string, private timezone: string) {
    this.client = new OpenAI({ apiKey });
  }

  async understand(message: string, now = DateTime.utc()): Promise<AgentResult> {
    const localNow = now.setZone(this.timezone);
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        {
          role: "system",
          content: `คุณคือผู้ช่วยส่วนตัวใน LINE ภาษาไทย หน้าที่หลักคือจัดการการแจ้งเตือน
เวลาปัจจุบันคือ ${localNow.toISO()} เขตเวลา ${this.timezone}
ตีความคำอย่าง วันนี้ พรุ่งนี้ วันจันทร์ และเวลาแบบไทยตามเวลานี้
scheduledAt ต้องเป็น ISO 8601 พร้อม offset และต้องอยู่ในอนาคต
ถ้าเวลาหรือวันที่ไม่ครบจนเดาไม่ได้ ให้ action=chat และถามกลับสั้น ๆ ใน reply
ถ้าขอสร้างเตือน: action=create, ใส่ title/scheduledAt/recurrence
ถ้าขอดูรายการ: action=list
ถ้าขอยกเลิก: action=cancel และ reminderId ต้องเป็นเลขจากรายการ
ถ้าขอวิธีใช้: action=help
เรื่องทั่วไป: action=chat และตอบเป็นผู้ช่วยที่กระชับ สุภาพ ไม่อ้างว่าทำสิ่งที่ไม่ได้ทำ
ฟิลด์ที่ไม่เกี่ยวข้องให้เป็น null และ recurrence=none`
        },
        { role: "user", content: message }
      ],
      text: { format: zodTextFormat(AgentResultSchema, "line_agent_action") }
    });

    if (!response.output_parsed) throw new Error("AI returned no structured result");
    return response.output_parsed;
  }
}
