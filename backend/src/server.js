import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mysql from 'mysql2/promise';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { postInput } from './validation.js';
initializeApp({credential:applicationDefault(),projectId:process.env.GOOGLE_CLOUD_PROJECT,storageBucket:process.env.FIREBASE_STORAGE_BUCKET});
const pool=mysql.createPool({...(process.env.INSTANCE_CONNECTION_NAME?{socketPath:`/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`}:{host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306)}),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,connectionLimit:5,decimalNumbers:true,charset:'utf8mb4'});
const app=express(), origins=(process.env.FRONTEND_ORIGINS||'').split(',').map(x=>x.trim());
app.use(helmet(),cors({origin:origins}),express.json({limit:'32kb'}),rateLimit({windowMs:60000,limit:120}));
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const auth=wrap(async(req,res,next)=>{
 const header=req.headers.authorization||'';if(!header.startsWith('Bearer '))return res.status(401).json({error:'กรุณาเข้าสู่ระบบ'});
 let u;try{u=await getAuth().verifyIdToken(header.slice(7),true);}catch{return res.status(401).json({error:'การเข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง'});}
 const allowed=(process.env.ALLOWED_EMAIL_DOMAINS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(u.firebase?.sign_in_provider!=='google.com'||!u.email_verified||!u.email|| (allowed.length&&!allowed.includes(u.email.split('@')[1].toLowerCase())))return res.status(403).json({error:'บัญชีนี้ไม่ได้รับอนุญาต'});
 req.user=u;
 await pool.execute('INSERT INTO users (firebase_uid,name,email) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),email=VALUES(email)',[u.uid,u.name||'สมาชิก',u.email]);next();
});
async function checkImage(path){if(!path)return;let meta;try{[meta]=await getStorage().bucket().file(path).getMetadata();}catch{const e=new Error('ไม่พบรูปภาพ');e.status=400;throw e;}if(!['image/jpeg','image/png','image/webp'].includes(meta.contentType)||Number(meta.size)>5*1024*1024){const e=new Error('รูปภาพไม่ถูกต้อง');e.status=400;throw e;}}
async function cleanImage(path){if(path)try{await getStorage().bucket().file(path).delete({ignoreNotFound:true});}catch{console.error('Image cleanup failed; run orphan cleanup later');}}
app.get('/health',(_,res)=>res.json({ok:true}));
app.get('/api/me',auth,(req,res)=>res.json({uid:req.user.uid,name:req.user.name,email:req.user.email}));
app.get('/api/posts',wrap(async(_,res)=>{const [rows]=await pool.query('SELECT p.*,u.name AS seller_name FROM posts p JOIN users u ON p.owner_uid=u.firebase_uid ORDER BY p.id DESC LIMIT 100');res.json(rows);}));
function input(req){try{return postInput(req.body,req.user.uid);}catch(e){e.status=400;throw e;}}
app.post('/api/posts',auth,wrap(async(req,res)=>{const p=input(req);await checkImage(p.imagePath);const [r]=await pool.execute('INSERT INTO posts (owner_uid,title,description,price,image_path) VALUES (?,?,?,?,?)',[req.user.uid,p.title,p.description,p.price,p.imagePath]);res.status(201).json({id:r.insertId});}));
app.put('/api/posts/:id',auth,wrap(async(req,res)=>{
 const p=input(req);const [rows]=await pool.execute('SELECT image_path FROM posts WHERE id=? AND owner_uid=?',[req.params.id,req.user.uid]);if(!rows.length)return res.status(404).json({error:'ไม่พบประกาศของคุณ'});
 await checkImage(p.imagePath);const [r]=await pool.execute('UPDATE posts SET title=?,description=?,price=?,image_path=? WHERE id=? AND owner_uid=?',[p.title,p.description,p.price,p.imagePath,req.params.id,req.user.uid]);if(!r.affectedRows)return res.status(404).json({error:'ไม่พบประกาศ'});if(rows[0].image_path!==p.imagePath)await cleanImage(rows[0].image_path);res.json({ok:true});
}));
app.delete('/api/posts/:id',auth,wrap(async(req,res)=>{const [rows]=await pool.execute('SELECT image_path FROM posts WHERE id=? AND owner_uid=?',[req.params.id,req.user.uid]);if(!rows.length)return res.status(404).json({error:'ไม่พบประกาศของคุณ'});await pool.execute('DELETE FROM posts WHERE id=? AND owner_uid=?',[req.params.id,req.user.uid]);await cleanImage(rows[0].image_path);res.json({ok:true});}));
app.use((req,res)=>res.status(404).json({error:'ไม่พบ API'}));
app.use((err,req,res,next)=>{console.error(err.code||err.message);res.status(err.status||500).json({error:err.status===400?err.message:'ระบบขัดข้อง กรุณาลองใหม่'});});
const server=app.listen(process.env.PORT||8080,()=>console.log('API ready'));
process.on('SIGTERM',()=>server.close(()=>pool.end().then(()=>process.exit(0))));
