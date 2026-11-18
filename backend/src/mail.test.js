import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMailSender} from './mail.js';
function fakeDb({claim=1,status='accepted'}={}){
 const calls=[];
 return {calls,async execute(sql,params){calls.push({sql,params});if(sql.startsWith("UPDATE email_outbox SET status='sending'"))return [{affectedRows:claim}];if(sql.startsWith('SELECT status'))return [[{status}]];if(sql.startsWith('SELECT *'))return [[{recipient:'owner@gmail.com',subject:'saved',body:'receipt'}]];return [{affectedRows:1}];}};
}
test('email accepted: trusted recipient, stable key and durable status',async()=>{
 const db=fakeDb();let request;
 const send=createMailSender({db,env:{RESEND_API_KEY:'test-only',EMAIL_FROM:'test@example.com'},fetcher:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({id:'email-1'})};}});
 assert.equal(await send('KKU-code','owner-uid'),'accepted');
 assert.deepEqual(JSON.parse(request.options.body).to,['owner@gmail.com']);
 assert.equal(request.options.headers['Idempotency-Key'],'receipt-KKU-code');
 assert.ok(db.calls.some(c=>c.sql.includes("status='accepted'")&&c.params[0]==='email-1'));
});
test('provider failure preserves pending receipt for retry',async()=>{
 const db=fakeDb();const send=createMailSender({db,env:{RESEND_API_KEY:'test',EMAIL_FROM:'test@example.com'},fetcher:async()=>({ok:false,status:403,json:async()=>({})})});
 assert.equal(await send('code','uid'),'pending');assert.ok(db.calls.some(c=>c.sql.includes("status='pending'")));
});
test('already accepted receipt never sends again',async()=>{
 const db=fakeDb({claim:0});let sent=false;
 const send=createMailSender({db,fetcher:async()=>{sent=true;throw new Error('must not call');}});
 assert.equal(await send('code','uid'),'accepted');assert.equal(sent,false);
});
test('missing email configuration remains pending',async()=>{
 const db=fakeDb();const send=createMailSender({db,env:{}});assert.equal(await send('code','uid'),'pending');
});
