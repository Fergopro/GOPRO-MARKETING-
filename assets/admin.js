import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const S=createClient(
  "https://oulckllygepbqbctzeka.supabase.co",
  "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI"
);

let session=null;
let db=null;
let current=null;

const $=id=>document.getElementById(id);

const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;"
}[c]));

const fmt=v=>v
  ? new Intl.DateTimeFormat("en",{year:"numeric",month:"short",day:"numeric"}).format(new Date(v))
  : "—";

const finished=s=>[
  "completed","complete","closed","delivered"
].includes(String(s||"").toLowerCase());

function money(n,currency){
  if(n===null||n===undefined||n==="") return "—";
  try{
    return new Intl.NumberFormat("en",{
      style:"currency",
      currency:currency||"ZAR",
      maximumFractionDigits:2
    }).format(Number(n));
  }catch{
    return (currency||"")+" "+Number(n).toLocaleString();
  }
}

async function call(method="GET",body){
  const r=await fetch("/api/admin",{
    method,
    headers:{
      "Content-Type":"application/json",
      Authorization:"Bearer "+session.access_token
    },
    body:body?JSON.stringify(body):undefined
  });

  const j=await r.json();

  if(!r.ok){
    throw new Error(j.error||"Admin request failed");
  }

  return j;
}

function flash(text,kind="ok"){
  const n=$("notice");
  n.textContent=text;
  n.className="notice show "+kind;
  setTimeout(()=>n.className="notice",2600);
}

async function boot(){
  const {data:{session:s}}=await S.auth.getSession();

  if(!s){
    location.replace("login.html");
    return;
  }

  session=s;

  try{
    await load();
  }catch(e){
    if(String(e.message).includes("Admin access")){
      document.body.innerHTML=
        '<div style="max-width:520px;margin:100px auto;color:white;font-family:system-ui;text-align:center">'+
        '<h1>Admin access only</h1>'+
        '<p style="color:#8895aa">This account is not authorised for the GoProcures admin console.</p>'+
        '<a href="dashboard.html" style="color:#a993ff">Return to dashboard</a>'+
        '</div>';
      return;
    }

    flash(e.message,"error");
  }
}

async function load(){
  db=await call();

  $("adminEmail").textContent=db.admin.email||"Admin";

  const rs=db.requests||[];
  const qs=db.quotes||[];
  const fs=db.files||[];

  $("sRequests").textContent=rs.length;
  $("sActive").textContent=rs.filter(r=>!finished(r.status)).length;
  $("sQuotes").textContent=qs.length;
  $("sFiles").textContent=fs.length;

  renderRequests();

  const leads=db.leads||[];

  $("leads").innerHTML=leads.length
    ? leads.map(l=>
        '<div class="lead">'+
          '<strong>'+esc(l.name||l.company||l.email||"Unidentified lead")+'</strong>'+
          '<span>'+esc(l.status||"")+' · '+fmt(l.created_at)+'</span>'+
          '<p>'+esc(l.message||"")+'</p>'+
        '</div>'
      ).join("")
    : '<div class="empty">No recent leads.</div>';

  if(current){
    openRequest(current.id);
  }
}

function filteredRequests(){
  const search=String($("requestSearch")?.value||"").trim().toLowerCase();
  const status=String($("statusFilter")?.value||"").toLowerCase();
  const quoteState=String($("quoteFilter")?.value||"");
  const qs=db?.quotes||[];

  return (db?.requests||[]).filter(r=>{
    const haystack=[
      "GP-"+r.id,
      r.client_name,
      r.client_email,
      r.category,
      r.region,
      r.request_text,
      r.summary
    ].join(" ").toLowerCase();

    if(search&&!haystack.includes(search)) return false;

    if(status&&String(r.status||"").toLowerCase()!==status){
      return false;
    }

    const rq=qs.filter(q=>q.request_id===r.id);

    if(quoteState==="none"&&rq.length) return false;
    if(quoteState==="unpublished"&&!rq.some(q=>!q.visible_to_client)) return false;
    if(quoteState==="published"&&!rq.some(q=>q.visible_to_client)) return false;
    if(quoteState==="approved"&&!rq.some(q=>q.client_decision==="approved")) return false;

    return true;
  });
}

