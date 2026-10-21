import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const S=createClient(
  "https://oulckllygepbqbctzeka.supabase.co",
  "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI"
);

let session=null;
let db=null;
let current=null;
let quoteBusy=false;
let noticeTimer=null;

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

  let j;try{j=await r.json();}catch{throw new Error("Server returned an invalid response (HTTP "+r.status+").");}

  if(!r.ok){
    throw new Error(j.error||"Admin request failed");
  }

  return j;
}

function flash(text,kind="ok"){
  const n=$("notice");
  n.textContent=text;
  n.className="notice show "+kind;
  clearTimeout(noticeTimer);
  noticeTimer=setTimeout(()=>n.className="notice",4200);
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
  const entitlement=(db.entitlements||[]).find(e=>e.user_id===current.auth_user_id)||null;
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

  const comparisonHtml=qs.length
    ? '<div style="overflow:auto;margin-bottom:12px"><table style="width:100%;border-collapse:collapse;font-size:10px"><thead><tr style="color:#7f8da4;text-align:left"><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">Supplier</th><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">Total</th><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">Delivery</th><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">Client</th><th style="padding:8px;border-bottom:1px solid rgba(255,255,255,.08)">Visible</th></tr></thead><tbody>'+
        qs.map(q=>
          '<tr>'+
            '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.05)">'+esc(q.supplier_name||"Supplier")+'</td>'+
            '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.05)">'+money(q.total_price,q.currency)+'</td>'+
            '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.05)">'+(q.delivery_days??"—")+' days</td>'+
            '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.05)">'+esc(q.client_decision||"pending")+'</td>'+
            '<td style="padding:8px;border-bottom:1px solid rgba(255,255,255,.05)">'+(q.visible_to_client?"Yes":"No")+'</td>'+
          '</tr>'
        ).join("")+
      '</tbody></table></div>'
    : '';

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
                  : '<button class="quote-publish js-publish" data-id="'+q.id+'" data-visible="true">Publish to client</button><button class="quote-upload js-edit-quote" data-id="'+q.id+'">Edit details</button>')+
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
      '<h3>Client Account & Voice AI</h3>'+
      '<div class="detail">'+
        '<small>Plan</small>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
          '<span class="pill">'+esc(entitlement?.plan||"free")+'</span>'+
          '<span style="font-size:10px;color:#7f8da4">Voice used: '+Number(entitlement?.voice_seconds_used||0)+' sec</span>'+
          '<span style="font-size:10px;color:#7f8da4">Trial: '+(entitlement?.voice_trial_started_at?"used":"available")+'</span>'+
        '</div>'+
        '<div class="quote-actions" style="margin-top:10px">'+
          '<button class="mini" id="makePro">Set Pro</button>'+
          '<button class="mini" id="makeFree">Set Free</button>'+
          '<button class="mini" id="resetVoiceTrial">Reset Voice Trial</button>'+
        '</div>'+
      '</div>'+
    '</div>'+

    '<div class="section">'+
      '<h3>Client Requirement</h3>'+
      '<div class="detail"><div>'+esc(current.request_text||"")+'</div></div>'+
    '</div>'+

    '<div class="section"><h3>Client Attachments</h3>'+filesHtml+'</div>'+

    '<div class="section">'+
      '<h3>Supplier Quotes & Client Approval</h3>'+
      comparisonHtml+
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
      '<button class="mini" id="loadConversation" type="button">View saved conversation</button>'+
      '<div class="convo" id="requestConversation">'+(convo.length?convoHtml:'<div class="empty">Conversation is loaded on demand to keep this page fast.</div>')+'</div>'+
    '</div>';

  const transcriptButton=$("loadConversation");
  transcriptButton.onclick=async()=>{
    transcriptButton.disabled=true;transcriptButton.textContent="Loading conversation…";
    try{
      const r=await fetch("/api/admin?action=conversation&request_id="+encodeURIComponent(id),{headers:{Authorization:"Bearer "+session.access_token}});
      const payload=await r.json();if(!r.ok)throw new Error(payload.error||"Unable to load conversation");
      const items=Array.isArray(payload.request?.ai_conversation)?payload.request.ai_conversation:[];
      const parent=$("requestConversation");parent.replaceChildren();
      if(!items.length){parent.textContent="No AI conversation stored for this request.";return;}
      for(const item of items){const d=document.createElement("div");d.className="msg "+(item.role==="assistant"?"assistant":"user");const label=document.createElement("b");label.textContent=item.role==="assistant"?"GOPROCURES AI":"CLIENT";d.append(label,document.createTextNode(String(item.content||"")));parent.append(d);}
      transcriptButton.textContent="Conversation loaded";
    }catch(e){flash(e.message,"error");transcriptButton.disabled=false;transcriptButton.textContent="Retry conversation";}
  };
  const sel=$("statusSelect");

  [...sel.options].forEach(o=>{
    if(o.value.toLowerCase()===String(current.status||"New").toLowerCase()){
      sel.value=o.value;
    }
  });

  const makePro=$("makePro");
  const makeFree=$("makeFree");
  const resetVoiceTrial=$("resetVoiceTrial");

  if(makePro){
    makePro.onclick=async()=>{
      try{
        await call("POST",{
          action:"set_plan",
          user_id:current.auth_user_id,
          plan:"pro"
        });
        flash("Client upgraded to Pro");
        await load();
      }catch(e){
        flash(e.message,"error");
      }
    };
  }

  if(makeFree){
    makeFree.onclick=async()=>{
      try{
        await call("POST",{
          action:"set_plan",
          user_id:current.auth_user_id,
          plan:"free"
        });
        flash("Client set to Free");
        await load();
      }catch(e){
        flash(e.message,"error");
      }
    };
  }

  if(resetVoiceTrial){
    resetVoiceTrial.onclick=async()=>{
      try{
        await call("POST",{
          action:"reset_voice_trial",
          user_id:current.auth_user_id
        });
        flash("Voice trial reset");
        await load();
      }catch(e){
        flash(e.message,"error");
      }
    };
  }

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

  const formFeedback=document.createElement("p");formFeedback.className="quote-form-feedback";formFeedback.setAttribute("role","status");
  $("addQuote").insertAdjacentElement("afterend",formFeedback);
  function quoteFeedback(message,isError=false){formFeedback.textContent=message;formFeedback.classList.toggle("error",isError);formFeedback.scrollIntoView({block:"nearest",behavior:"auto"});}
  $("addQuote").onclick=async()=>{
    if(quoteBusy)return;
    const supplier=$("qSupplier").value.trim(),file=$("qFile").files?.[0];
    const price=$("qPrice").value.trim(),days=$("qDays").value.trim();
    if(!supplier&&!file){quoteFeedback("Enter a supplier name or choose a PDF quote first.",true);return;}
    if(file&&file.size>15*1024*1024){quoteFeedback("Quote file must be smaller than 15 MB.",true);return;}
    if(file&&!/\.(pdf|jpe?g|png|webp|xlsx?|docx?)$/i.test(file.name)){quoteFeedback("Use a PDF, image, Excel or Word quotation.",true);return;}
    if(price&&(!Number.isFinite(Number(price))||Number(price)<0)){quoteFeedback("Enter a valid total price.",true);return;}
    if(days&&(!Number.isInteger(Number(days))||Number(days)<0)){quoteFeedback("Enter a valid delivery time in days.",true);return;}
    quoteBusy=true;const btn=$("addQuote");btn.disabled=true;btn.textContent="Saving quotation…";
    let createdId=null;
    try{
      quoteFeedback("Saving private supplier quotation…");
      const result=await call("POST",{action:"quote",request_id:id,supplier_name:supplier,file_pending:!!file,total_price:price,currency:$("qCurrency").value,delivery_days:days,payment_terms:$("qTerms").value,admin_notes:$("qNotes").value});
      createdId=result.quote?.id;
      if(file){
        if(!createdId)throw new Error("Quotation record was not returned.");
        btn.textContent="Uploading PDF…";
        quoteFeedback("Uploading "+file.name+" securely…");
        await uploadQuoteFile(id,createdId,file);
      }
      flash("Supplier quote saved privately");
      quoteFeedback("Supplier quotation saved. Complete any missing supplier or price details before publishing.");
      await load();
    }catch(e){
      const prefix=createdId?"Quote GP-"+id+" was created but file upload or update failed. ":"";
      quoteFeedback(prefix+(e.message||"Please retry."),true);
      flash(e.message||"Unable to save supplier quote","error");
    }finally{quoteBusy=false;btn.disabled=false;btn.textContent="+ Add supplier quote";}
  };

  document.querySelectorAll(".js-edit-quote").forEach(button=>{
    button.onclick=()=>{
      const quote=(db.quotes||[]).find(q=>q.id===Number(button.dataset.id));
      if(!quote)return;
      $("qSupplier").value=quote.supplier_name||"";
      $("qPrice").value=quote.total_price??"";
      $("qCurrency").value=quote.currency||"ZAR";
      $("qDays").value=quote.delivery_days??"";
      $("qTerms").value=quote.payment_terms||"";
      $("qNotes").value=quote.admin_notes||"";
      const add=$("addQuote");
      add.textContent="Save changes to draft";
      add.onclick=async()=>{
        if(quoteBusy)return;
        quoteBusy=true;add.disabled=true;
        try{
          await call("POST",{action:"edit_quote",quote_id:quote.id,supplier_name:$("qSupplier").value,total_price:$("qPrice").value,currency:$("qCurrency").value,delivery_days:$("qDays").value,payment_terms:$("qTerms").value,admin_notes:$("qNotes").value});
          quoteFeedback("Draft quotation details updated.");await load();
        }catch(e){quoteFeedback(e.message,true);}finally{quoteBusy=false;add.disabled=false;}
      };
      quoteFeedback("Editing saved quote #"+quote.id+". Make changes and choose Save changes to draft.");
      $("qSupplier").focus();
    };
  });

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
