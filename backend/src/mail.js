import { pool } from './db.js';
// Persistent outbox; payload never changes, so retries can share an idempotency key.
export function createMailSender({db=pool,fetcher=fetch,env=process.env}={}){
return async function sendReceipt(code,uid){
 const [claimed]=await db.execute("UPDATE email_outbox SET status='sending',attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE code=? AND owner_uid=? AND (status='pending' OR (status='sending' AND updated_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE)))",[code,uid]);
 if(!claimed.affectedRows){const [rows]=await db.execute('SELECT status FROM email_outbox WHERE code=? AND owner_uid=?',[code,uid]);return rows[0]?.status||'pending';}
 try{
  const [rows]=await db.execute('SELECT * FROM email_outbox WHERE code=? AND owner_uid=?',[code,uid]);const job=rows[0];
  if(!env.RESEND_API_KEY||!env.EMAIL_FROM)throw new Error('EMAIL_NOT_CONFIGURED');
  const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`receipt-${code}`},body:JSON.stringify({from:env.EMAIL_FROM,to:[job.recipient],subject:job.subject,text:job.body}),signal:AbortSignal.timeout(12000)});
  const data=await r.json();if(!r.ok||!data.id)throw new Error(`EMAIL_PROVIDER_${r.status}`);
  await db.execute("UPDATE email_outbox SET status='accepted',provider_id=?,updated_at=CURRENT_TIMESTAMP WHERE code=?",[data.id,code]);return 'accepted';
 }catch(e){console.error('Email failed:',e.message.startsWith('EMAIL_')?e.message:e.name);await db.execute("UPDATE email_outbox SET status='pending',updated_at=CURRENT_TIMESTAMP WHERE code=?",[code]);return 'pending';}
}

}
export const sendReceipt=createMailSender();
