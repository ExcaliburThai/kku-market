# คู่มือ Deploy — ทำตามลำดับนี้

## 0. ก่อนเริ่ม
ใช้ GitHub เก็บซอร์ส ไม่ใช่เก็บไฟล์รูปที่ผู้ใช้อัปโหลด
ชุดนี้แทน ZIP เก่าที่ใช้ Firebase Storage ได้ แต่ให้อยู่คนละโฟลเดอร์ก่อน อย่าคัดลอก node_modules หรือ .env เก่าทับโดยไม่ตรวจ
ต้องเตรียม Firebase web config, service-account JSON, TiDB credentials, Cloudinary credentials และ Resend API key
ห้ามส่ง private key/DB password/API Secret ขึ้น GitHub แม้ repo private
ถ้าเคย commit secret แล้ว .gitignore ไม่ทำให้ความลับหายจาก history ต้องเพิกถอน/หมุนกุญแจและล้างประวัติอย่างเหมาะสม

## 1. TiDB Cloud Starter (MySQL-compatible)
1. เข้า https://tidbcloud.com/ สร้าง Starter และเลือก MySQL-compatible
2. เลือก region ใกล้ Render ที่จะใช้เท่าที่บริการมีให้
3. ตั้งรหัสผ่าน และกด Connect จด Host, Port, Username ตามที่หน้าจอให้ ไม่ใช้ root/127.0.0.1 เดิม
4. เปิด SQL Editor หรือ MySQL Workbench เชื่อมตาม connection guide พร้อม TLS
5. ฐานใหม่: รัน database/schema.sql ทั้งไฟล์ จะสร้าง kku_market, users, posts, email_outbox
6. ถ้าใช้ฐานเดิมจาก ZIP เก่า: สำรองก่อน รัน migrate-from-v1.sql ครั้งเดียว แล้วรัน schema.sql เพื่อเพิ่ม outbox; รูปเก่าจาก Firebase ไม่ได้ย้ายอัตโนมัติ
7. ใน backend ตั้ง DB_SSL=true, DB_HOST/PORT/USER/PASSWORD ให้ตรง, DB_NAME=kku_market
8. หาก TLS certificate ไม่ผ่าน ใช้ CA จาก TiDB ใน DB_SSL_CA_PATH ห้ามแก้ rejectUnauthorized เป็น false
9. ตรวจ network access policy ให้ Render เชื่อมได้ ใช้รายการ outbound IP ของ Render หากบัญชี/บริการรองรับการจำกัด IP
10. ใช้ DB user เฉพาะแอปพร้อมสิทธิ์ SELECT/INSERT/UPDATE/DELETE บนฐานนี้ ถ้าบริการรองรับ ไม่ใช้บัญชีดูแลสำหรับ runtime

MySQL ในเครื่องยังใช้ได้: DB_HOST=127.0.0.1, DB_PORT=3306, DB_SSL=false เฉพาะ development

## 2. Firebase Authentication
โปรเจกต์เดิม kku-market-81b8d ใช้ต่อได้
1. Authentication > Sign-in method > Google ต้อง Enabled
2. Project settings > General > Your apps > แอปเว็บ > Config คัดลอก apiKey/authDomain/projectId/appId
3. ใส่ค่าตาม frontend/.env.example (Firebase web config ใช้ฝั่ง client ได้)
4. Authentication > Settings > Authorized domains เพิ่ม localhost และภายหลังเพิ่มโดเมน Vercel เช่น kku-market.vercel.app ไม่ใส่ https:// หรือ slash
5. Project settings > Service accounts > Generate new private key เก็บ JSON นอก repository
6. service account ต้องอยู่โปรเจกต์เดียวกัน และมี Firebase Authentication Admin หรือสิทธิ์เทียบเท่าเพื่อ verify token พร้อมตรวจ revoked
7. KKU Mail ต้องเป็นบัญชี Google และมหาวิทยาลัยอนุญาต OAuth app; Default รับทุก Google account ที่ยืนยันอีเมลแล้ว
8. หากต้องการจำกัดให้เฉพาะโดเมน กำหนด ALLOWED_EMAIL_DOMAINS เป็นโดเมนจริง comma-separated ฝั่ง Backend อย่าเดาโดเมนมหาวิทยาลัย

