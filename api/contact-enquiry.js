// Authenticated contact requests only. Legacy anonymous lead records remain available as history.
const U="https://oulckllygepbqbctzeka.supabase.co";
const KEY="sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";
const clip=(x,n)=>typeof x==="string"?x.trim().slice(0,n):"";
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store,private");
 if(req.method!=="POST")return res.status(405).json({error:"Method not allowed"});
 const secret=process.env.SUPABASE_SECRET_KEY;
 if(!secret)return res.status(503).json({error:"Contact form temporarily unavailable"});
 const origin=req.headers.origin,host=String(req.headers["x-forwarded-host"]||req.headers.host||"").split(",")[0].trim();
 if(origin){try{const o=new URL(origin);if(o.protocol!=="https:"||o.host!==host)return res.status(403).json({error:"Invalid submission origin"});}catch{return res.status(403).json({error:"Invalid submission origin"});}}
 const authorization=String(req.headers.authorization||"");
 if(!authorization.startsWith("Bearer "))return res.status(401).json({error:"Sign in to contact GoProcures"});
 const userResponse=await fetch(U+"/auth/v1/user",{headers:{apikey:KEY,Authorization:authorization}});
 if(!userResponse.ok)return res.status(401).json({error:"Your login has expired. Sign in again."});
 const user=await userResponse.json();
 if(!user?.id)return res.status(401).json({error:"Sign in required"});
 const body=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?req.body:{};
 const name=clip(body.name,150)||clip(user.user_metadata?.full_name,150)||clip(user.email?.split("@")[0],150);
 const email=clip(user.email,254);
 const phone=clip(body.phone,50),company=clip(body.company,150);
 const message=clip(body.message,5000),enquiry_type=clip(body.enquiry_type,100)||"General Procurement";
 if(message.length<12)return res.status(400).json({error:"Describe your procurement requirement in at least 12 characters"});
 if(!email)return res.status(400).json({error:"Your account needs a verified contact email"});
 if(body.website)return res.status(200).json({success:true});
 const payload={name,email,phone:phone||null,company:company||null,enquiry_type,message,status:"new",source:"authenticated-website-contact",auth_user_id:user.id};
 try{
  const r=await fetch(U+"/rest/v1/leads",{method:"POST",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=representation"},body:JSON.stringify(payload)});
  if(!r.ok){console.error("Contact create failed",r.status);return res.status(503).json({error:"Could not save your enquiry. Please retry."});}
  const rows=await r.json();
  return res.status(201).json({success:true,lead_id:rows[0]?.id});
 }catch(error){console.error("Contact service error",error?.message);return res.status(503).json({error:"Unable to submit right now"});}
}
