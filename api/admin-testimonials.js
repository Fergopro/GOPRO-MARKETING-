/*
 * GoProcures Admin Testimonials API.
 * Admin-only operations. Public review SELECT/INSERT RLS policies remain unchanged.
 * Only service credentials on the server can approve, edit or hide reviews.
 */
const BASE="https://oulckllygepbqbctzeka.supabase.co";
const PUBLIC_KEY="sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";

function reply(res,code,payload){return res.status(code).json(payload);}
function safeId(value){const n=Number(value);return Number.isSafeInteger(n)&&n>0?n:null;}
function reviewFields(body){
  const name=String(body.name??"").trim();
  const company=String(body.company??"").trim();
  const message=String(body.message??"").trim();
  const rating=body.rating===""||body.rating==null?null:Number(body.rating);
  if(name.length<2||name.length>120)throw new Error("Customer name must be between 2 and 120 characters.");
  if(company.length>160)throw new Error("Company name is too long (maximum 160 characters).");
  if(message.length<10||message.length>2000)throw new Error("Customer review must be between 10 and 2,000 characters.");
  if(rating!==null&&(!Number.isInteger(rating)||rating<1||rating>5))throw new Error("Rating must be 1 to 5 stars.");
  return {name,company:company||null,message,rating};
}
async function supa(secret,path,{method="GET",body}={}){
  const r=await fetch(BASE+"/rest/v1/"+path,{
    method,
    headers:{
      apikey:secret,Authorization:"Bearer "+secret,
      ...(body?{"Content-Type":"application/json",Prefer:"return=representation"}:{})
    },
    ...(body?{body:JSON.stringify(body)}:{})
  });
  if(!r.ok){
    console.error("Testimonials DB request failed",{method,status:r.status});
    throw new Error("Testimonial database request failed.");
  }
  return r.json();
}
async function isAdmin(req,secret){
  const authorization=req.headers?.authorization||"";
  if(!authorization.startsWith("Bearer "))return false;
  const token=authorization.slice(7);
  if(!token||token.length>8192)return false;
  const userResponse=await fetch(BASE+"/auth/v1/user",{
    headers:{apikey:PUBLIC_KEY,Authorization:"Bearer "+token}
  });
  if(!userResponse.ok)return false;
  const user=await userResponse.json();
  if(!user?.id)return false;
  const admin=await supa(secret,"admin_users?select=user_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=1");
  return Array.isArray(admin)&&admin.length===1;
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, private");
  res.setHeader("X-Content-Type-Options","nosniff");
  if(!["GET","POST","PATCH"].includes(req.method))return reply(res,405,{error:"Method not allowed"});
  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret)return reply(res,503,{error:"Testimonials administration is not configured."});
  try{
    if(!await isAdmin(req,secret))return reply(res,403,{error:"Administrator access required."});
    if(req.method==="GET"){
      const rows=await supa(secret,"testimonials?select=id,name,company,message,rating,approved,created_at&order=created_at.desc&limit=100");
      return reply(res,200,{testimonials:rows});
    }
    const body=req.body||{};
    if(req.method==="POST"){
      let data;
      try{data=reviewFields(body);}catch(e){return reply(res,400,{error:e.message});}
      const created=await supa(secret,"testimonials?select=id,name,company,message,rating,approved,created_at",{
        method:"POST",
        body:{...data,approved:false}
      });
      if(!created.length)throw new Error("Creation returned no testimonial.");
      return reply(res,201,{testimonial:created[0]});
    }
    const id=safeId(body.id);
    if(!id)return reply(res,400,{error:"Invalid testimonial ID."});
    const action=String(body.action||"");
    if(!["save","approve","hide"].includes(action))return reply(res,400,{error:"Invalid testimonial action."});
    const existing=await supa(secret,"testimonials?select=id,name,company,message,rating,approved&id=eq."+id+"&limit=1");
    if(!existing.length)return reply(res,404,{error:"Testimonial not found."});
    let changes;
    if(action==="save"){
      try{changes={...reviewFields(body),approved:false};}
      catch(e){return reply(res,400,{error:e.message});}
    }else if(action==="approve"){
      // An administrator must explicitly approve even after editing a published review.
      try{reviewFields(existing[0]);}
      catch(e){return reply(res,409,{error:"Complete the review before approving it."});}
      changes={approved:true};
    }else{
      changes={approved:false};
    }
    const saved=await supa(secret,"testimonials?select=id,name,company,message,rating,approved,created_at&id=eq."+id,{
      method:"PATCH",body:changes
    });
    if(!saved.length)return reply(res,404,{error:"Testimonial not found."});
    return reply(res,200,{testimonial:saved[0]});
  }catch(e){
    console.error("Admin testimonials error:",e);
    return reply(res,502,{error:"Unable to complete the testimonial operation. Please try again."});
  }
}
