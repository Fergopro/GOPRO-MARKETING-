const U="https://oulckllygepbqbctzeka.supabase.co";
const K="sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";

async function getUser(req){
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer ")) return null;
  const token=h.slice(7);
  const r=await fetch(U+"/auth/v1/user",{headers:{apikey:K,Authorization:"Bearer "+token}});
  if(!r.ok) return null;
  return r.json();
}

export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});

  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret) return res.status(500).json({error:"Quote service not configured"});

  const user=await getUser(req);
  if(!user?.id) return res.status(401).json({error:"Sign in required"});

  const body=req.body||{};
  const quoteId=Number(body.quote_id);
  const action=String(body.action||"decision").toLowerCase();
  const decision=String(body.decision||"").toLowerCase();

  if(!quoteId){
    return res.status(400).json({error:"Invalid quote"});
  }

  if(action==="decision"&&!["approved","rejected"].includes(decision)){
    return res.status(400).json({error:"Invalid quote decision"});
  }

  try{
    const q=await fetch(
      U+"/rest/v1/quotes?id=eq."+quoteId+"&select=id,request_id,visible_to_client,file_storage_path",
      {headers:{apikey:secret,Authorization:"Bearer "+secret}}
    );
    if(!q.ok) throw new Error(await q.text());
    const rows=await q.json();
    const quote=rows[0];
    if(!quote) return res.status(404).json({error:"Quote not found"});

    const own=await fetch(
      U+"/rest/v1/requests?id=eq."+quote.request_id+"&auth_user_id=eq."+encodeURIComponent(user.id)+"&select=id&limit=1",
      {headers:{apikey:secret,Authorization:"Bearer "+secret}}
    );
    if(!own.ok) throw new Error(await own.text());
    const owned=await own.json();
    if(!owned.length||quote.visible_to_client!==true) return res.status(403).json({error:"You do not have access to this quote"});

    if(action==="file"){
      if(!quote.file_storage_path) return res.status(404).json({error:"No quote document is attached"});

      const path=String(quote.file_storage_path);

      const signed=await fetch(
        U+"/storage/v1/object/sign/client-documents/"+path.split("/").map(encodeURIComponent).join("/"),
        {
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            apikey:secret,
            Authorization:"Bearer "+secret
          },
          body:JSON.stringify({expiresIn:300})
        }
      );

      if(!signed.ok) throw new Error(await signed.text());

      const result=await signed.json();
      let url=result.signedURL||result.signedUrl||result.url;

      if(url&&!url.startsWith("http")){
        url=U+"/storage/v1"+url;
      }

      return res.status(200).json({url});
    }

    const update=await fetch(
      U+"/rest/v1/quotes?id=eq."+quoteId,
      {
        method:"PATCH",
        headers:{
          "Content-Type":"application/json",
          apikey:secret,
          Authorization:"Bearer "+secret,
          Prefer:"return=minimal"
        },
        body:JSON.stringify({
          client_decision:decision,
          client_decision_at:new Date().toISOString()
        })
      }
    );
    if(!update.ok) throw new Error(await update.text());

    if(decision==="approved"){
      await fetch(
        U+"/rest/v1/requests?id=eq."+quote.request_id,
        {
          method:"PATCH",
          headers:{
            "Content-Type":"application/json",
            apikey:secret,
            Authorization:"Bearer "+secret,
            Prefer:"return=minimal"
          },
          body:JSON.stringify({
            status:"Client Approved",
            updated_at:new Date().toISOString()
          })
        }
      );
    }

    return res.status(200).json({success:true});
  }catch(error){
    console.error(error);
    return res.status(500).json({error:"Unable to save quote decision"});
  }
}