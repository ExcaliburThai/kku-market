export function postInput(body){
 const title=body.title,description=body.description;
 const raw=body.price;
 const price=typeof raw==='string'&&/^\d+(?:\.\d{1,2})?$/.test(raw)?Number(raw):typeof raw==='number'?raw:NaN;
 if(typeof title!=='string'||!title.trim()||title.length>160)throw new Error('ชื่อสินค้าต้องมี 1–160 ตัวอักษร');
 if(typeof description!=='string'||!description.trim()||description.length>5000)throw new Error('รายละเอียดต้องมี 1–5000 ตัวอักษร');
 if(!Number.isFinite(price)||price<0||price>99999999.99||Math.abs(price*100-Math.round(price*100))>0.00001)throw new Error('ราคาไม่ถูกต้อง');
 return {title:title.trim(),description:description.trim(),price};
}
export function allowedGoogleUser(u,domains=[]){return u.firebase?.sign_in_provider==='google.com'&&u.email_verified===true&&typeof u.email==='string'&&(!domains.length||domains.includes(u.email.split('@')[1]?.toLowerCase()));}
export function emailMessage(code,title,action){return `บันทึก${action==='create'?'ประกาศใหม่':'การแก้ไขประกาศ'}สำเร็จ\nสินค้า: ${title}\nรหัสอ้างอิง: ${code}\n\nรหัสนี้ใช้ตรวจสอบรายการบันทึก ไม่ใช่รหัสผ่านหรือ OTP และใช้ยืนยันตัวตนไม่ได้\nKKU Market`;}
