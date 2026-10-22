import {createClient} from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import {validateReview} from "./testimonial-validation.js";
const sb=createClient("https://oulckllygepbqbctzeka.supabase.co","sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI");
const $=id=>document.getElementById(id);
let records=[],editing=null,busy=false;
async function api(method="GET",body){
  const {data:{session}}=await sb.auth.getSession();
  if(!session)throw Error("Sign in as an administrator to manage reviews.");
  const response=await fetch("/api/admin-testimonials",{method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:body?JSON.stringify(body):undefined});
  let data;try{data=await response.json();}catch{throw Error("Unable to read the review service response.");}
  if(!response.ok)throw Error(data.error||"Review operation failed.");
  return data;
}
function message(value,isError=false){const el=$("tmFeedback");el.textContent=value;el.classList.toggle("error",isError);}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function cancel(){
  editing=null;$("tmForm").reset();$("tmFormTitle").textContent="Add genuine customer review";
  $("tmSave").textContent="Save pending review";$("tmCancel").hidden=true;message("");
}
function render(){
  const count=records.filter(x=>x.approved).length;
  $("tmCount").textContent=records.length+" reviews · "+count+" published · "+(records.length-count)+" pending";
  const list=$("tmList");list.replaceChildren();
  if(!records.length){list.append(el("p","empty","No reviews yet. Add genuine customer feedback using the form."));return;}
  for(const record of records){
    const card=el("article","tm-card");
    const head=el("div","tm-card-head");
    const name=el("div","tm-card-name",record.name+(record.company?" · "+record.company:""));
    const badge=el("span",record.approved?"tm-state published":"tm-state",record.approved?"Published":"Pending");
    head.append(name,badge);card.append(head);
    if(record.rating)card.append(el("div","tm-stars","★".repeat(record.rating)));
    card.append(el("p","tm-message",record.message));
    const actions=el("div","tm-card-actions");
    const edit=el("button","mini","Edit");
    edit.type="button";edit.disabled=busy;edit.onclick=()=>{
      editing=record.id;$("tmName").value=record.name;$("tmCompany").value=record.company||"";
      $("tmMessage").value=record.message;$("tmRating").value=record.rating??"";
      $("tmFormTitle").textContent="Edit review #"+record.id;$("tmSave").textContent="Save changes (pending)";
      $("tmCancel").hidden=false;message("Edits require fresh approval before publishing.");
      $("tmForm").scrollIntoView({behavior:"smooth",block:"center"});
    };
    const toggle=el("button","mini",record.approved?"Hide":"Approve");
    toggle.type="button";toggle.disabled=busy;
    toggle.onclick=()=>operate("PATCH",{id:record.id,action:record.approved?"hide":"approve"},record.approved?"Review hidden from homepage.":"Review approved and published.");
    actions.append(edit,toggle);card.append(actions);list.append(card);
  }
}
async function load(){
  const result=await api();records=Array.isArray(result.testimonials)?result.testimonials:[];
  render();
}
async function operate(method,body,notice){
  if(busy)return;busy=true;$("tmSave").disabled=true;$("tmRefresh").disabled=true;message("Saving…");
  try{
    await api(method,body);await load();cancel();message(notice);
  }catch(e){message(e.message||"Unable to save.",true);}
  finally{busy=false;$("tmSave").disabled=false;$("tmRefresh").disabled=false;render();}
}
$("tmForm")?.addEventListener("submit",event=>{
  event.preventDefault();
  const data={name:$("tmName").value,company:$("tmCompany").value,message:$("tmMessage").value,rating:$("tmRating").value};
  const result=validateReview(data);
  if(!result.ok){message(result.error,true);return;}
  const body=editing===null?result.data:{...result.data,id:editing,action:"save"};
  operate(editing===null?"POST":"PATCH",body,editing===null?"Review added as pending. Approve it to display publicly.":"Changes saved. Review is pending approval.");
});
$("tmCancel")?.addEventListener("click",cancel);
$("tmRefresh")?.addEventListener("click",async()=>{try{message("Refreshing…");await load();message("Reviews refreshed.");}catch(e){message(e.message,true);}});
const gate=async()=>{
  try{await load();}catch(e){$("tmList").replaceChildren(el("p","empty",e.message||"Unable to load reviews."));$("tmCount").textContent="Not available";message(e.message,true);}
};
gate();
