import fs from 'node:fs';
import mysql from 'mysql2/promise';
export function dbOptions(e=process.env){
 if(e.NODE_ENV==='production'&&e.DB_SSL!=='true')throw new Error('Production database requires DB_SSL=true');
 return {host:e.DB_HOST,port:Number(e.DB_PORT||4000),user:e.DB_USER,password:e.DB_PASSWORD,database:e.DB_NAME,connectionLimit:5,connectTimeout:15000,decimalNumbers:true,charset:'utf8mb4',...(e.DB_SSL==='true'?{ssl:{rejectUnauthorized:true,minVersion:'TLSv1.2',...(e.DB_SSL_CA_PATH?{ca:fs.readFileSync(e.DB_SSL_CA_PATH)}:{})}}:{})};
}
export const pool=mysql.createPool(dbOptions());
