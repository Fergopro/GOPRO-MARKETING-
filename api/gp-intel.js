// Admin-only GP-INTEL research. Research leads are not supplier verification or quotes.
// No outbound supplier communications or customer publication is performed here.
const U="https://oulckllygepbqbctzeka.supabase.co";
const P="sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";
const headers=secret=>({apikey:secret,Authorization:"Bearer "+secret});
async function get(secret,path){
 const r=await fetch(U+"/rest/v1/"+path,{headers:headers(secret)});
 if(!r.ok)throw Error("Database operation failed ("+r.status+")");
 return r.json();
}
async function isAdmin(req,secret){
 const auth=String(req.headers.authorization||"");
 if(!auth.startsWith("Bearer "))return null;
 const r=await fetch(U+"/auth/v1/user",{headers:{apikey:P,Authorization:auth}});
 if(!r.ok)return null;const user=await r.json();
 if(!user?.id)return null;
 const match=await get(secret,"admin_users?select=user_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=1");
 return match.length?user:null;
}
async function ai(key,model,messages,maxTokens){
 const response=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{
  method:"POST",
  headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
  body:JSON.stringify({model,messages,max_tokens:maxTokens,stream:false})
 });
 let data;try{data=await response.json();}catch{throw Error("AI provider response is unavailable");}
 if(!response.ok)throw Error("AI service error ("+response.status+"): "+String(data?.error?.message||"Provider unavailable").slice(0,350));
 const text=data?.choices?.[0]?.message?.content;
 if(typeof text!=="string"||!text.trim())throw Error("AI provider returned no report");
 return {text:text.trim(),citations:data.citations||data.search_results||[],model,usage:data.usage||null};
}
const str=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
const researchPrompt=`You are GP-INTEL, an internal procurement research analyst for GoProcures. Your task is to research realistic potential suppliers using available web results. Prioritize businesses likely able to supply the exact items near the delivery geography; for Eswatini and neighboring countries consider South Africa first unless evidence suggests otherwise. Return a professional report. For each potential supplier state legal/trading name, website, location, actual evidence supporting product fit, public business contact when supported, source URL, and what remains unverified. NEVER invent contact details, phone/WhatsApp/email, product availability, price, lead time, certification or legitimacy. Call every online lead UNVERIFIED until independently checked. If you lack live search data, say so; do not simulate search results. Distinguish technical match vs potential equivalent, especially grades, dimensions, weight and quantities. Include RFQ-ready technical requirements and procurement risks. Supplier outreach is not authorized. Do not transmit messages.`;
const auditPrompt=`You are the senior internal GP-INTEL technical procurement audit officer. Cross-check an untrusted supplier-research draft against the user's procurement brief and quote comparison inputs. Detect missing specs, mismatched weights/steel grades/counts, incomplete quotation lines, pricing not normalized, quantity errors, VAT/freight/duties omissions, tax/Incoterms and risks. Explicitly distinguish supplier LEADS from genuine written supplier QUOTATIONS; research results alone are not quotes. Do NOT hallucinate unverified claims or new sources. Produce:
1. Executive assessment and purchasing risk level;
2. Item-by-item specification/quantity comparison from supplied factual figures, with Unknown if missing;
3. Supplier shortlisting table sourced ONLY from research data, with evidence, URL and verification status;
4. Due-diligence checklist and red flags;
5. Missing customer/supplier questions;
6. Supplier-ready RFQ draft (NOT SENT);
7. Recommendation and what the admin must approve.
Include why a cheaper quote may not be technically comparable. Be professional, concise, explicit about limits. Do not claim supplier was contacted, vetted or quoted unless independently evidenced in provided materials.`;
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store,private");
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"Method not allowed"});
 const secret=process.env.SUPABASE_SECRET_KEY,key=process.env.AI_GATEWAY_API_KEY;
 if(!secret)return res.status(503).json({error:"Admin database connection unavailable"});
 let user;try{user=await isAdmin(req,secret);}catch(e){return res.status(503).json({error:"Cannot verify administrator access"});}
 if(!user)return res.status(403).json({error:"Administrator access required"});
 try{
  if(req.method==="GET"){
   const reportId=Number(req.query?.id);
   if(Number.isSafeInteger(reportId)&&reportId>0){
    const found=await get(secret,"gp_intel_reports?select=id,request_id,brief,supplier_research,assessment,sources,created_at&id=eq."+reportId+"&admin_user_id=eq."+encodeURIComponent(user.id)+"&limit=1");
    if(!found.length)return res.status(404).json({error:"Report not found"});
    return res.status(200).json({report:found[0]});
   }
   const rows=await get(secret,"gp_intel_reports?select=id,request_id,brief,created_at,status,research_model,analysis_model&admin_user_id=eq."+encodeURIComponent(user.id)+"&order=created_at.desc&limit=30");
   return res.status(200).json({reports:rows});
  }
  if(!key)return res.status(503).json({error:"AI Gateway is not configured"});
  const body=req.body&&typeof req.body==="object"?req.body:{};
  const requestId=body.request_id==null||body.request_id===""?null:Number(body.request_id);
  if(requestId!==null&&(!Number.isSafeInteger(requestId)||requestId<1))return res.status(400).json({error:"Invalid GP request ID"});
  const brief=str(body.brief,9000),supplierInputs=str(body.supplier_inputs,8500),comparisonInputs=str(body.comparison_inputs,9500);
  if(brief.length<15)return res.status(400).json({error:"Enter an RFQ brief with specifications, quantity and delivery location"});
  if(requestId!==null){
   const found=await get(secret,"requests?select=id&id=eq."+requestId+"&limit=1");
   if(!found.length)return res.status(404).json({error:"GP request not found"});
  }
  const material="PROCUREMENT BRIEF (untrusted):\n"+brief+"\n\nSUPPLIER LEADS PROVIDED (untrusted):\n"+(supplierInputs||"None")+"\n\nQUOTATION FIGURES/COMPARISON (untrusted, not independently verified):\n"+(comparisonInputs||"None");
  const searched=await ai(key,"perplexity/sonar",[{role:"system",content:researchPrompt},{role:"user",content:material}],2600);
  const audited=await ai(key,"inclusionai/ling-3.0-flash-sante",[{role:"system",content:auditPrompt},{role:"user",content:material+"\n\nWEB RESEARCH DRAFT (untrusted; verify citations):\n"+searched.text.slice(0,21000)}],3700);
  const payload={request_id:requestId,admin_user_id:user.id,brief,supplier_inputs:supplierInputs||null,comparison_inputs:comparisonInputs||null,supplier_research:searched.text,assessment:audited.text,sources:Array.isArray(searched.citations)?searched.citations.slice(0,40):[],research_model:searched.model,analysis_model:audited.model,status:"for_admin_review"};
  const save=await fetch(U+"/rest/v1/gp_intel_reports?select=id,created_at",{method:"POST",headers:{...headers(secret),"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(payload)});
  if(!save.ok){console.error("GP-INTEL report save failed",save.status);throw Error("Analysis generated but could not be saved; please retry");}
  const saved=await save.json();
  return res.status(200).json({report:{id:saved[0]?.id,created_at:saved[0]?.created_at,research:searched.text,assessment:audited.text,citations:payload.sources},notice:"Internal report only. Supplier leads are not vetted, prices are not supplier quotations, no RFQs sent."});
 }catch(e){console.error("GP-INTEL report error",e?.message||"unknown");return res.status(502).json({error:String(e?.message||"GP-INTEL analysis failed").slice(0,350)});}
}
