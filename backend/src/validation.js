export function postInput(body,uid){
 const {title,description,price,imagePath=null}=body;
 if(typeof title!=='string'||!title.trim()||title.length>160)throw new Error('ชื่อสินค้าต้องมี 1–160 ตัวอักษร');
 if(typeof description!=='string'||!description.trim()||description.length>5000)throw new Error('รายละเอียดต้องมี 1–5000 ตัวอักษร');
 if(typeof price!=='number'||!Number.isFinite(price)||price<0||price>99999999.99||Math.abs(price*100-Math.round(price*100))>0.00001)throw new Error('ราคาไม่ถูกต้อง');
 if(imagePath!==null&&(typeof imagePath!=='string'||!new RegExp(`^posts/${uid}/[a-f0-9-]{36}$`).test(imagePath)))throw new Error('ตำแหน่งรูปภาพไม่ถูกต้อง');
 return {title:title.trim(),description:description.trim(),price,imagePath};
}
