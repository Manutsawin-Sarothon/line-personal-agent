# LINE Personal Agent

ผู้ช่วยส่วนตัวภาษาไทยบน LINE สำหรับสร้าง ดู และยกเลิกการแจ้งเตือนจากภาษาธรรมชาติ

## ความสามารถ

- `เตือนส่งงานพรุ่งนี้ 9 โมง`
- `เตือนกินยาทุกวัน 2 ทุ่ม`
- `ดูรายการเตือน`
- `ยกเลิกเตือน 3`
- ตอบคำถามทั่วไปแบบผู้ช่วยส่วนตัว
- จำกัดการใช้งานด้วย `OWNER_LINE_USER_ID`
- ตรวจสอบลายเซ็น LINE webhook และป้องกัน webhook ซ้ำ

## 1. สร้าง LINE Official Account

1. เข้า [LINE Official Account Manager](https://manager.line.biz/) และสร้างบัญชี
2. ไปที่ **Settings > Messaging API > Enable Messaging API**
3. เข้า [LINE Developers Console](https://developers.line.biz/console/) แล้วเปิด Channel ที่สร้างขึ้น
4. ในแท็บ **Messaging API** ออก Channel access token
5. คัดลอก Channel secret จากแท็บ **Basic settings**
6. คัดลอก **Your user ID** จากแท็บ **Basic settings** เพื่อใช้เป็นเจ้าของบอต

> ปัจจุบันต้องสร้าง Official Account ก่อน แล้วจึงเปิด Messaging API; สร้าง Messaging API channel จาก Developers Console โดยตรงไม่ได้แล้ว

## 2. รันบนเครื่อง

ต้องมี Node.js 24 ขึ้นไป (ใช้ SQLite ที่มากับ Node โดยตรง)

```bash
cp .env.example .env
npm install
npm run dev
```

กรอกค่าใน `.env` โดยห้ามส่งไฟล์นี้ให้ผู้อื่น หากทดสอบจากเครื่องตัวเอง ใช้ tunnel ที่มี HTTPS แล้วตั้ง webhook เป็น:

```text
https://YOUR-PUBLIC-DOMAIN/webhook
```

## 3. Deploy ด้วย Railway

1. อัปโหลดโปรเจกต์นี้ขึ้น GitHub แล้วเลือก **New Project > Deploy from GitHub Repo** ใน Railway
2. เพิ่ม Volume และ mount ที่ `/app/data` เพื่อไม่ให้ข้อมูลเตือนหายเมื่อ deploy ใหม่
3. ตั้ง Environment Variables ตาม `.env.example` โดยใช้ `DATABASE_PATH=/app/data/agent.db`
4. Generate Domain แล้วคัดลอก URL
5. ใน LINE Developers > Messaging API ตั้ง Webhook URL เป็น `https://โดเมนของคุณ/webhook`
6. กด **Verify**, เปิด **Use webhook**, และปิดข้อความตอบกลับอัตโนมัติใน Official Account Manager
7. เพิ่ม Official Account เป็นเพื่อนแล้วทดสอบ `เตือนทดสอบอีก 2 นาที`

## คำสั่งตรวจสอบ

```bash
npm run typecheck
npm test
npm run build
```

## หมายเหตุสำคัญ

- เซิร์ฟเวอร์ต้องทำงานตลอดเวลาเพื่อส่งแจ้งเตือนตามกำหนด
- Push message ของ LINE อาจถูกนับตามโควตาแพ็กเกจของ Official Account
- SQLite เหมาะกับผู้ช่วยส่วนตัวหนึ่งคน หากขยายหลายผู้ใช้หรือหลาย instance ควรเปลี่ยนเป็น PostgreSQL และ job queue
- สำรองไฟล์ฐานข้อมูล `/app/data/agent.db` เป็นระยะ
