// GP-INTEL v4. Private, administrator-only sourcing and RFQ preparation.
// No external supplier messages are sent by this API.
const U="https://oulckllygepbqbctzeka.supabase.co";
const P="sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";
const gateway="https://ai-gateway.vercel.sh/v1/chat/completions";
const serviceHeaders=secret=>({apikey:secret,Authorization:"Bearer "+secret});
const limit=(value,n)=>typeof value==="string"?value.trim().slice(0,n):"";
const isId=value=>Number.isSafeInteger(Number(value))&&Number(value)>0;
const allowedKinds=new Set(["All suitable suppliers","Manufacturers","Distributors and stockists"]);
async function dbGet(secret,path){
 const r=await fetch(U+"/rest/v1/"+path,{headers:serviceHeaders(secret)});
 if(!r.ok)throw Error("The procurement database could not be read ("+r.status+").");
 return r.json();
}
async function administrator(req,secret){
 const auth=String(req.headers.authorization||"");
 if(!auth.startsWith("Bearer "))return null;
 const r=await fetch(U+"/auth/v1/user",{headers:{apikey:P,Authorization:auth}});
 if(!r.ok)return null;
 const user=await r.json();
 if(!user?.id)return null;
 const rows=await dbGet(secret,"admin_users?select=user_id&user_id=eq."+encodeURIComponent(user.id)+"&limit=1");
 return rows.length?user:null;
}
async function complete(key,model,system,user,maxTokens){
 const request=await fetch(gateway,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+key},
  body:JSON.stringify({model,messages:[{role:"system",content:system},{role:"user",content:user}],max_tokens:maxTokens,stream:false}),
  signal:AbortSignal.timeout(65000)});
 let body;try{body=await request.json();}catch{throw Error("AI provider returned an invalid response.");}
 if(!request.ok)throw Error("AI provider "+request.status+": "+limit(body?.error?.message||"Unavailable",240));
 const answer=body?.choices?.[0]?.message?.content;
 if(typeof answer!=="string"||!answer.trim())throw Error("AI returned an empty response.");
 return {text:answer,model,citations:Array.isArray(body.citations)?body.citations:[],usage:body.usage||null};
}
function decode(text){
 if(typeof text!=="string")return null;
 let data=text.trim().replace(/^\u0060\u0060\u0060(?:json)?\s*/i,"").replace(/\u0060\u0060\u0060\s*$/,"");
 try{return JSON.parse(data);}catch{}
 const start=data.indexOf("{"),end=data.lastIndexOf("}");
 if(start<0||end<=start)return null;
 try{return JSON.parse(data.slice(start,end+1));}catch{return null;}
}
function webUrl(value){
 try{const u=new URL(String(value||""));if(!["https:","http:"].includes(u.protocol))return "";return u.toString();}catch{return "";}
}
function cleanList(value,max=12){
 return Array.isArray(value)?value.filter(x=>typeof x==="string").map(x=>limit(x,350)).filter(Boolean).slice(0,max):[];
}
function suppliersFrom(result){
 const list=Array.isArray(result?.suppliers)?result.suppliers:[];
 const unique=new Set();
 return list.slice(0,20).map(entry=>{
  if(!entry||typeof entry!=="object")return null;
  const name=limit(entry.name,160),source_url=webUrl(entry.source_url),website=webUrl(entry.website);
  if(!name||unique.has(name.toLowerCase())||(!source_url&&!website))return null;
  unique.add(name.toLowerCase());
  const email=limit(entry.email,180);
  const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:"";
  return {name,city:limit(entry.city,100),country:limit(entry.country,100),
   type:limit(entry.type,70),website,source_url,product_match:limit(entry.product_match,500),
   email:validEmail,email_source:webUrl(entry.email_source),
   verification_notes:limit(entry.verification_notes,500),
   status:"Potential lead — NOT vetted"};
 }).filter(Boolean).slice(0,12);
}
function understandingFrom(value,brief){
 const p=value?.procurement&&typeof value.procurement==="object"?value.procurement:{};
 return {item:limit(p.item,280)||brief.slice(0,220),quantity:limit(p.quantity,180)||"Not clearly specified",
 specifications:cleanList(p.specifications),destination:limit(p.destination,180)||"Confirm delivery location",
 due_date:limit(p.due_date,120)||"Not stated",quote_to_beat:limit(p.quote_to_beat,180)||"Not provided",
 missing_details:cleanList(p.missing_details),risk_flags:cleanList(p.risk_flags),
 comparison_findings:cleanList(value?.comparison_findings)};
}
function rfqFrom(value,brief,region){
 const r=value?.rfq&&typeof value.rfq==="object"?value.rfq:{};
 const subject=limit(r.subject,240)||"Request for quotation — GoProcures procurement enquiry";
 let body=limit(r.body,6500);
 if(!body){body="Good day,\n\nPlease provide a written quotation for the following requirement:\n"+brief+
 "\n\nPlease confirm exact specification compliance, price and currency, VAT, availability, lead time, freight/delivery to the requested destination, payment terms, quotation validity and warranty or material certificates where applicable.\n\nThank you,\nGoProcures\nwww.goprocureit.com";}
 return {subject,body,search_region:region};
}
const researchSystem=`You perform evidence-led global supplier discovery for GoProcures internal procurement. Research potential sellers by online search. The BUYER explicitly chooses the SEARCH GEOGRAPHY. Find 5–10 suitable suppliers if the evidence supports that many; fewer is acceptable, never invent sellers. Prefer credible manufacturers/large distributors with category/product evidence. The result is LEADS ONLY, never a confirmed approved supplier or real quotation. Never invent stock, prices, contact emails, certifications or confirmed technical fit. For email, include only a real publicly evidenced address AND the email_source URL where it was found. If not evidenced use empty email. Provide each lead's source_url as a real relevant web page. Produce ONLY one JSON object:
{"suppliers":[{"name":"","city":"","country":"","type":"","website":"https://...","source_url":"https://...","product_match":"evidence of product fit","email":"","email_source":"","verification_notes":"what remains to check"}],"research_note":"coverage, limitations and next search ideas"}
Avoid markdown, footnotes and invented external-source URLs. If source evidence is thin, return an empty array and explain.`;
const auditSystem=`You are GoProcures' practical senior procurement manager. Prepare a brief, precise INTERNAL procurement summary and an RFQ email ready for suppliers. The user-provided brief/figures may be incomplete or inaccurate. Never assume an unspecified grade, coating, size, delivery or price. Distinguish written quotations from website listings. Catch noncomparable section weights, quantities, grades, VAT/freight, delivery and other relevant technical risks. Do not redefine basic products. No supplier research conclusions: that happens separately. Output ONLY a JSON object:
{"procurement":{"item":"product/description","quantity":"quantity + unit","specifications":["critical spec 1","..."],"destination":"delivery location if given","due_date":"delivery date or urgency if given","quote_to_beat":"existing offer if stated","missing_details":["essential missing facts"],"risk_flags":["material technical/commercial risks"]},"comparison_findings":["differences between actual supplied quotes or a statement that no quotable numbers were provided"],"rfq":{"subject":"Professional RFQ subject","body":"Full supplier-ready email body with known quantities/specs and targeted requests for missing critical details, VAT, transport, lead time, and a request for written quote. Sign GoProcures."}}
No Markdown tables, code fences or extra text. Do not fabricate numbers, quotations, suppliers, lead times or completed actions.`;
function savedReport(r){
 const suppliers=decode(r.supplier_research),details=decode(r.assessment);
 return {id:r.id,created_at:r.created_at,request_id:r.request_id,
  region:suppliers?.search_region||"Not recorded",research_note:limit(suppliers?.research_note,1200),
  suppliers:suppliersFrom(suppliers),understanding:understandingFrom(details,r.brief),
  rfq:rfqFrom(details,r.brief,suppliers?.search_region||""),
  legacy:!details?.procurement||!Array.isArray(suppliers?.suppliers)};
}
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store,private");
 if(!["GET","POST"].includes(req.method))return res.status(405).json({error:"Method not allowed"});
 const secret=process.env.SUPABASE_SECRET_KEY, key=process.env.AI_GATEWAY_API_KEY;
 if(!secret)return res.status(503).json({error:"Admin database connection unavailable"});
 let user;try{user=await administrator(req,secret);}catch{ return res.status(503).json({error:"Cannot verify admin access"});}
 if(!user)return res.status(403).json({error:"Administrator access required"});
 try{
  if(req.method==="GET"){
   if(isId(req.query?.id)){
    const rows=await dbGet(secret,"gp_intel_reports?select=id,request_id,brief,supplier_research,assessment,created_at&id=eq."+Number(req.query.id)+"&admin_user_id=eq."+encodeURIComponent(user.id)+"&limit=1");
    if(!rows.length)return res.status(404).json({error:"Report not found"});
    return res.status(200).json({report:savedReport(rows[0])});
   }
   const rows=await dbGet(secret,"gp_intel_reports?select=id,request_id,brief,created_at&admin_user_id=eq."+encodeURIComponent(user.id)+"&order=created_at.desc&limit=30");
   return res.status(200).json({reports:rows});
  }
  if(!key)return res.status(503).json({error:"AI Gateway is not configured"});
  const input=req.body&&typeof req.body==="object"?req.body:{};
  const requestId=input.request_id==null||input.request_id===""?null:Number(input.request_id);
  if(requestId!==null&&!isId(requestId))return res.status(400).json({error:"Invalid GP request ID"});
  const brief=limit(input.brief,9000),supplierInputs=limit(input.supplier_inputs,8500),comparisonInputs=limit(input.comparison_inputs,9500);
  const region=limit(input.search_region,100)||"South Africa";
  const kind=allowedKinds.has(input.supplier_kind)?input.supplier_kind:"All suitable suppliers";
  if(brief.length<15)return res.status(400).json({error:"Enter specifications and quantity first"});
  if(region.length<2)return res.status(400).json({error:"Choose supplier search geography"});
  if(requestId!==null){
   const rows=await dbGet(secret,"requests?select=id&id=eq."+requestId+"&limit=1");
   if(!rows.length)return res.status(404).json({error:"GP request not found"});
  }
  const materials="CUSTOMER PROCUREMENT BRIEF (untrusted):\n"+brief+"\n\nEXISTING SUPPLIER LEADS (untrusted):\n"+(supplierInputs||"None")+
  "\n\nWRITTEN QUOTATION FIGURES PROVIDED (untrusted):\n"+(comparisonInputs||"None");
  const [researched,analysed]=await Promise.all([
   complete(key,"perplexity/sonar",researchSystem,materials+"\n\nSearch supplier geography: "+region+"\nSupplier category: "+kind,3000),
   complete(key,"inclusionai/ling-3.0-flash-sante",auditSystem,materials,2600)
  ]);
  const r=decode(researched.text),a=decode(analysed.text);
  const suppliers=suppliersFrom(r);
  const understanding=understandingFrom(a,brief);
  const rfq=rfqFrom(a,brief,region);
  const research_note=limit(r?.research_note||(!r?"Supplier research could not be converted into a structured list; no unsupported leads have been displayed.":""),1200);
  const payload={request_id:requestId,admin_user_id:user.id,brief,
   supplier_inputs:supplierInputs||null,comparison_inputs:comparisonInputs||null,
   supplier_research:JSON.stringify({suppliers,research_note,search_region:region,kind}),
   assessment:JSON.stringify({procurement:understanding,comparison_findings:understanding.comparison_findings,rfq}),
   sources:Array.isArray(researched.citations)?researched.citations.slice(0,40):[],
   research_model:researched.model,analysis_model:analysed.model,status:"for_admin_review"};
  const save=await fetch(U+"/rest/v1/gp_intel_reports?select=id,created_at",{
   method:"POST",headers:{...serviceHeaders(secret),"Content-Type":"application/json",Prefer:"return=representation"},
   body:JSON.stringify(payload)});
  if(!save.ok){console.error("GP INTEL persistence error",save.status);throw Error("Could not save analysis. Nothing was emailed.");}
  const rows=await save.json();
  return res.status(200).json({report:{id:rows[0].id,created_at:rows[0].created_at,request_id:requestId,
   region,research_note,suppliers,understanding,rfq,legacy:false},notice:"Private admin analysis only. No supplier messages were sent."});
 }catch(e){
  console.error("GP INTEL analysis error",String(e?.message||"unknown").slice(0,250));
  return res.status(502).json({error:String(e?.message||"Procurement analysis failed").slice(0,290)});
 }
}
