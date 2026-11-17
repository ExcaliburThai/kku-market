# KKU Market — React + MySQL + Google Cloud

เว็บตัวอย่างพร้อมซอร์สทั้ง frontend/backend รองรับ Google Login, ลงประกาศพร้อมรูป, ค้นหา, แก้ไขและลบประกาศของตนเอง หน้าเว็บภาษาไทย รองรับมือถือ

## บริการที่ใช้
- Frontend: React + Vite บน Vercel
- Login: Firebase Authentication (Google provider)
- API: Express บน Google Cloud Run
- Database: Google Cloud SQL for MySQL 8
- รูป: Cloud Storage for Firebase

ไฟล์นี้เป็นซอร์สโค้ด ต้องสร้างบริการและใส่ค่าของคุณเองก่อนใช้งาน ไม่มีบัญชีหรือ secret จริงรวมอยู่ และยังไม่ได้ deploy ให้ มีค่าใช้บริการตามการใช้งาน โดย Cloud SQL และ Storage ต้องตรวจสอบ billing ใน Console ก่อนเปิดใช้

## 1. Firebase / Google Login
1. สร้าง Firebase project และลงทะเบียน Web app คัดลอก Firebase config
2. Authentication > Sign-in method > เปิด Google และกำหนด support email
3. Authentication > Settings > Authorized domains เพิ่ม localhost และโดเมน Vercel จริงของคุณ (รวม custom domain ถ้ามี)
4. ตั้ง OAuth consent screen ให้รองรับผู้ใช้นอกองค์กรหากรับ Gmail; ถ้าอยู่ testing ให้เพิ่ม test users ตามการตั้งค่า Console
5. Gmail ใช้ได้โดย Google Login ส่วน KKU Mail ต้องเป็นบัญชี Google Workspace และผู้ดูแลมหาวิทยาลัยต้องอนุญาตแอป ไม่สามารถรับประกันว่านโยบายของมหาวิทยาลัยจะอนุญาตทุกแอป
6. Storage > สร้าง bucket และคัดลอกชื่อ bucket จริง ห้ามเดาชื่อจากตัวอย่าง
7. ติดตั้ง Firebase CLI และ deploy rules จาก root:
   `npx firebase-tools deploy --only storage --project YOUR_PROJECT_ID`

Default รับทุก Google account ที่ยืนยันอีเมลแล้ว หากต้องการจำกัด Gmail และโดเมนมหาวิทยาลัย ให้กำหนด ALLOWED_EMAIL_DOMAINS เป็นรายการโดเมนจริงที่ผู้ดูแลยืนยัน ค่าดังกล่าวจำกัด API เท่านั้น ต้องเพิ่ม allowlist เดียวกันใน Storage Rules ด้วย (เช่นตรวจ request.auth.token.email ด้วย regex ที่ยึดทั้งสตริง) ก่อนเปิดใช้แบบจำกัดโดเมน ห้ามใช้ hd บนหน้าเว็บเป็นตัวตรวจสิทธิ์

## 2. MySQL
สร้าง MySQL 8 ในเครื่องหรือ Cloud SQL แล้ว import:
```sh
mysql -u root -p < database/schema.sql
```
ใช้ผู้ใช้ฐานข้อมูลเฉพาะแอปที่มี SELECT/INSERT/UPDATE/DELETE บน kku_market.* สำหรับ runtime ไม่ใช้ root

## 3. รัน Backend ในเครื่อง
ใช้ Node.js 22 และ MySQL ที่รันอยู่
```sh
cd backend
cp .env.example .env
npm install
npm test
npm run dev
```
แก้ .env ให้ตรงเครื่องก่อนเริ่ม ตั้ง GOOGLE_APPLICATION_CREDENTIALS เป็น path ของ service account JSON สำหรับเครื่องพัฒนาเท่านั้น เก็บไฟล์นอก repo โดยให้สิทธิ์ Firebase Authentication Admin (ใช้ตรวจ revoked token) และ Storage Object User เฉพาะ bucket ที่ต้องใช้ ห้ามส่งไฟล์นี้ขึ้น Vercel หรือใส่ VITE_ variables
ตรวจ API: http://localhost:8080/health

