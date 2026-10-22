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
      const requestId=Number(req.query?.request_id);
      if(req.query?.action==="conversation"){
        if(!Number.isSafeInteger(requestId)||requestId<1)return res.status(400).json({error:"Invalid request"});
        const found=await get(secret,"requests?id=eq."+requestId+"&select=id,ai_conversation&limit=1");
        if(!found.length)return res.status(404).json({error:"Request not found"});
        return res.status(200).json({request:found[0]});
      }
      const [requests,quotes,files,leads,entitlements]=await Promise.all([
        get(secret,"requests?select=id,auth_user_id,client_name,client_email,category,region,quantity,urgency,request_text,summary,status,client_confirmed,confirmed_at,created_at,updated_at&order=created_at.desc&limit=200"),
        get(secret,"quotes?select=*&order=id.desc"),
        get(secret,"request_files?select=*&order=created_at.desc"),
        get(secret,"leads?select=id,name,email,company,message,status,created_at&order=created_at.desc&limit=50"),
        get(secret,"user_entitlements?select=*&order=created_at.desc")
      ]);
      return res.status(200).json({admin:{email:admin.email},requests,quotes,files,leads,entitlements});
    }

    if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
    const b=req.body||{};

    if(b.action==="set_plan"){
      const userId=String(b.user_id||"").trim();
      const plan=String(b.plan||"").toLowerCase();

      if(!userId||!["free","pro"].includes(plan)){
        return res.status(400).json({error:"Invalid account plan"});
      }

      const payload={
        plan,
        pro_started_at:plan==="pro"?new Date().toISOString():null,
        pro_expires_at:null,
        updated_at:new Date().toISOString()
      };

      const r=await fetch(
        U+"/rest/v1/user_entitlements?user_id=eq."+encodeURIComponent(userId),
        {
          method:"PATCH",
          headers:{
            "Content-Type":"application/json",
            apikey:secret,
            Authorization:"Bearer "+secret,
            Prefer:"return=minimal"
          },
          body:JSON.stringify(payload)
        }
      );

      if(!r.ok) throw new Error(await r.text());

      return res.status(200).json({success:true});
    }

    if(b.action==="reset_voice_trial"){
      const userId=String(b.user_id||"").trim();

      if(!userId){
        return res.status(400).json({error:"Invalid user"});
      }

      const r=await fetch(
        U+"/rest/v1/user_entitlements?user_id=eq."+encodeURIComponent(userId),
        {
          method:"PATCH",
          headers:{
            "Content-Type":"application/json",
            apikey:secret,
            Authorization:"Bearer "+secret,
            Prefer:"return=minimal"
          },
          body:JSON.stringify({
            voice_trial_started_at:null,
            voice_trial_seconds:0,
            updated_at:new Date().toISOString()
          })
        }
      );

      if(!r.ok) throw new Error(await r.text());

      return res.status(200).json({success:true});
    }

    if(b.action==="status"){
      const id=Number(b.request_id),status=String(b.status||"").trim().slice(0,60);
      if(!id||!status) return res.status(400).json({error:"Invalid request"});
      const r=await fetch(U+"/rest/v1/requests?id=eq."+id,{method:"PATCH",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=minimal"},body:JSON.stringify({status,updated_at:new Date().toISOString()})});
      if(!r.ok) throw new Error(await r.text());
      return res.status(200).json({success:true});
    }

    if(b.action==="quote"){
      const id=Number(b.request_id),supplier=String(b.supplier_name||"").trim().slice(0,200);
      const filePending=b.file_pending===true;
      if(!Number.isSafeInteger(id)||id<1||(!supplier&&!filePending)) return res.status(400).json({error:"Enter a supplier name or attach a quotation file."});
      const price=b.total_price===""?null:Number(b.total_price);
      const days=b.delivery_days===""?null:Number(b.delivery_days);
      const r=await fetch(U+"/rest/v1/quotes",{method:"POST",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=representation"},body:JSON.stringify({request_id:id,supplier_name:supplier||null,total_price:Number.isFinite(price)?price:null,currency:String(b.currency||"ZAR").slice(0,10),delivery_days:Number.isFinite(days)?days:null,payment_terms:String(b.payment_terms||"").slice(0,300)||null,admin_notes:String(b.admin_notes||"").slice(0,1000)||null,status:"received",visible_to_client:false,submitted_at:new Date().toISOString()})});
      if(!r.ok) throw new Error(await r.text());
      const created=await r.json();
      return res.status(200).json({success:true,quote:created[0]||null});
    }

    if(b.action==="edit_quote"){
      const id=Number(b.quote_id);
      if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"Invalid supplier quotation"});
      const supplier=String(b.supplier_name||"").trim().slice(0,200);
      const amount=b.total_price===""||b.total_price==null?null:Number(b.total_price);
      if(amount!==null&&(!Number.isFinite(amount)||amount<0))return res.status(400).json({error:"Invalid quotation price"});
      const days=b.delivery_days===""||b.delivery_days==null?null:Number(b.delivery_days);
      if(days!==null&&(!Number.isInteger(days)||days<0))return res.status(400).json({error:"Invalid delivery time"});
      const values={supplier_name:supplier||null,total_price:amount,currency:String(b.currency||"ZAR").trim().slice(0,10),delivery_days:days,payment_terms:String(b.payment_terms||"").trim().slice(0,300)||null,admin_notes:String(b.admin_notes||"").trim().slice(0,1000)||null};
      const r=await fetch(U+"/rest/v1/quotes?id=eq."+id+"&visible_to_client=is.false",{method:"PATCH",headers:{"Content-Type":"application/json",apikey:secret,Authorization:"Bearer "+secret,Prefer:"return=representation"},body:JSON.stringify(values)});
      if(!r.ok)throw new Error(await r.text());
      const rows=await r.json();
      if(!rows.length)return res.status(409).json({error:"Quote is already published or unavailable. Hide it before editing."});
      return res.status(200).json({success:true,quote:rows[0]});
    }

    if(b.action==="publish_quote"){
      const id=Number(b.quote_id);
      const requestId=Number(b.request_id);
      const visible=b.visible===true;
      if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"Invalid quote"});
      const matched=await get(secret,"quotes?id=eq."+id+"&select=id,request_id,supplier_name,total_price,file_storage_path&limit=1");
      const quote=matched[0];
      if(!quote||quote.request_id!==requestId)return res.status(404).json({error:"Supplier quote not found for this request"});
      if(visible&&(!quote.supplier_name||quote.total_price==null||Number(quote.total_price)<=0)){
        return res.status(409).json({error:"Complete the supplier name and valid total price before publishing. Unpriced PDF drafts must remain private."});
      }
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
      if(!Number.isSafeInteger(id)||id<1||!path||path.includes(".."))return res.status(400).json({error:"Invalid quote file"});
      const found=await get(secret,"quotes?id=eq."+id+"&select=id,request_id&limit=1");
      if(!found.length||!path.startsWith("admin-quotes/"+found[0].request_id+"/"+id+"/"))return res.status(400).json({error:"Quote file location does not match this quotation"});
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