function renderRequests(){
  const rs=filteredRequests();
  const qs=db?.quotes||[];
  const fs=db?.files||[];

  $("reqCount").textContent=
    rs.length+" request"+(rs.length===1?"":"s");

  $("requests").innerHTML=rs.length
    ? rs.map(r=>{
        const rq=qs.filter(q=>q.request_id===r.id);
        const files=fs.filter(f=>f.request_id===r.id).length;
        const published=rq.filter(q=>q.visible_to_client).length;
        const approved=rq.filter(q=>q.client_decision==="approved").length;

        return (
          '<div class="req" data-id="'+r.id+'">'+
            '<div class="req-top">'+
              '<div>'+
                '<div class="req-title">'+esc(r.category||"Procurement Request")+'</div>'+
                '<div class="req-meta">'+
                  '<span>GP-'+r.id+'</span>'+
                  '<span>'+esc(r.client_name||r.client_email||"Client")+'</span>'+
                  '<span>'+esc(r.region||"")+'</span>'+
                  '<span>'+fmt(r.created_at)+'</span>'+
                  '<span>'+rq.length+' quotes</span>'+
                  '<span>'+published+' published</span>'+
                  '<span>'+approved+' approved</span>'+
                  '<span>'+files+' files</span>'+
                '</div>'+
              '</div>'+
              '<span class="pill">'+esc(r.status||"New")+'</span>'+
            '</div>'+
            '<div class="req-text">'+esc(r.summary||r.request_text||"")+'</div>'+
          '</div>'
        );
      }).join("")
    : '<div class="empty">No requests match these filters.</div>';

  document.querySelectorAll(".req").forEach(el=>{
    el.onclick=()=>openRequest(Number(el.dataset.id));
  });
}

async function uploadQuoteFile(requestId,quoteId,file){
  if(!file) return;

  if(file.size>15*1024*1024){
    throw new Error("Quote file must be smaller than 15 MB.");
  }

  const safe=file.name
    .replace(/[^a-zA-Z0-9._-]+/g,"-")
    .replace(/-+/g,"-");

  const path=
    "admin-quotes/"+
    requestId+"/"+
    quoteId+"/"+
    crypto.randomUUID()+"-"+safe;

  const {error}=await S.storage
    .from("client-documents")
    .upload(path,file,{
      cacheControl:"3600",
      upsert:false,
      contentType:file.type||undefined
    });

  if(error){
    throw error;
  }

  await call("POST",{
    action:"quote_file",
    quote_id:quoteId,
    storage_path:path,
    file_name:file.name
  });
}

function decisionClass(value){
  if(value==="approved") return "approved";
  if(value==="rejected") return "rejected";
  return "pending";
}

