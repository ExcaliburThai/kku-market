import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, storage } from './firebase';
import './style.css';
function App(){
 const [user,setUser]=useState(null),[posts,setPosts]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[editing,setEditing]=useState(null),[query,setQuery]=useState('');
 async function api(path,options={}){
  const token=auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const r=await fetch(`${import.meta.env.VITE_API_URL}${path}`,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...options.headers}});
  const data=await r.json(); if(!r.ok) throw new Error(data.error||'เกิดข้อผิดพลาด'); return data;
 }
 async function load(){setPosts(await api('/api/posts'));}
 useEffect(()=>{load().catch(e=>setError(e.message));return onAuthStateChanged(auth,u=>{setUser(u);if(u)api('/api/me').catch(e=>{setError(e.message);signOut(auth);});});},[]);
 async function login(){setError('');try{const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,provider);}catch(e){setError(e.message);}}
 async function save(e){e.preventDefault();setBusy(true);setError('');let uploaded=null;
  try{
   const form=e.currentTarget, fd=new FormData(form),file=fd.get('image');let imagePath=editing?.image_path||null;
   if(file?.size){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('ใช้ JPG, PNG หรือ WEBP ไม่เกิน 5 MB');
    uploaded=ref(storage,`posts/${user.uid}/${crypto.randomUUID()}`);await uploadBytes(uploaded,file,{contentType:file.type});imagePath=uploaded.fullPath;}
   await api(editing?`/api/posts/${editing.id}`:'/api/posts',{method:editing?'PUT':'POST',body:JSON.stringify({title:fd.get('title'),description:fd.get('description'),price:Number(fd.get('price')),imagePath})});
   uploaded=null;setEditing(null);form.reset();await load();
  }catch(e){if(uploaded)await deleteObject(uploaded).catch(()=>{});setError(e.message);}finally{setBusy(false);}
 }
 async function remove(post){if(!confirm('ลบประกาศนี้?'))return;setBusy(true);try{await api(`/api/posts/${post.id}`,{method:'DELETE'});await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <><header><a className="brand" href="/">KKU<span>Market</span></a><div>{user?<><span>{user.displayName}</span> <button onClick={()=>signOut(auth)}>ออกจากระบบ</button></>:<button onClick={login}>เข้าสู่ระบบด้วย Google / KKU Mail</button>}</div></header>
 <main><section className="hero"><small>พื้นที่แบ่งปันของชาวมหาวิทยาลัย</small><h1>ของที่คุณส่งต่อ<br/>อาจเป็นสิ่งที่ใครกำลังหา</h1><p>ซื้อขายหนังสือ อุปกรณ์การเรียน และของใช้ กับชุมชนของคุณ</p><input aria-label="ค้นหาประกาศ" placeholder="ค้นหาสินค้า..." value={query} onChange={e=>setQuery(e.target.value)}/></section>
 {error&&<p role="alert" className="error">{error}</p>}
 {user&&<section className="panel"><h2>{editing?'แก้ไขประกาศ':'ลงประกาศใหม่'}</h2><form key={editing?.id||'new'} onSubmit={save}><input name="title" placeholder="ชื่อสินค้า" aria-label="ชื่อสินค้า" required maxLength="160" defaultValue={editing?.title||''}/><input name="price" type="number" min="0" max="99999999.99" step="0.01" placeholder="ราคา (บาท)" aria-label="ราคา" required defaultValue={editing?.price||''}/><textarea name="description" placeholder="รายละเอียดและช่องทางติดต่อที่ต้องการเผยแพร่" aria-label="รายละเอียด" required maxLength="5000" defaultValue={editing?.description||''}/><label>รูปสินค้า JPG / PNG / WEBP ไม่เกิน 5 MB<input type="file" name="image" accept="image/jpeg,image/png,image/webp"/></label><div><button disabled={busy}>{busy?'กำลังบันทึก...':'บันทึกประกาศ'}</button>{editing&&<button type="button" onClick={()=>setEditing(null)}>ยกเลิก</button>}</div></form></section>}
 <h2>ประกาศล่าสุด</h2><div className="grid">{posts.filter(p=>(p.title+' '+p.description).toLowerCase().includes(query.toLowerCase())).map(p=><article key={p.id}><PostImage path={p.image_path}/><div className="content"><small>{p.seller_name}</small><h3>{p.title}</h3><strong>฿{Number(p.price).toLocaleString('th-TH')}</strong><p className="description">{p.description}</p>{user?.uid===p.owner_uid&&<div><button disabled={busy} onClick={()=>{setEditing(p);window.scrollTo({top:0,behavior:'smooth'});}}>แก้ไข</button> <button disabled={busy} onClick={()=>remove(p)}>ลบ</button></div>}</div></article>)}</div>{!posts.length&&<p>ยังไม่มีประกาศ ลองลงประกาศแรกของคุณ</p>}</main><footer>KKU Market · ตัวอย่างเว็บ React + Google Cloud</footer></>;
}
function PostImage({path}){const [url,setUrl]=useState('');useEffect(()=>{let active=true;setUrl('');if(path)getDownloadURL(ref(storage,path)).then(u=>{if(active)setUrl(u);}).catch(()=>{});return()=>{active=false;};},[path]);return url?<img src={url} alt="รูปสินค้า" loading="lazy"/>:<div className="placeholder">KKU MARKET</div>;}
createRoot(document.getElementById('root')).render(<App/>);
