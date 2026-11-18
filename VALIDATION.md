# ผลตรวจโครงการ

- Frontend: npm run build สำเร็จ
- Backend: node --check src/server.js ผ่าน
- Backend: npm test ผ่าน 10 รายการ
- Tests ครอบคลุม input/ราคา, Google provider และ domain allowlist, รหัสอ้างอิง, อีเมล accepted, provider failure, missing configuration และป้องกันส่งซ้ำเมื่อ accepted
- การส่งอีเมลใน tests ใช้ mock provider ไม่ส่งอีเมลจริง
- ยังไม่ได้เชื่อม Firebase Admin, TiDB, Cloudinary, Resend จริง หรือ deploy ไปบัญชีของคุณ เพราะต้องใส่ credentials และยืนยันโดเมนก่อน
- ใช้ checklist ใน DEPLOY-TH.md ทดสอบ integration ก่อนเผยแพร่จริง
