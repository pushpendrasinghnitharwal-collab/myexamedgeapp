// Validate new account input before bcrypt or a database write. Existing
// accounts can still sign in with their original credentials.
export function validateRegistration(input){
  const {name,email,password,targetExam}=input||{}
  if(typeof name!=='string'||!name.trim()||name.trim().length>100)return {error:'Name must be 1–100 characters'}
  if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email.trim()))return {error:'Enter a valid email address'}
  if(typeof password!=='string'||password.length<8||Buffer.byteLength(password,'utf8')>72)return {error:'Password must be at least 8 characters and no more than 72 UTF-8 bytes'}
  if(targetExam!=null&&(typeof targetExam!=='string'||targetExam.length>120))return {error:'Invalid target exam'}
  return {name:name.trim(),email:email.trim().toLowerCase(),password,targetExam:targetExam||null}
}