function openRequest(id){
  current=(db.requests||[]).find(r=>r.id===id);

  if(!current) return;

  const qs=(db.quotes||[]).filter(q=>q.request_id===id);
  const fs=(db.files||[]).filter(f=>f.request_id===id);
  const convo=Array.isArray(current.ai_conversation)
    ? current.ai_conversation
    : [];

  $("dTitle").textContent=
    (current.category||"Procurement Request")+" · GP-"+id;

  $("dMeta").textContent=
    (current.client_name||"Client")+
    " · "+(current.client_email||"")+
    " · "+fmt(current.created_at);

  const filesHtml=fs.length
    ? fs.map(f=>
        '<div class="doc">'+
          '<span>📎 '+esc(f.file_name)+'</span>'+
          '<button class="mini js-file" data-path="'+esc(f.storage_path)+'">Open</button>'+
        '</div>'
      ).join("")
    : '<div class="empty">No client attachments yet.</div>';

  const quotesHtml=qs.length
    ? qs.map(q=>{
        const decision=q.client_decision||"pending";
        return (
          '<div class="quote '+decisionClass(decision)+'">'+
            '<div class="quote-main">'+
              '<span><b>'+esc(q.supplier_name||"Supplier")+'</b></span>'+
              '<span>'+money(q.total_price,q.currency)+' · '+(q.delivery_days??"—")+' days</span>'+
              '<div class="quote-meta">'+
                (q.payment_terms?esc(q.payment_terms):"No payment terms")+
                (q.quote_file_name?' · 📎 '+esc(q.quote_file_name):"")+
              '</div>'+
              (q.admin_notes?'<div class="quote-note">Admin note: '+esc(q.admin_notes)+'</div>':"")+
              '<div class="quote-actions">'+
                '<span class="client-state '+decisionClass(decision)+'">'+esc(decision)+'</span>'+
                (q.file_storage_path
                  ? '<button class="quote-upload js-file" data-path="'+esc(q.file_storage_path)+'">Open quote</button>'
                  : '<button class="quote-upload js-upload-quote" data-id="'+q.id+'">Upload quote PDF</button>')+
                (q.visible_to_client
                  ? '<button class="quote-unpublish js-publish" data-id="'+q.id+'" data-visible="false">Hide from client</button>'
                  : '<button class="quote-publish js-publish" data-id="'+q.id+'" data-visible="true">Publish to client</button>')+
              '</div>'+
            '</div>'+
            '<span class="pill">'+esc(q.status||"received")+'</span>'+
          '</div>'
        );
      }).join("")
    : '<div class="empty">No quotes recorded yet.</div>';

  const convoHtml=convo.length
    ? convo.map(m=>
        '<div class="msg '+(m.role==="assistant"?"assistant":"user")+'">'+
          '<b>'+(m.role==="assistant"?"GOPROCURES AI":"CLIENT")+'</b>'+
          esc(m.content||"")+
        '</div>'
      ).join("")
    : '<div class="empty">No AI conversation stored for this request.</div>';

  $("detail").innerHTML=
    '<div class="detail-grid">'+
      '<div class="detail"><small>Status</small><div>'+
        '<select id="statusSelect">'+
          '<option>New</option>'+
          '<option>Analysing</option>'+
          '<option>Sourcing</option>'+
          '<option>Awaiting Quotes</option>'+
          '<option>Quotes Ready</option>'+
          '<option>Client Review</option>'+
          '<option>Client Approved</option>'+
          '<option>Ordered</option>'+
          '<option>Completed</option>'+
          '<option>Closed</option>'+
        '</select>'+
        '<button class="mini" id="saveStatus" style="margin-left:7px">Save</button>'+
      '</div></div>'+
      '<div class="detail"><small>Delivery</small><div>'+esc(current.region||"To be confirmed")+'</div></div>'+
      '<div class="detail"><small>Quantity</small><div>'+esc(current.quantity||"—")+'</div></div>'+
      '<div class="detail"><small>Required by</small><div>'+esc(current.urgency||"—")+'</div></div>'+
    '</div>'+

    '<div class="section">'+
      '<h3>Client Requirement</h3>'+
      '<div class="detail"><div>'+esc(current.request_text||"")+'</div></div>'+
    '</div>'+

    '<div class="section"><h3>Client Attachments</h3>'+filesHtml+'</div>'+

    '<div class="section">'+
      '<h3>Supplier Quotes & Client Approval</h3>'+
      quotesHtml+
      '<div class="form-row" style="margin-top:12px">'+
        '<div class="field"><label>Supplier</label><input id="qSupplier"></div>'+
        '<div class="field"><label>Total price</label><input id="qPrice" type="number" step="0.01"></div>'+
        '<div class="field"><label>Currency</label><input id="qCurrency" value="ZAR"></div>'+
        '<div class="field"><label>Delivery days</label><input id="qDays" type="number"></div>'+
        '<div class="field wide"><label>Payment terms</label><input id="qTerms"></div>'+
        '<div class="field wide"><label>Admin notes</label><input id="qNotes" placeholder="Internal note, comparison comment, specification note..."></div>'+
        '<div class="field wide"><label>Supplier quote file</label><input id="qFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc"></div>'+
      '</div>'+
      '<button class="action" id="addQuote">+ Add supplier quote</button>'+
    '</div>'+

    '<div class="section">'+
      '<h3>AI Conversation</h3>'+
      '<div class="convo">'+convoHtml+'</div>'+
    '</div>';

  const sel=$("statusSelect");

  [...sel.options].forEach(o=>{
    if(o.value.toLowerCase()===String(current.status||"New").toLowerCase()){
      sel.value=o.value;
    }
  });

  $("saveStatus").onclick=async()=>{
    try{
      await call("POST",{
        action:"status",
        request_id:id,
        status:sel.value
      });

      flash("Request status updated");
      await load();
    }catch(e){
      flash(e.message,"error");
    }
  };

  $("addQuote").onclick=async()=>{
    try{
      const result=await call("POST",{
        action:"quote",
        request_id:id,
        supplier_name:$("qSupplier").value,
        total_price:$("qPrice").value,
        currency:$("qCurrency").value,
        delivery_days:$("qDays").value,
        payment_terms:$("qTerms").value,
        admin_notes:$("qNotes").value
      });

      const file=$("qFile").files?.[0];

      if(file&&result.quote?.id){
        await uploadQuoteFile(id,result.quote.id,file);
      }

      flash("Supplier quote added");
      await load();
    }catch(e){
      flash(e.message,"error");
    }
  };

  document.querySelectorAll(".js-publish").forEach(button=>{
    button.onclick=async()=>{
      try{
        await call("POST",{
          action:"publish_quote",
          quote_id:Number(button.dataset.id),
          request_id:id,
          visible:button.dataset.visible==="true"
        });

        flash(
          button.dataset.visible==="true"
            ? "Quote published to client"
            : "Quote hidden from client"
        );

        await load();
      }catch(e){
        flash(e.message,"error");
      }
    };
  });

  document.querySelectorAll(".js-upload-quote").forEach(button=>{
    button.onclick=()=>{
      const input=document.createElement("input");
      input.type="file";
      input.accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.docx,.doc";

      input.onchange=async()=>{
        const file=input.files?.[0];

        if(!file) return;

        try{
          await uploadQuoteFile(
            id,
            Number(button.dataset.id),
            file
          );

          flash("Quote document uploaded");
          await load();
        }catch(e){
          flash(e.message,"error");
        }
      };

      input.click();
    };
  });

  document.querySelectorAll(".js-file").forEach(button=>{
    button.onclick=async()=>{
      try{
        const result=await call("POST",{
          action:"file",
          storage_path:button.dataset.path
        });

        window.open(
          result.url,
          "_blank",
          "noopener,noreferrer"
        );
      }catch(e){
        flash(e.message,"error");
      }
    };
  });

  $("drawer").classList.add("open");
}

["requestSearch","statusFilter","quoteFilter"].forEach(id=>{
  $(id)?.addEventListener(
    id==="requestSearch"?"input":"change",
    renderRequests
  );
});

$("closeDrawer").onclick=()=>{
  $("drawer").classList.remove("open");
  current=null;
};

$("drawer").onclick=e=>{
  if(e.target.id==="drawer"){
    $("drawer").classList.remove("open");
    current=null;
  }
};

$("refresh").onclick=async()=>{
  try{
    await load();
    flash("Admin data refreshed");
  }catch(e){
    flash(e.message,"error");
  }
};

$("signOut").onclick=async()=>{
  await S.auth.signOut();
  location.replace("login.html");
};

boot();
