# KKU Market — Deploy edition v2

React + Vercel / Firebase Google Login / Express + Render / TiDB MySQL-compatible / Cloudinary / Resend email receipts

เริ่มอ่าน DEPLOY-TH.md (คู่มือภาษาไทยทีละขั้น)

## ฟังก์ชัน
- Google Login สำหรับ Gmail และบัญชี Google Workspace ที่ได้รับอนุญาต เช่น KKU Mail
- อ่านและค้นหาประกาศล่าสุด 100 รายการ โดยไม่ต้อง login
- สร้าง/แก้ไข/ลบเฉพาะประกาศของตนเอง
- อัปโหลด JPG, PNG, WEBP ไม่เกิน 5 MB ตรวจ magic bytes ฝั่ง server
- อัปโหลดไป Cloudinary ฝั่ง Backend ไม่เปิดเผย API Secret
- บันทึกข้อมูลแบบ transaction พร้อมคิวอีเมลใน TiDB
- ทุกครั้งที่สร้าง/แก้ไข ออกรหัสอ้างอิงใหม่ KKU-<UUID> ส่งไปอีเมลจาก Firebase token ของผู้ login เท่านั้น
- แสดงประวัติรหัสส่วนตัว และส่งอีเมลซ้ำได้เมื่อยังส่งไม่สำเร็จ
- ส่งอีเมลไม่ผ่านจะไม่ย้อนลบข้อมูลหรือหลอกว่าบันทึกไม่สำเร็จ
- รหัสอ้างอิงไม่ใช่ OTP ไม่ต้องกรอกรหัสก่อนบันทึก ไม่ใช้ยืนยันตัวตน

## โครงสร้าง
frontend/ — React + Vite, Vercel config
backend/ — Express API, Cloudinary และ Resend
backend/src/validation.test.js — tests ตรวจ input/auth/receipt
backend/src/mail.test.js — tests การส่งอีเมล/คิว (เมื่อมีไฟล์นี้)
database/schema.sql — schema สำหรับติดตั้งใหม่
database/migrate-from-v1.sql — migration จาก ZIP เก่า ไม่ลบข้อมูลเดิม
render.yaml — ตัวอย่าง Render Blueprint (ต้องเพิ่ม Secret File เอง)
.github/workflows/check.yml — ตรวจ tests และ frontend build บน GitHub
DEPLOY-TH.md — ตั้งค่าและ Deploy
.env.example ในแต่ละโฟลเดอร์ — ชื่อค่าที่ต้องกรอก ไม่มี secret จริง

## เริ่มในเครื่อง Windows
Node.js 22.16 ขึ้นไป
Terminal 1:
```powershell
cd D:\kku-market-deploy\backend
Copy-Item .env.example .env
npm ci
# กรอก .env และเตรียม schema ก่อน
npm run dev
```
Terminal 2:
```powershell
cd D:\kku-market-deploy\frontend
Copy-Item .env.example .env.local
npm ci
# กรอก .env.local ก่อน
npm run dev
```
ถ้ามีไฟล์ .env เดิมแล้ว ห้าม copy ทับ ให้เทียบและเพิ่มค่าที่ขาดแทน

## ขอบเขตที่ควรรู้
- ยังไม่ได้ Deploy เข้า account ของคุณ ไม่มี secret จริงใน ZIP
- TiDB เป็น MySQL-compatible ไม่ใช่ MySQL โดยตรง ต้องตรวจ requirement ของงาน
- ข้อมูลประกาศและรูปเป็นสาธารณะ; อีเมลและรหัสอ้างอิงไม่อยู่ใน API ประกาศสาธารณะ
- ไม่ใช่ระบบชำระเงิน ไม่มีแชต แอดมิน moderation หรือแบ่งหน้า (ล่าสุด 100)
- rate limit เป็น in-memory ต่อ instance ไม่ใช่ distributed
- ไม่เก็บไฟล์ถาวรบน Render ใช้ Cloudinary เท่านั้น
- การลบรูปเก่าเป็น best effort; หากเครือข่ายขาดหรือ process หยุดกลางทาง อาจมี orphan assets ต้องตรวจ/ลบภายหลัง
- คิวอีเมลบันทึกถาวร แต่ยังไม่มี background worker: ส่งทันทีหนึ่งครั้ง และเจ้าของกด retry ได้; กรณี process หยุด คิวที่กำลังส่ง retry ได้หลัง 2 นาที
- Resend accepted หมายถึงผู้ให้บริการรับงาน ไม่ได้ยืนยันว่า Gmail ส่งถึง Inbox; ตรวจ Spam และ Resend delivery logs ได้
- Idempotency key ลดการส่งอีเมลซ้ำตามช่วงเวลาที่ผู้ให้บริการรองรับ ไม่รับประกัน exactly-once เมื่อ retry ข้ามช่วงนั้น
- การ submit หลัง browser timeout อาจสร้างซ้ำ ถ้าคำขอแรกบันทึกแล้ว ให้รีเฟรชตรวจรายการ/ประวัติก่อนกดบันทึกใหม่
- ไม่ได้ส่งอีเมลตอนลบประกาศ ส่งเฉพาะสร้างและแก้ไข
- สิทธิ์บริการและโควตาของ Free plan เปลี่ยนได้ ตรวจ Dashboard ก่อนเปิดใช้จริง
- ก่อน production เพิ่ม monitoring, backup/retention, App Check หรือ anti-abuse และจัดการ privacy policy/ข้อมูลอีเมล

เอกสารหลัก:
https://firebase.google.com/docs/auth/web/google-signin
https://render.com/docs/configure-environment-variables
https://docs.pingcap.com/tidbcloud/secure-connections-to-serverless-clusters/
https://cloudinary.com/documentation/node_image_and_video_upload
https://resend.com/docs/api-reference/emails/send-email
