import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { v2 as cloudinary } from 'cloudinary';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { pool } from './db.js';
import { postInput,allowedGoogleUser,emailMessage } from './validation.js';
import { sendReceipt } from './mail.js';
for(const key of ['GOOGLE_CLOUD_PROJECT','DB_HOST','DB_USER','DB_PASSWORD','DB_NAME','FRONTEND_ORIGINS'])if(!process.env[key])throw new Error(`Missing environment variable: ${key}`);
initializeApp({credential:applicationDefault(),projectId:process.env.GOOGLE_CLOUD_PROJECT});
cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});
const app=express();if(process.env.RENDER)app.set('trust proxy',1);
const origins=(process.env.FRONTEND_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
app.use(helmet(),cors({origin:(origin,cb)=>cb(null,!origin||origins.includes(origin))}),express.json({limit:'32kb'}));
app.use('/api',rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'เรียกใช้งานถี่เกินไป กรุณารอสักครู่'}}));
const writeLimit=rateLimit({windowMs:60000,limit:10,message:{error:'บันทึกถี่เกินไป กรุณารอหนึ่งนาที'}});
const mailLimit=rateLimit({windowMs:60000,limit:3,message:{error:'ส่งอีเมลซ้ำถี่เกินไป กรุณารอหนึ่งนาที'}});
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:1,fields:4,fieldSize:20000,parts:5}}).single('image');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const fault=(status,message)=>Object.assign(new Error(message),{status});
const auth=wrap(async(req,res,next)=>{
 const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))throw fault(401,'กรุณาเข้าสู่ระบบ');
 let u;try{u=await getAuth().verifyIdToken(h.slice(7),true);}catch(e){console.error('Firebase Auth:',e.code);throw fault(401,'เข้าสู่ระบบไม่สำเร็จ กรุณาออกจากระบบแล้วลองใหม่');}
 const domains=(process.env.ALLOWED_EMAIL_DOMAINS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(!allowedGoogleUser(u,domains))throw fault(403,'บัญชี Google นี้ไม่ได้รับอนุญาต');
 await pool.execute('INSERT INTO users(firebase_uid,name,email) VALUES(?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),email=VALUES(email)',[u.uid,u.name||'สมาชิก',u.email]);req.user=u;next();
});
const validId=(req,res,next)=>/^\d{1,10}$/.test(req.params.id)?next():next(fault(400,'รหัสประกาศไม่ถูกต้อง'));
async function uploadImage(file){
 if(!file)return null;
 const type=await fileTypeFromBuffer(file.buffer);if(!['image/jpeg','image/png','image/webp'].includes(type?.mime))throw fault(400,'ใช้ไฟล์ JPG, PNG หรือ WEBP จริงเท่านั้น');
 if(!process.env.CLOUDINARY_API_SECRET)throw fault(503,'ยังไม่ได้ตั้งค่า Cloudinary');
 const result=await new Promise((resolve,reject)=>{
  const stream=cloudinary.uploader.upload_stream({resource_type:'image',public_id:`kku-market/${randomUUID()}`,overwrite:false,timeout:45000},(e,r)=>e?reject(fault(502,'อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่')):resolve(r));stream.on('error',reject);stream.end(file.buffer);
 });return {url:result.secure_url,publicId:result.public_id};
}
async function cleanImage(id){if(id)try{await cloudinary.uploader.destroy(id,{resource_type:'image',invalidate:true,timeout:10000});}catch{console.error('Cloudinary cleanup failed; inspect orphan assets');}}
app.get('/health',(_,res)=>res.json({ok:true}));
app.get('/ready',wrap(async(_,res)=>{await pool.query('SELECT 1');res.json({ok:true,database:true});}));
app.get('/api/me',auth,(req,res)=>res.json({uid:req.user.uid,name:req.user.name,email:req.user.email}));
app.get('/api/posts',wrap(async(_,res)=>{const [rows]=await pool.query('SELECT p.id,p.owner_uid,p.title,p.description,p.price,p.image_url,p.created_at,u.name AS seller_name FROM posts p JOIN users u ON p.owner_uid=u.firebase_uid ORDER BY p.id DESC LIMIT 100');res.json(rows);}));
async function savePost(req,res){
 let data;try{data=postInput(req.body);}catch(e){throw fault(400,e.message);}
 const id=req.params.id;
 if(id){const [rows]=await pool.execute('SELECT id FROM posts WHERE id=? AND owner_uid=?',[id,req.user.uid]);if(!rows.length)throw fault(404,'ไม่พบประกาศของคุณ');}
 let image=await uploadImage(req.file),committed=false,oldImage=null,connection;
 const code=`KKU-${randomUUID().toUpperCase()}`,action=id?'update':'create';let postId=id;
 try{
  connection=await pool.getConnection();await connection.beginTransaction();
  if(id){const [rows]=await connection.execute('SELECT image_public_id FROM posts WHERE id=? AND owner_uid=? FOR UPDATE',[id,req.user.uid]);if(!rows.length)throw fault(404,'ไม่พบประกาศของคุณ');
   oldImage=image?rows[0].image_public_id:null;
   await connection.execute(`UPDATE posts SET title=?,description=?,price=?${image?',image_url=?,image_public_id=?':''} WHERE id=? AND owner_uid=?`,[data.title,data.description,data.price,...(image?[image.url,image.publicId]:[]),id,req.user.uid]);
  }else{const [r]=await connection.execute('INSERT INTO posts(owner_uid,title,description,price,image_url,image_public_id) VALUES(?,?,?,?,?,?)',[req.user.uid,data.title,data.description,data.price,image?.url||null,image?.publicId||null]);postId=r.insertId;}
  await connection.execute('INSERT INTO email_outbox(code,owner_uid,post_id,recipient,subject,body) VALUES(?,?,?,?,?,?)',[code,req.user.uid,postId,req.user.email,`KKU Market: บันทึกสำเร็จ ${code}`,emailMessage(code,data.title,action)]);
  await connection.commit();committed=true;
 }catch(e){if(connection)await connection.rollback();throw e;}finally{connection?.release();if(!committed&&image)await cleanImage(image.publicId);}
 // Saving remains successful even if external email or cleanup fails.
 let emailStatus='pending';try{emailStatus=await sendReceipt(code,req.user.uid);}catch{console.error('Outbox dispatch failed');}
 res.status(id?200:201).json({id:postId,code,emailStatus,message:emailStatus==='accepted'?'บันทึกสำเร็จและผู้ให้บริการรับอีเมลแล้ว':'บันทึกสำเร็จ แต่อีเมลยังส่งไม่สำเร็จ กดส่งซ้ำในประวัติได้'});
 if(oldImage)await cleanImage(oldImage);
}
app.post('/api/posts',auth,writeLimit,upload,wrap(savePost));
app.put('/api/posts/:id',auth,validId,writeLimit,upload,wrap(savePost));
app.delete('/api/posts/:id',auth,validId,writeLimit,wrap(async(req,res)=>{
 const c=await pool.getConnection();let old;
 try{await c.beginTransaction();const [rows]=await c.execute('SELECT image_public_id FROM posts WHERE id=? AND owner_uid=? FOR UPDATE',[req.params.id,req.user.uid]);if(!rows.length)throw fault(404,'ไม่พบประกาศของคุณ');old=rows[0].image_public_id;await c.execute('DELETE FROM posts WHERE id=? AND owner_uid=?',[req.params.id,req.user.uid]);await c.commit();}catch(e){await c.rollback();throw e;}finally{c.release();}
 res.json({ok:true});await cleanImage(old);
}));
app.get('/api/my/receipts',auth,wrap(async(req,res)=>{const [rows]=await pool.execute('SELECT code,post_id,status,created_at FROM email_outbox WHERE owner_uid=? ORDER BY created_at DESC LIMIT 20',[req.user.uid]);res.json(rows);}));
app.post('/api/my/receipts/:code/retry',auth,mailLimit,wrap(async(req,res)=>{
 if(!/^KKU-[A-F0-9-]{36}$/.test(req.params.code))throw fault(400,'รหัสไม่ถูกต้อง');
 const [rows]=await pool.execute('SELECT code FROM email_outbox WHERE code=? AND owner_uid=?',[req.params.code,req.user.uid]);if(!rows.length)throw fault(404,'ไม่พบรายการ');
 const status=await sendReceipt(req.params.code,req.user.uid);res.json({status});
}));
app.use((req,res)=>res.status(404).json({error:'ไม่พบ API'}));
app.use((e,req,res,next)=>{console.error('Request failed:',e.code||e.name);const status=e instanceof multer.MulterError?400:e.status||500;res.status(status).json({error:e instanceof multer.MulterError?'ไฟล์ใหญ่เกิน 5 MB หรือแบบฟอร์มไม่ถูกต้อง':status<500?e.message:status===503||status===502?e.message:'ระบบขัดข้อง กรุณาลองใหม่หรือตรวจ Backend logs'});});
const server=app.listen(process.env.PORT||8080,'0.0.0.0',()=>console.log('API ready'));
process.on('SIGTERM',()=>server.close(()=>pool.end().then(()=>process.exit(0))));
