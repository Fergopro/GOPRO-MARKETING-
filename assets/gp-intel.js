import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const S=createClient("https://oulckllygepbqbctzeka.supabase.co","sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI");
const $=id=>document.getElementById(id);
let session=null,latest=null;
const make=(tag,cls,content)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(content!==undefined)e.textContent=String(content);return e;};
function status(message,error=false){$("intelStatus").textContent=message;$("intelStatus").classList.toggle("error",error);}
function feedback(message,error=false){$("outreachFeedback").textContent=message;$("outreachFeedback").classList.toggle("error",error);}
function line(label,value){const d=make("div","intel-fact");d.append(make("small","",label),make("strong","",value||"Not stated"));return d;}
function items(title,values){
 if(!values?.length)return null;
 const wrap=make("div","intel-block");wrap.append(make("h3","",title));const ul=make("ul");
 values.forEach(v=>ul.append(make("li","",v)));wrap.append(ul);return wrap;
}
function renderSummary(p){
 const root=$("procurementSummary");root.replaceChildren();
 const a=make("div","intel-summary");
 [["Item",p.item],["Quantity",p.quantity],["Delivery destination",p.destination],["Required by",p.due_date],["Existing quote",p.quote_to_beat]].forEach(([k,v])=>a.append(line(k,v)));
 root.append(a);
 for(const [label,values] of [["Confirmed specifications",p.specifications],["Important missing information",p.missing_details],["Specification and commercial risks",p.risk_flags],["Cross-check findings",p.comparison_findings]]){
  const node=items(label,values);if(node)root.append(node);
 }
}
function mailTarget(address){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address||"");}
function draftUrl(provider,email){
 const subject=$("rfqSubject").value.trim(),body=$("rfqBody").value.trim();
 if(!subject||!body){feedback("Complete the RFQ subject and body first.",true);return null;}
 if(!mailTarget(email)){feedback("This supplier has no verified email address. Check its website before contacting it.",true);return null;}
 const p=new URLSearchParams({to:email,su:subject,body});
 if(provider==="gmail")return "https://mail.google.com/mail/?view=cm&fs=1&"+p.toString();
 return "https://outlook.office.com/mail/deeplink/compose?"+new URLSearchParams({to:email,subject,body}).toString();
}
function renderSuppliers(report){
 const root=$("supplierCards");root.replaceChildren();
 const list=report.suppliers||[];$("supplierCount").textContent=list.length+" potential supplier"+(list.length===1?"":"s");
 $("supplierResearchNote").textContent=report.research_note||"These supplier leads require independent checks before use.";
 if(!list.length){root.append(make("p","muted","No sufficiently evidenced supplier leads were returned. Try another location or more precise specifications."));return;}
 for(const supplier of list){
  const card=make("article","supplier");card.append(make("h3","",supplier.name),make("span","tag","UNVERIFIED"));
  card.append(make("p","muted",[supplier.city,supplier.country,supplier.type].filter(Boolean).join(" · ")||"Location not verified"));
  if(supplier.product_match)card.append(make("p","",supplier.product_match));
  if(supplier.verification_notes)card.append(make("p","muted","Check: "+supplier.verification_notes));
  const contact=make("p",supplier.email?"supplier-email":"muted",supplier.email?"Reported email: "+supplier.email:"Public contact email not verified");card.append(contact);
  const actions=make("div","intel-btns");
  for(const [label,url] of [["Product evidence",supplier.source_url],["Supplier website",supplier.website]]){
   if(!url)continue;const link=make("a","",label+" ↗");link.href=url;link.target="_blank";link.rel="noopener noreferrer";actions.append(link);
  }
  for(const [provider,label] of [["gmail","Gmail draft"],["outlook","Outlook draft"]]){
   const button=make("button","",label);button.type="button";button.disabled=!mailTarget(supplier.email)||!supplier.email_source;
   button.title=button.disabled?"No publicly evidenced email and source available; check supplier first.":"Opens an editable draft; does not send.";
   button.addEventListener("click",()=>{const url=draftUrl(provider,supplier.email);if(url)window.open(url,"_blank","noopener,noreferrer");});
   actions.append(button);
  }
  card.append(actions);
  if(supplier.email_source){const e=make("a","intel-link","Email source ↗");e.href=supplier.email_source;e.target="_blank";e.rel="noopener noreferrer";card.append(e);}
  root.append(card);
 }
}
function render(report){
 latest=report;
 if(report.legacy){status("This older report used a different format. Run the new structured search to see supplier cards.");}
 renderSummary(report.understanding||{});
 renderSuppliers(report);
 $("rfqSubject").value=report.rfq?.subject||"Request for quotation — GoProcures";
 $("rfqBody").value=report.rfq?.body||"";
}
async function api(method="GET",body,query=""){
 if(!session?.access_token)throw Error("Administrator login required");
 const res=await fetch("/api/gp-intel"+query,{method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:body?JSON.stringify(body):undefined});
 let data;try{data=await res.json();}catch{throw Error("The report service returned an invalid response.");}
 if(!res.ok)throw Error(data.error||"GP-INTEL request failed");
 return data;
}
async function history(){
 try{const data=await api();const root=$("intelPrevious");root.replaceChildren();
  if(!data.reports?.length){root.append(make("p","muted","No saved reports yet."));return;}
  data.reports.forEach(r=>{const btn=make("button","","#"+r.id+(r.request_id?" · GP-"+r.request_id:"")+" · "+r.brief.slice(0,70));btn.type="button";btn.onclick=async()=>{
   btn.disabled=true;try{const data=await api("GET",null,"?id="+r.id);render(data.report);status("Opened saved report #"+r.id+".");}catch(e){status(e.message,true);}finally{btn.disabled=false;}
  };root.append(btn);});
 }catch(e){$("intelPrevious").textContent="Unable to load saved reports: "+e.message;}
}
$("searchRegion").addEventListener("change",()=>{$("customRegion").hidden=$("searchRegion").value!=="Other";});
$("gpRequest").addEventListener("change",e=>{const brief=e.target.selectedOptions[0]?.dataset.brief;if(brief)$("intelBrief").value=brief;});
$("copyRfq").addEventListener("click",async()=>{const subject=$("rfqSubject").value,body=$("rfqBody").value;
 if(!body.trim()){feedback("Run a report first, or write your RFQ.",true);return;}
 try{await navigator.clipboard.writeText("Subject: "+subject+"\n\n"+body);feedback("RFQ copied.");}catch{feedback("Copy failed; select and copy the RFQ text manually.",true);}
});
$("intelForm").addEventListener("submit",async e=>{
 e.preventDefault();const button=$("intelGenerate");button.disabled=true;button.textContent="Research in progress…";
 status("Analysing the request and researching suitable suppliers…");
 try{
  const region=$("searchRegion").value==="Other"?$("customRegion").value.trim():$("searchRegion").value;
  if(!region)throw Error("Enter the supplier search location.");
  const data=await api("POST",{request_id:$("gpRequest").value||null,brief:$("intelBrief").value,search_region:region,
   supplier_kind:$("supplierKind").value,supplier_inputs:$("supplierInputs").value,comparison_inputs:$("comparisonInputs").value});
  render(data.report);
  status("Report #"+data.report.id+" saved. Review contacts and specifications before supplier outreach.");
  await history();
 }catch(error){status(error.message,true);}
 finally{button.disabled=false;button.textContent="Research suppliers & prepare RFQ";}
});
async function initialize(){
 const auth=await S.auth.getSession();session=auth.data.session;
 if(!session){location.replace("login.html");return;}
 try{
  const res=await fetch("/api/admin",{headers:{Authorization:"Bearer "+session.access_token}});
  if(!res.ok)throw Error("Administrator access required.");
  const data=await res.json();
  (data.requests||[]).forEach(r=>{const opt=document.createElement("option");opt.value=String(r.id);opt.dataset.brief=String(r.request_text||"");opt.textContent="GP-"+r.id+" · "+String(r.category||"Procurement")+" · "+String(r.request_text||"").slice(0,45);$("gpRequest").append(opt);});
  const id=new URLSearchParams(location.search).get("request");if(id)$("gpRequest").value=id;
  $("gpRequest").dispatchEvent(new Event("change"));await history();
 }catch(error){status(error.message,true);$("intelGenerate").disabled=true;}
}
initialize();