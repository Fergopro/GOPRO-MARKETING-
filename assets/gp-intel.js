import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const S=createClient("https://oulckllygepbqbctzeka.supabase.co","sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI");
const $=id=>document.getElementById(id);
let session=null;
function note(message,error=false){$("intelStatus").textContent=message;$("intelStatus").classList.toggle("error",error);}
async function api(method,body){
 if(!session)throw Error("Sign in required");
 const res=await fetch("/api/gp-intel",{method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:body?JSON.stringify(body):undefined});
 const data=await res.json();if(!res.ok)throw Error(data.error||"GP-INTEL request failed");return data;
}
async function history(){
 try{const data=await api("GET");const container=$("intelPrevious");container.replaceChildren();
  if(!data.reports?.length){container.textContent="No internal reports yet.";return;}
  data.reports.forEach(r=>{const p=document.createElement("p");p.textContent="#"+r.id+(r.request_id?" · GP-"+r.request_id:"")+" · "+new Date(r.created_at).toLocaleDateString()+" · "+r.brief.slice(0,100);container.append(p);});
 }catch(e){$("intelPrevious").textContent=e.message;}
}
async function initialize(){
 const auth=await S.auth.getSession();session=auth.data.session;
 if(!session){location.replace("login.html");return;}
 try{
  const res=await fetch("/api/admin",{headers:{Authorization:"Bearer "+session.access_token}});
  if(!res.ok)throw Error("Admin access required");
  const data=await res.json();
  (data.requests||[]).forEach(r=>{const opt=document.createElement("option");opt.value=String(r.id);opt.textContent="GP-"+r.id+" · "+String(r.category||"Procurement")+" · "+String(r.request_text||"").slice(0,60);opt.dataset.brief=String(r.request_text||"");$("gpRequest").append(opt);});
  const p=new URLSearchParams(location.search).get("request");if(p)$("gpRequest").value=p;
  $("gpRequest").dispatchEvent(new Event("change"));
  await history();
 }catch(e){note(e.message,true);$("intelGenerate").disabled=true;}
}
$("gpRequest").addEventListener("change",e=>{const brief=e.target.selectedOptions[0]?.dataset.brief;if(brief)$("intelBrief").value=brief;});
$("intelForm").addEventListener("submit",async e=>{
 e.preventDefault();const button=$("intelGenerate");button.disabled=true;button.textContent="Researching and checking…";
 note("Researching. No suppliers are being contacted.");
 $("intelResearch").textContent="Retrieving supplier research…";$("intelAssessment").textContent="Running technical audit…";
 try{
  const data=await api("POST",{request_id:$("gpRequest").value||null,brief:$("intelBrief").value,supplier_inputs:$("supplierInputs").value,comparison_inputs:$("comparisonInputs").value});
  $("intelResearch").textContent=data.report.research;$("intelAssessment").textContent=data.report.assessment;
  note("Private report #"+data.report.id+" saved. Verify supplier information independently.");
  await history();
 }catch(err){note(err.message,true);$("intelAssessment").textContent="Report generation failed.";}
 finally{button.disabled=false;button.textContent="Run GP-INTEL Research & Audit";}
});
initialize();