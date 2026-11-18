import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth, firebaseConfigured } from './firebase';
import './style.css';
function App(){
 if(!firebaseConfigured)return <main><h1>ยังไม่ได้ตั้งค่า Firebase</h1><p>ใส่ค่าจาก frontend/.env.example ใน .env.local หรือ Vercel Environment Variables แล้วเริ่มเว็บใหม่</p></main>;
 return <Market/>;
}
function Market(){
 const [notice,setNotice]=useState(''),[receipts,setReceipts]=useState([]),[authBusy,setAuthBusy]=useState(false),[loading,setLoading]=useState(true);
 const [user,setUser]=useState(null),[posts,setPosts]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(null),[query,setQuery]=useState('');
 async function api(path,options={}){
  const token=auth.currentUser ? await auth.currentUser.getIdToken() : null;
  try{
   const r=await fetch(`${(import.meta.env.VITE_API_URL||'').replace(/\/$/,'')}${path}`,{...options,signal:AbortSignal.timeout(90000),headers:{...(options.body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers}});
   const data=await r.json().catch(()=>({error:'Backend ตอบกลับไม่ถูกต้อง ตรวจ VITE_API_URL'})); if(!r.ok) throw new Error(data.error||'เกิดข้อผิดพลาด');return data;
  }catch(e){if(e.name==='TimeoutError')throw new Error('หมดเวลารอ Backend อาจกำลังตื่นจาก Render Free ก่อนลองบันทึกซ้ำให้รีเฟรชตรวจรายการก่อน');if(e instanceof TypeError)throw new Error('เชื่อม Backend ไม่ได้ ตรวจ URL, CORS และสถานะ Render');throw e;}
 }
 async function load(){try{setPosts(await api('/api/posts'));}finally{setLoading(false);}}
 async function loadReceipts(){setReceipts(await api('/api/my/receipts'));}
 useEffect(()=>{load().catch(e=>setError(e.message));return onAuthStateChanged(auth,async u=>{setAuthBusy(true);setError('');setNotice('');setUser(null);try{if(u){await api('/api/me');setUser(u);await loadReceipts();}else setReceipts([]);}catch(e){setError(e.message);await signOut(auth);}finally{setAuthBusy(false);}});},[]);
 async function login(){setError('');setAuthBusy(true);try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch(e){setError(e.code==='auth/popup-blocked'?'กรุณาอนุญาตป๊อปอัปของเว็บนี้ แล้วกดเข้าสู่ระบบอีกครั้ง':e.message);}finally{setAuthBusy(false);}}
 async function save(e){e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  const form=e.currentTarget;
  try{
   const fd=new FormData(form),file=fd.get('image');
   if(file?.size&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024))throw new Error('ใช้ JPG, PNG หรือ WEBP ไม่เกิน 5 MB');
   if(!file?.size)fd.delete('image');
   const result=await api(editing?`/api/posts/${editing.id}`:'/api/posts',{method:editing?'PUT':'POST',body:fd});
   setNotice(`${result.message} · รหัส ${result.code}`);setEditing(null);form.reset();await load();await loadReceipts();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function retryReceipt(code){setBusy(true);setError('');try{const r=await api(`/api/my/receipts/${code}/retry`,{method:'POST'});setNotice(r.status==='accepted'?'ผู้ให้บริการรับอีเมลแล้ว โปรดตรวจ Inbox/Spam':'อีเมลยังไม่สำเร็จ ตรวจการตั้งค่า Resend');await loadReceipts();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function remove(post){if(!confirm('ลบประกาศนี้?'))return;setBusy(true);try{await api(`/api/posts/${post.id}`,{method:'DELETE'});await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <><header><a className="brand" href="/">KKU<span>Market</span></a><div>{user?<><span>{user.displayName}</span> <button onClick={()=>signOut(auth)}>ออกจากระบบ</button></>:<button disabled={authBusy} onClick={login}>{authBusy?'กำลังตรวจสอบบัญชี...':'เข้าสู่ระบบด้วย Google / KKU Mail'}</button>}</div></header>
 <main><section className="hero"><small>พื้นที่แบ่งปันของชาวมหาวิทยาลัย</small><h1>ของที่คุณส่งต่อ<br/>อาจเป็นสิ่งที่ใครกำลังหา</h1><p>ซื้อขายหนังสือ อุปกรณ์การเรียน และของใช้ กับชุมชนของคุณ</p><input aria-label="ค้นหาประกาศ" placeholder="ค้นหาสินค้า..." value={query} onChange={e=>setQuery(e.target.value)}/></section>
 {notice&&<p role="status" className="notice">{notice}</p>}{error&&<p role="alert" className="error">{error}</p>}
 {user&&<section className="panel"><h2>{editing?'แก้ไขประกาศ':'ลงประกาศใหม่'}</h2><form key={editing?.id||'new'} onSubmit={save}><input name="title" placeholder="ชื่อสินค้า" aria-label="ชื่อสินค้า" required maxLength="160" defaultValue={editing?.title||''}/><input name="price" type="number" min="0" max="99999999.99" step="0.01" placeholder="ราคา (บาท)" aria-label="ราคา" required defaultValue={editing?.price??''}/><textarea name="description" placeholder="รายละเอียดและช่องทางติดต่อที่ต้องการเผยแพร่" aria-label="รายละเอียด" required maxLength="5000" defaultValue={editing?.description||''}/><label>รูปสินค้า JPG / PNG / WEBP ไม่เกิน 5 MB<input type="file" name="image" accept="image/jpeg,image/png,image/webp"/></label><div><button disabled={busy}>{busy?'กำลังบันทึก...':'บันทึกประกาศ'}</button>{editing&&<button disabled={busy} type="button" onClick={()=>setEditing(null)}>ยกเลิก</button>}</div></form></section>}
 {user&&<section className="panel"><h2>รหัสบันทึกของฉัน</h2><p>ดูรหัสอ้างอิงและสถานะอีเมลของรายการที่คุณบันทึก</p>{!receipts.length&&<p>ยังไม่มีประวัติ</p>}{receipts.map(r=><div className="receipt" key={r.code}><code>{r.code}</code><span>{r.status==='accepted'?'ผู้ให้บริการรับอีเมลแล้ว':r.status==='sending'?'กำลังส่ง':'อีเมลรอส่ง'}</span>{r.status!=='accepted'&&<button disabled={busy} onClick={()=>retryReceipt(r.code)}>ส่งอีเมลซ้ำ</button>}</div>)}</section>}
 <h2>ประกาศล่าสุด</h2>{loading&&<p>กำลังโหลดข้อมูล... Render Free อาจใช้เวลาตื่นประมาณหนึ่งนาที</p>}<div className="grid">{posts.filter(p=>(p.title+' '+p.description).toLowerCase().includes(query.toLowerCase())).map(p=><article key={p.id}><PostImage url={p.image_url}/><div className="content"><small>{p.seller_name}</small><h3>{p.title}</h3><strong>฿{Number(p.price).toLocaleString('th-TH')}</strong><p className="description">{p.description}</p>{user?.uid===p.owner_uid&&<div><button disabled={busy} onClick={()=>{setEditing(p);window.scrollTo({top:0,behavior:'smooth'});}}>แก้ไข</button> <button disabled={busy} onClick={()=>remove(p)}>ลบ</button></div>}</div></article>)}</div>{!loading&&!posts.length&&<p>ยังไม่มีประกาศ ลองลงประกาศแรกของคุณ</p>}</main><footer>KKU Market · React · Firebase · Render · TiDB · Cloudinary</footer></>;
}
function PostImage({url}){return url?<img src={url} alt="รูปสินค้า" loading="lazy"/>:<div className="placeholder">KKU MARKET</div>;}
createRoot(document.getElementById('root')).render(<App/>);