ไม่ต้องเปิด Firebase Storage หรือ Blaze สำหรับการเก็บรูปชุดนี้

## 3. Cloudinary
1. เข้า https://cloudinary.com/ สร้างบัญชี Free
2. Console > API Keys คัดลอก Cloud name, API Key, API Secret
3. ตั้งเฉพาะ Backend:
   CLOUDINARY_CLOUD_NAME=ค่าจริง
   CLOUDINARY_API_KEY=ค่าจริง
   CLOUDINARY_API_SECRET=ค่าจริง
4. ไม่ต้องสร้าง unsigned upload preset โค้ดนี้ใช้ authenticated upload ผ่าน Backend
5. หากบัญชีปิด untrusted/unsigned uploads ให้คงไว้ได้ ไม่ต้องเปิด public write
6. รูปจะอยู่ใต้ public_id kku-market/<UUID> และ URL เป็น HTTPS
7. แต่ละประกาศมีรูปเดียว; เปลี่ยนรูปใหม่และลบประกาศจะพยายามลบรูปเก่าด้วย
8. ติดตาม credits ใน Dashboard การเก็บ/ส่ง/แปลงรูปใช้โควตาร่วมกัน

## 4. อีเมลรหัสอ้างอิง — Resend เพิ่มอีกหนึ่งบริการ
Firebase Google Login ไม่ได้ให้สิทธิ์ส่ง Gmail ของผู้ login และไม่ต้องขอรหัสผ่าน Gmail ของผู้ใช้
ระบบส่งจากอีเมลของเว็บ ไปยังอีเมลที่ตรวจจาก Firebase token
1. สมัคร https://resend.com/
2. ถ้าส่งจริงหาผู้ใช้หลายคน: Domains > Add domain ใส่โดเมนที่คุณเป็นเจ้าของ เช่น mail.example.com แล้วเพิ่ม DNS ตามที่ Resend ให้และรอ Verified
3. สร้าง API key สำหรับส่งอีเมล จำกัดให้เฉพาะโดเมนได้ถ้ารองรับ
4. Backend: RESEND_API_KEY=re_... และ EMAIL_FROM=KKU Market <notifications@mail.example.com>
5. โดเมน example.com ในคู่มือเป็นตัวอย่าง ห้ามใช้ตามตัวอักษร
6. URL ฟรี xxx.vercel.app ไม่ใช่โดเมนที่คุณควบคุม DNS เพื่อยืนยันผู้ส่งโดยทั่วไป หากยังไม่มีโดเมน อาจต้องซื้อโดเมนหรือใช้ผู้ให้บริการอีเมลทางเลือกแล้วปรับโค้ด
7. สำหรับทดสอบเจ้าของบัญชีเท่านั้น: EMAIL_FROM=KKU Market <onboarding@resend.dev> และ login Google ด้วยอีเมลเดียวกับเจ้าของบัญชี Resend ผู้รับทั่วไปใช้วิธีนี้ไม่ได้
8. ไม่ใช้ SMTP เพราะ Render Free บล็อกพอร์ต SMTP ทั่วไป โค้ดส่ง HTTPS ไป Resend
9. ตรวจโควตาและราคา Resend ก่อนเปิดใช้ ไม่มีการรับประกันว่าส่งได้ฟรีไม่จำกัด
10. หากยังไม่ตั้งอีเมล ระบบบันทึกข้อมูลได้ แต่จะแสดงอีเมลรอส่ง และส่งซ้ำได้หลังตั้งค่าถูกต้อง
11. API accepted ไม่รับประกัน Inbox ต้องตรวจ delivery logs, Spam และ DKIM/SPF/DMARC ของโดเมน