## 4. รัน Frontend
เปิด terminal อีกหน้าต่าง:
```sh
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
กรอก Firebase web config และ VITE_API_URL=http://localhost:8080 เปิด URL ที่ Vite แสดง โดยปกติ http://localhost:5173
Firebase web config เป็นข้อมูลฝั่ง client ได้ แต่ service account และรหัส MySQL ต้องอยู่ Backend เท่านั้น

## 5. Deploy Backend ไป Cloud Run
เปิด Cloud Run, Cloud Build, Artifact Registry, Cloud SQL Admin และ Firebase APIs ที่เกี่ยวข้อง
สร้าง runtime service account เฉพาะแอป ให้ roles/cloudsql.client, สิทธิ์ Firebase Authentication Admin และ Storage Object User เฉพาะ bucket; ถ้าใช้ Secret Manager ให้ secretAccessor เฉพาะ secrets ที่ต้องอ่าน
ตั้ง Cloud SQL ใน region เดียวกับ Cloud Run และเชื่อมผ่าน Cloud SQL connection ของบริการ ห้ามเปิดฐานข้อมูลให้ทุก IP
จากโฟลเดอร์ backend ใช้ตัวอย่าง (แทนค่าทั้งหมด):
```sh
gcloud run deploy kku-market-api --source . --region asia-southeast1 --allow-unauthenticated --service-account RUNTIME_SA_EMAIL --add-cloudsql-instances PROJECT:REGION:INSTANCE --max-instances 3 --concurrency 20
```
API service ต้องรับ request จาก browser ได้ ส่วน endpoints เขียนข้อมูลตรวจ Firebase token ในโค้ด ตั้ง environment variables จาก backend/.env.example ใน Cloud Run:
- GOOGLE_CLOUD_PROJECT และ FIREBASE_STORAGE_BUCKET ให้ตรง Firebase
- INSTANCE_CONNECTION_NAME=PROJECT:REGION:INSTANCE
- DB_USER, DB_NAME และ DB_PASSWORD (ใช้ Secret Manager สำหรับ password)
- FRONTEND_ORIGINS=https://YOUR_APP.vercel.app (หลายโดเมนคั่น comma ไม่มี slash ท้าย)
- ALLOWED_EMAIL_DOMAINS เว้นว่างเพื่อรับทุก Google account
ไม่ตั้ง GOOGLE_APPLICATION_CREDENTIALS บน Cloud Run ให้ใช้ attached service account และ Application Default Credentials; PORT จัดการโดย Cloud Run
ตัวอย่างใช้ Cloud SQL Unix socket; ถ้าเลือก private-IP-only ต้องตั้ง VPC connectivity เพิ่มเองและปรับการเชื่อมต่อให้เหมาะสม
Pool ใช้สูงสุด 5 connections ต่อ instance; ปรับ max-instances ให้เหมาะกับจำนวน connections ของฐานข้อมูล

## 6. Deploy หน้าเว็บไป Vercel
1. นำโครงการขึ้น Git repository ของคุณ แล้ว Import ใน Vercel
2. Root Directory = frontend, Framework = Vite
3. Build Command = npm run build, Output Directory = dist
4. เพิ่ม environment variables ตาม frontend/.env.example โดย VITE_API_URL เป็น URL HTTPS ของ Cloud Run ไม่มี slash ท้าย
5. Deploy แล้วนำโดเมนไปเพิ่มใน Firebase Authorized domains และ FRONTEND_ORIGINS ของ Cloud Run
6. ถ้าแก้ VITE_ variables ต้อง redeploy frontend

## ตรวจหลังตั้งค่า
- /health ได้ {ok:true} (ตรวจเฉพาะ process ไม่ได้ตรวจ DB)
- เปิดเว็บ ดูรายการได้ก่อน login
- ทดสอบ Google Login ด้วย Gmail และบัญชี KKU ที่ได้รับอนุญาต
- สร้างประกาศพร้อม JPG/PNG/WEBP ไม่เกิน 5 MB
- บัญชีอื่นแก้ไข/ลบประกาศไม่ได้ และเรียก API โดยไม่มี token ต้องได้ 401
- รูปใหม่แสดงได้; เปลี่ยนรูปและลบประกาศแล้วรูปเก่าถูกลบโดย backend
- ทดสอบ Storage Rules ด้วย Firebase Emulator/Rules Playground ก่อนใช้งานจริง

## ขอบเขตตัวอย่าง
รายการและรูปเป็นสาธารณะ ไม่ควรใส่ข้อมูลส่วนตัวในรายละเอียด ไม่มีระบบชำระเงิน แชต moderation หรือ pagination (แสดงล่าสุด 100 รายการ) การจำกัด rate เป็น in-memory ต่อ instance ไม่ใช่ distributed quota การตรวจชนิดรูปใช้ metadata/MIME ไม่ใช่สแกนเนื้อหาไฟล์ ควรเพิ่มตรวจไฟล์ฝั่ง server, App Check, monitoring, backups และงานเก็บรูป orphan สำหรับระบบจริง การอัปโหลดสำเร็จแต่ปิดหน้าเว็บก่อนสร้างประกาศอาจทิ้งรูป orphan; การลบรูปเป็น best effort และการแก้ไขพร้อมกันใช้ last-write-wins

## โครงสร้าง
frontend/src/main.jsx — หน้าเว็บและ login/upload
frontend/src/firebase.js — Firebase client
backend/src/server.js — API, token verification, MySQL, cleanup รูป
backend/src/validation.js — ตรวจข้อมูลประกาศ
database/schema.sql — โครงสร้าง MySQL
storage.rules — สิทธิ์อัปโหลดรูป

เอกสารทางการ: https://firebase.google.com/docs/auth/web/google-signin , https://firebase.google.com/docs/storage/web/start , https://cloud.google.com/sql/docs/mysql/connect-run , https://vercel.com/docs/frameworks/frontend/vite

## ผลตรวจในสภาพแวดล้อมที่สร้าง ZIP
ผ่าน node --check สำหรับ backend และ validation tests 4 รายการ ยังไม่ได้ทดสอบ frontend build หรือ integration กับ Google/MySQL เพราะติดตั้ง dependencies ในสภาพแวดล้อมนี้ไม่สำเร็จ ต้องรัน npm install และ npm run build ที่ frontend หลังแตกไฟล์
