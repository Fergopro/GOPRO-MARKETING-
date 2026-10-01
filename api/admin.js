const U="https://oulckllygepbqbctzeka.supabase.co";
const K="sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";

async function adminUser(req,secret){
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer ")) return null;
  const token=h.slice(7);
  const u=await fetch(U+"/auth/v1/user",{headers:{apikey:K,Authorization:"Bearer "+token}});
  if(!u.ok) return null;
  const user=await u.json();
  const a=await fetch(U+"/rest/v1/admin_users?user_id=eq."+encodeURIComponent(user.id)+"&select=user_id&limit=1",{headers:{apikey:secret,Authorization:"Bearer "+secret}});
  if(!a.ok) return null;
  const rows=await a.json();
  return rows.length?user:null;
}

async function get(secret,path){
  const r=await fetch(U+"/rest/v1/"+path,{headers:{apikey:secret,Authorization:"Bearer "+secret}});
  if(!r.ok) throw new Error(await r.text());
  return r.json();
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret) return res.status(500).json({error:"Admin service not configured"});
  const admin=await adminUser(req,secret);
  if(!admin) return res.status(403).json({error:"Admin access required"});

  try{
    if(req.method==="GET"){
      const [requests,quotes,files,leads]=await Promise.all([
        get(secret,"requests?select=*&order=created_at.desc"),
        get(secret,"quotes?select=*&order=id.desc"),
        get(secret,"request_files?select=*&order=created_at.desc"),
        get(secret,"leads?select=id,name,email,company,message,status,created_at&order=created_at.desc&limit=50")
      ]);
      return res.status(200).json({admin:{email:admin.email},requests,quotes,files,leads});
    }

    if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
    const b=req.body||{};

    if(b.action==="status"){
      const id=Number(b.request_id),status=String(b.status||"").trim().slice(0,60);
      if(!id||!status) return res.status(400).json({error:"Invalid request"});
      const r=await fetch(U+"/rest/v1/requests?id=eq."+id,{method:"PATCH",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=minimal"},body:JSON.stringify({status,updated_at:new Date().toISOString()})});
      if(!r.ok) throw new Error(await r.text());
      return res.status(200).json({success:true});
    }

    if(b.action==="quote"){
      const id=Number(b.request_id),supplier=String(b.supplier_name||"").trim().slice(0,200);
      if(!id||!supplier) return res.status(400).json({error:"Request and supplier required"});
      const price=b.total_price===""?null:Number(b.total_price);
      const days=b.delivery_days===""?null:Number(b.delivery_days);
      const r=await fetch(U+"/rest/v1/quotes",{method:"POST",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=representation"},body:JSON.stringify({request_id:id,supplier_name:supplier,total_price:Number.isFinite(price)?price:null,currency:String(b.currency||"ZAR").slice(0,10),delivery_days:Number.isFinite(days)?days:null,payment_terms:String(b.payment_terms||"").slice(0,300)||null,admin_notes:String(b.admin_notes||"").slice(0,1000)||null,status:"received",visible_to_client:false,submitted_at:new Date().toISOString()})});
      if(!r.ok) throw new Error(await r.text());
      const created=await r.json();
      return res.status(200).json({success:true,quote:created[0]||null});
    }

    if(b.action==="publish_quote"){
      const id=Number(b.quote_id);
      const requestId=Number(b.request_id);
      const visible=Boolean(b.visible);
      if(!id) return res.status(400).json({error:"Invalid quote"});
      const r=await fetch(U+"/rest/v1/quotes?id=eq."+id,{method:"PATCH",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=minimal"},body:JSON.stringify({visible_to_client:visible,published_at:visible?new Date().toISOString():null,status:visible?"published":"received"})});
      if(!r.ok) throw new Error(await r.text());

      if(visible&&requestId){
        const rr=await fetch(U+"/rest/v1/requests?id=eq."+requestId,{method:"PATCH",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=minimal"},body:JSON.stringify({status:"Client Review",updated_at:new Date().toISOString()})});
        if(!rr.ok) throw new Error(await rr.text());
      }

      return res.status(200).json({success:true});
    }

    if(b.action==="quote_file"){
      const id=Number(b.quote_id);
      const path=String(b.storage_path||"");
      const name=String(b.file_name||"").slice(0,255);
      if(!id||!path||path.includes("..")) return res.status(400).json({error:"Invalid quote file"});
      const r=await fetch(U+"/rest/v1/quotes?id=eq."+id,{method:"PATCH",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=minimal"},body:JSON.stringify({file_storage_path:path,quote_file_name:name||null})});
      if(!r.ok) throw new Error(await r.text());
      return res.status(200).json({success:true});
    }

    if(b.action==="file"){
      const path=String(b.storage_path||"");
      if(!path||path.includes("..")) return res.status(400).json({error:"Invalid file path"});
      const r=await fetch(U+"/storage/v1/object/sign/client-documents/"+path.split("/").map(encodeURIComponent).join("/"),{method:"POST",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret},body:JSON.stringify({expiresIn:300})});
      if(!r.ok) throw new Error(await r.text());
      const j=await r.json();
      let url=j.signedURL||j.signedUrl||j.url;
      if(url&&!url.startsWith("http")) url=U+"/storage/v1"+url;
      return res.status(200).json({url});
    }

    return res.status(400).json({error:"Unknown action"});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:"Admin request failed"});
  }
}