ตัวอย่างอีเมล:
หัวข้อ KKU Market: บันทึกสำเร็จ KKU-...
เนื้อหา ชื่อสินค้าและรหัสอ้างอิง ไม่รวมกุญแจ/รหัสผ่าน
รหัสไม่ใช่ OTP ไม่มีขั้นตอนกรอกก่อนบันทึก

## 5. GitHub
แตก ZIP แล้วอัปโหลดเนื้อหาภายใน kku-market-deploy เป็น root ของ repo:
frontend/, backend/, database/, render.yaml, README.md, DEPLOY-TH.md, .gitignore, .github/
ถ้าใช้ VS Code terminal จาก root:
```sh
git init
git add .
git status
# ตรวจให้แน่ใจว่าไม่มี .env หรือ JSON กุญแจ ก่อน commit
git commit -m "Deploy KKU Market with Cloudinary and email receipts"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```
หากเป็น repo เดิม ไม่ต้อง git init หรือเพิ่ม origin ซ้ำ ให้เปลี่ยนไฟล์และ commit ตามปกติ
.gitignore ไม่ได้ป้องกันการลาก secret อัปโหลดผ่านหน้า GitHub ด้วยตนเอง อย่าเลือกไฟล์ลับ

## 6. Render Backend
1. Dashboard > New > Web Service > เลือก GitHub repo
2. Runtime = Node (อย่าเลือก Static Site)
3. Root Directory = backend
4. Build Command = npm ci
5. Start Command = npm start
6. Instance type = Free สำหรับทดลอง
7. Health check path = /health
8. Environment variables: ดู backend/.env.example
   NODE_ENV=production
   GOOGLE_CLOUD_PROJECT=kku-market-81b8d
   GOOGLE_APPLICATION_CREDENTIALS=/etc/secrets/service-account.json
   DB_SSL=true และข้อมูล TiDB
   Cloudinary ทั้ง 3 ค่า
   Resend 2 ค่า
   FRONTEND_ORIGINS=https://kku-market.vercel.app (เปลี่ยนถ้าใช้โดเมนอื่น)
9. Environment > Secret Files > Add secret file ชื่อ service-account.json วางเนื้อหา JSON ที่ดาวน์โหลดจาก Firebase เฉพาะในช่องลับนี้
10. ไม่ใส่ GOOGLE_APPLICATION_CREDENTIALS เป็น D:/... บน Render เพราะ path Windows ไม่มีในเซิร์ฟเวอร์ Linux
11. Deploy รอ API ready แล้วจด URL เช่น https://kku-market-api-xxxx.onrender.com
12. ทดสอบ /health ต้อง ok:true และ /ready ต้อง database:true (/ready ยังไม่ทดสอบ schema/cloudinary/email)
13. หากเปิดผ่าน Blueprint render.yaml แทนขั้น 1–7 ยังต้องเพิ่ม Secret File และค่า sync:false ด้วยตนเอง
14. Render มี proxy โค้ดตั้ง trust proxy=1 เมื่อพบ RENDER env; ไม่ต้องตั้งเพิ่ม
15. Free พักเมื่อ idle และอาจรอประมาณหนึ่งนาที; อย่าเก็บฐานหรือไฟล์อัปโหลดบน local disk

## 7. Vercel Frontend
1. Add New > Project > Import GitHub repo
2. Root Directory=frontend; Framework=Vite
3. Build=npm run build; Output=dist; Install=npm ci
4. Environment variables (เลือก Production และ Preview ตามที่ใช้):
   VITE_FIREBASE_API_KEY=ค่าจาก Firebase
   VITE_FIREBASE_AUTH_DOMAIN=kku-market-81b8d.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=kku-market-81b8d
   VITE_FIREBASE_APP_ID=ค่าจาก Firebase
   VITE_API_URL=https://YOUR_API.onrender.com
