import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const S=createClient("https://oulckllygepbqbctzeka.supabase.co","sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI");
let session,db,current;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=v=>v?new Date(v).toLocaleDateString():"—";
const finished=s=>["completed","complete","closed","delivered"].includes(String(s||"").toLowerCase());

async function call(method="GET",body){
 const r=await fetch("/api/admin",{method,headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},body:body?JSON.stringify(body):undefined});
 const j=await r.json(); if(!r.ok)throw Error(j.error||"Admin request failed"); return j;
}
function flash(t,kind="ok"){const n=$("notice");n.textContent=t;n.className="notice show "+kind;setTimeout(()=>n.className="notice",2200)}
async function boot(){
 const x=await S.auth.getSession();session=x.data.session;
 if(!session)return location.replace("login.html");
 try{await load()}catch(e){
  if(e.message.includes("Admin access"))return document.body.innerHTML='<div style="max-width:520px;margin:100px auto;color:white;font-family:system-ui;text-align:center"><h1>Admin access only</h1><p style="color:#8895aa">This account is not authorised.</p><a href="dashboard.html" style="color:#a993ff">Return to dashboard</a></div>';
  flash(e.message,"error")
 }
}
async function load(){
 db=await call(); $("adminEmail").textContent=db.admin.email||"Admin";
 const rs=db.requests||[],qs=db.quotes||[],fs=db.files||[];
 $("sRequests").textContent=rs.length;$("sActive").textContent=rs.filter(r=>!finished(r.status)).length;$("sQuotes").textContent=qs.length;$("sFiles").textContent=fs.length;$("reqCount").textContent=rs.length+" requests";
 $("requests").innerHTML=rs.length?rs.map(r=>'<div class="req" data-id="'+r.id+'"><div class="req-top"><div><div class="req-title">'+esc(r.category||"Procurement Request")+'</div><div class="req-meta"><span>GP-'+r.id+'</span><span>'+esc(r.client_name||r.client_email||"Client")+'</span><span>'+esc(r.region||"")+'</span><span>'+fmt(r.created_at)+'</span><span>'+qs.filter(q=>q.request_id===r.id).length+' quotes</span><span>'+fs.filter(f=>f.request_id===r.id).length+' files</span></div></div><span class="pill">'+esc(r.status||"New")+'</span></div><div class="req-text">'+esc(r.summary||r.request_text||"")+'</div></div>').join(""):'<div class="empty">No requests yet.</div>';
 $("leads").innerHTML=(db.leads||[]).length?(db.leads||[]).map(l=>'<div class="lead"><strong>'+esc(l.name||l.company||l.email||"Lead")+'</strong><span>'+esc(l.status||"")+' · '+fmt(l.created_at)+'</span><p>'+esc(l.message||"")+'</p></div>').join(""):'<div class="empty">No leads.</div>';
 document.querySelectorAll(".req").forEach(x=>x.onclick=()=>open(Number(x.dataset.id)));
 if(current)open(current.id)
}
function open(id){
 current=(db.requests||[]).find(r=>r.id===id);if(!current)return;
 const qs=(db.quotes||[]).filter(q=>q.request_id===id),fs=(db.files||[]).filter(f=>f.request_id===id),cv=Array.isArray(current.ai_conversation)?current.ai_conversation:[];
 $("dTitle").textContent=(current.category||"Request")+" · GP-"+id;$("dMeta").textContent=(current.client_name||"Client")+" · "+(current.client_email||"")+" · "+fmt(current.created_at);
 const docs=fs.length?fs.map(f=>'<div class="doc"><span>📎 '+esc(f.file_name)+'</span><button class="mini file" data-path="'+esc(f.storage_path)+'">Open</button></div>').join(""):'<div class="empty">No attachments.</div>';
 const quotes=qs.length?qs.map(q=>'<div class="quote"><span><b>'+esc(q.supplier_name||"Supplier")+'</b><br>'+esc(q.currency||"")+' '+(q.total_price??"—")+' · '+(q.delivery_days??"—")+' days</span><span class="pill">'+esc(q.status||"received")+'</span></div>').join(""):'<div class="empty">No quotes yet.</div>';
 const convo=cv.length?cv.map(m=>'<div class="msg '+(m.role==="assistant"?"assistant":"user")+'"><b>'+(m.role==="assistant"?"GOPROCURES AI":"CLIENT")+'</b>'+esc(m.content||"")+'</div>').join(""):'<div class="empty">No AI conversation.</div>';
 $("detail").innerHTML='<div class="detail-grid"><div class="detail"><small>Status</small><div><select id="status"><option>New</option><option>Analysing</option><option>Sourcing</option><option>Awaiting Quotes</option><option>Quotes Ready</option><option>Client Review</option><option>Ordered</option><option>Completed</option><option>Closed</option></select> <button class="mini" id="saveStatus">Save</button></div></div><div class="detail"><small>Delivery</small><div>'+esc(current.region||"To be confirmed")+'</div></div><div class="detail"><small>Quantity</small><div>'+esc(current.quantity||"—")+'</div></div><div class="detail"><small>Required by</small><div>'+esc(current.urgency||"—")+'</div></div></div><div class="section"><h3>Client Requirement</h3><div class="detail"><div>'+esc(current.request_text||"")+'</div></div></div><div class="section"><h3>Attachments</h3>'+docs+'</div><div class="section"><h3>Quotes</h3>'+quotes+'<div class="form-row"><div class="field"><label>Supplier</label><input id="supplier"></div><div class="field"><label>Total price</label><input id="price" type="number"></div><div class="field"><label>Currency</label><input id="currency" value="ZAR"></div><div class="field"><label>Delivery days</label><input id="days" type="number"></div><div class="field wide"><label>Payment terms</label><input id="terms"></div></div><button class="action" id="addQuote">+ Add supplier quote</button></div><div class="section"><h3>AI Conversation</h3><div class="convo">'+convo+'</div></div>';
 const st=$("status");[...st.options].forEach(o=>{if(o.value.toLowerCase()===String(current.status||"New").toLowerCase())st.value=o.value});
 $("saveStatus").onclick=async()=>{try{await call("POST",{action:"status",request_id:id,status:st.value});flash("Status updated");await load()}catch(e){flash(e.message,"error")}};
 $("addQuote").onclick=async()=>{try{await call("POST",{action:"quote",request_id:id,supplier_name:$("supplier").value,total_price:$("price").value,currency:$("currency").value,delivery_days:$("days").value,payment_terms:$("terms").value});flash("Quote added");await load()}catch(e){flash(e.message,"error")}};
 document.querySelectorAll(".file").forEach(b=>b.onclick=async()=>{try{const x=await call("POST",{action:"file",storage_path:b.dataset.path});window.open(x.url,"_blank","noopener,noreferrer")}catch(e){flash(e.message,"error")}});
 $("drawer").classList.add("open")
}
$("closeDrawer").onclick=()=> $("drawer").classList.remove("open");
$("drawer").onclick=e=>{if(e.target.id==="drawer")$("drawer").classList.remove("open")};
$("refresh").onclick=async()=>{try{await load();flash("Data refreshed")}catch(e){flash(e.message,"error")}};
$("signOut").onclick=async()=>{await S.auth.signOut();location.replace("login.html")};
boot();