5. ห้ามใส่ Cloudinary secret, Resend key, service-account JSON หรือ DB password ใน VITE_ variables
6. Deploy แล้วนำโดเมนจริงไปใส่ Firebase Authorized domains และ Render FRONTEND_ORIGINS (ใส่ https:// ไม่มี slash ท้าย)
7. ถ้ามีหลาย frontend origins คั่น comma; ใช้ exact domains ไม่เปิดทุก origin
8. เปลี่ยน VITE_ variables แล้วต้อง redeploy เพราะฝังค่าตอน build
9. ถ้าเปิดเว็บออนไลน์ ห้าม VITE_API_URL เป็น localhost:8080
10. Preview URL ใหม่ต้องเพิ่ม domain ใน Firebase และ CORS ด้วย หรือทดสอบจาก production domain เดียวก่อน

## 8. ทดสอบก่อนแจก URL
[ ] หน้าเว็บแสดงแม้ยังไม่ได้ login และอ่านประกาศได้
[ ] Login Gmail และ KKU ที่ได้รับอนุญาต ผ่าน backend /api/me
[ ] สร้างประกาศแบบไม่มีรูป รีเฟรชแล้วข้อมูลอยู่
[ ] สร้างพร้อม JPG/PNG/WEBP จริง <=5 MB รูปแสดงจาก Cloudinary
[ ] กดบันทึกแล้วเห็นรหัส KKU-... ในประวัติส่วนตัว
[ ] ผู้รับตรงอีเมลที่ login ตรวจ Inbox/Spam/Resend logs
[ ] เมื่อปิด/ตั้ง Resend ผิด ข้อมูลยังอยู่และอีเมลเป็น pending แล้ว retry หลังแก้ได้
[ ] แก้ไขแล้วได้รหัสใหม่ ลบรูปเก่าตาม best effort
[ ] บัญชีอื่นแก้ไข/ลบประกาศหรืออ่านประวัติของคุณไม่ได้
[ ] ไฟล์ >5 MB หรือปลอม MIME ต้องถูกปฏิเสธ
[ ] logout แล้ว API เขียน/ส่งซ้ำต้องถูกปฏิเสธ
[ ] โค้ดบน GitHub ไม่มี secret

## ปัญหาที่พบบ่อย
- หน้าว่าง: ตรวจ Console; ชุดนี้จะแสดงคำแนะนำหาก Firebase config ไม่ครบ
- Failed to fetch: ตรวจ VITE_API_URL และ FRONTEND_ORIGINS, /health, Render logs
- auth/unauthorized-domain: เพิ่มชื่อโดเมนใน Firebase
- auth/popup-blocked: อนุญาต popups แล้วกดปุ่มใหม่
- incorrect aud: Firebase project ฝั่ง web/backend/service account ต้องตรง
- credential file not found: ในเครื่องใช้ path จริง บน Render ใช้ Secret Files path
- ER_NO_SUCH_TABLE: รัน schema ในฐานที่ DB_NAME ระบุ
- TLS error: DB_SSL=true พร้อม CA ที่ถูกต้อง อย่าปิดตรวจ certificate
- อีเมล pending / EMAIL_PROVIDER_403: ยืนยันโดเมนและ sender หรือทดสอบกับอีเมลเจ้าของ Resend เท่านั้น
- บันทึกช้า: Render อาจกำลังตื่นหรือรอ Cloudinary/Resend; timeout หน้าเว็บ 90 วินาที หลัง timeout ตรวจประวัติก่อน submit ใหม่

## สิ่งที่ยังต้องทำเอง
สร้างบัญชี/บริการ ใส่ secrets ยืนยัน DNS และกด Deploy ใน account ของคุณ โค้ดนี้ไม่สามารถสร้างโดเมนหรือ secret แทนได้
ทุกบริการมี quota/เงื่อนไขราคา อย่าเปิดจ่ายเงินโดยไม่ตรวจ Dashboard
