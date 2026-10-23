/* GoProcures cinematic V3 — self-contained client. Supabase publishable key only. */
const GP={url:'https://oulckllygepbqbctzeka.supabase.co',key:'sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI'};
const $=(s,p=document)=>p.querySelector(s);const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
let supabase=null,user=null,authPromise=null,activeRequestId=null,conversation=[],busy=false,requestStore=null,saveError=false,confirmedRequestId=null;
const input=$('#aiQuickInput'),send=$('.js-ai-submit');
function textEscape(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function updateAuth(){const logged=!!user;const files=$("#aiFiles");if(files)files.disabled=!logged||busy;const confirm=$("#confirmTextRequest");if(confirm)confirm.disabled=!logged||busy||confirmedRequestId!==null||!conversation.some(m=>m.role==="user");$$('.auth-dashboard-link,.auth-voice-link').forEach(e=>e.hidden=!logged);$$('.auth-login-link').forEach(e=>e.hidden=logged);$$('.auth-signout-link').forEach(e=>e.hidden=!logged);$$('.auth-ai-entry').forEach(a=>{a.href=logged?'#assistant':'login.html';});const b=$('#aiAuthBanner'),u=$('#aiUserStrip');if(b)b.hidden=logged;if(u)u.hidden=!logged;if($('#aiUserLabel'))$('#aiUserLabel').textContent=logged?'SIGNED IN / '+(user.user_metadata?.full_name||user.email||'CLIENT'):'SIGNED IN';if(input){input.disabled=!logged||busy;input.placeholder=logged?'What can GoProcures source for you?':'Sign in to begin a procurement request';}if(send)send.disabled=!logged||busy;$$('.js-example').forEach(e=>e.disabled=!logged);if($('#newChat'))$('#newChat').hidden=!logged;}
async function initAuth(){if(authPromise)return authPromise;authPromise=(async()=>{try{const mod=await import('./supabase-client.js');supabase=await mod.getProcurementClient();const {data}=await supabase.auth.getSession();user=data.session?.user||null;updateAuth();supabase.auth.onAuthStateChange((_event,session)=>{if(user?.id!==session?.user?.id){conversation=[];activeRequestId=null;requestStore=null;confirmedRequestId=null;$("#aiConversation")?.replaceChildren();$("#attachmentList")?.replaceChildren();}user=session?.user||null;updateAuth()});}catch(e){console.error('Authentication unavailable:',e);updateAuth();}})();return authPromise;}
function append(role,content){const box=$('#aiConversation');if(!box)return;const row=document.createElement('div');row.className='ai-message-row '+(role==='user'?'ai-message-row-user':'ai-message-row-agent');const av=document.createElement('div');av.className='ai-chat-avatar '+(role==='user'?'ai-chat-avatar-user':'ai-chat-avatar-agent');av.textContent=role==='user'?'U':'AI';const msg=document.createElement('div');msg.className='ai-message '+(role==='user'?'ai-message-user':'ai-message-agent');const label=document.createElement('div');label.className='ai-message-label';label.textContent=role==='user'?'YOU':'GOPROCURES AI';const body=document.createElement('div');body.className='ai-message-body';body.textContent=content;msg.append(label,body);if(role==='user')row.append(msg,av);else row.append(av,msg);box.append(row);box.scrollTop=box.scrollHeight;}
function status(message){let n=$('#aiStatus');if(!n){n=document.createElement('div');n.id='aiStatus';n.className='ai-status';$('#aiConversation').append(n);}n.textContent=message;n.hidden=false;$('#aiConversation').scrollTop=$('#aiConversation').scrollHeight;}
function statusOff(){const n=$('#aiStatus');if(n)n.remove();}
function displayName(){return user?.user_metadata?.full_name||user?.user_metadata?.name||user?.email?.split('@')[0]||'Client';}
function saveNotice(message,error=false){const n=$('#requestSaveStatus');if(n){n.textContent=message;n.dataset.error=String(error);}}
async function storeForUser(){if(!requestStore){const {ProcurementRequestStore}=await import('./request-store.js');requestStore=new ProcurementRequestStore(supabase,user,'text');}return requestStore;}
async function saveConversation(confirmed=false){if(!supabase||!user)throw Error('Sign in to save.');const store=await storeForUser();activeRequestId=await store.save(conversation,{confirmed});saveError=false;saveNotice(confirmed?'Request confirmed and saved. Open your dashboard to track it.':'Conversation saved to your dashboard. Confirm when your brief is ready.');}
async function askAI(message){const response=await fetch('/api/goprocure-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+((await supabase.auth.getSession()).data.session?.access_token||'')},body:JSON.stringify({message,conversation})});const raw=await response.text();let json;try{json=JSON.parse(raw)}catch{throw Error('Unable to read AI response');}if(!response.ok)throw Error(json.error||'AI response failed');return json.reply||json.message||json.content||'Please tell me more about the procurement requirement.';}
async function submitMessage(message){if(busy)return;await initAuth();if(!user){location.href='login.html';return;}const text=String(message||'').trim();if(!text)return;busy=true;input.value='';input.disabled=true;send.disabled=true;append('user',text);conversation.push({role:'user',content:text});try{await saveConversation()}catch(e){saveError=true;saveNotice('Not saved: '+e.message+' Use Confirm & submit to retry.',true);console.error('Request save failed:',e);}status('Understanding your requirement...');try{const reply=await askAI(text);statusOff();append('assistant',reply);conversation.push({role:'assistant',content:reply});try{await saveConversation()}catch(e){saveError=true;saveNotice('Could not save the latest conversation: '+e.message+' Use Confirm & submit to retry.',true);console.error('Reply save failed:',e);}}catch(e){statusOff();append('assistant','AI service could not respond: '+(e?.message||'Unknown service error')+' Please try again. Your request can still be saved and submitted.');saveNotice('AI response unavailable. Your typed requirement remains available for confirmation.',true);console.error('GoProcures text AI request failed',e);}finally{busy=false;updateAuth();if(user)input.focus();}}
if(send)send.addEventListener('click',()=>submitMessage(input.value));if(input)input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitMessage(input.value)}});$$('.js-example').forEach(b=>b.addEventListener('click',()=>{if(input&&!input.disabled){input.value=b.dataset.example||'';input.focus();}}));
const toggle=$('#mobileToggle'),mobile=$('#mobileMenu');if(toggle&&mobile){function close(){mobile.classList.remove('open');toggle.setAttribute('aria-expanded','false')}toggle.addEventListener('click',()=>{const opened=mobile.classList.toggle('open');toggle.setAttribute('aria-expanded',String(opened))});$$('a,button',mobile).forEach(a=>a.addEventListener('click',close));}
$$('.auth-signout-link').forEach(b=>b.addEventListener('click',async()=>{await initAuth();if(supabase)await supabase.auth.signOut();location.href='login.html'}));$('#newChat')?.addEventListener('click',()=>{if(busy)return;if(saveError&&!window.confirm('This conversation has unsaved work. Start a new chat?'))return;conversation=[];activeRequestId=null;requestStore=null;saveError=false;confirmedRequestId=null;const confirm=$('#confirmTextRequest');if(confirm)confirm.textContent='Confirm & submit request';$('#aiConversation').replaceChildren();$('#attachmentList')?.replaceChildren();saveNotice('');updateAuth();input?.focus();});
/* Approved reviews only; use supplied ratings without manufacturing missing data. */
let reviews=[];
const track=$('#reviewTrack');
function showReviews(){
 if(!track)return;
 track.replaceChildren();
 if(!reviews.length){const p=document.createElement('p');p.className='review-empty';p.textContent='Verified customer testimonials will appear here.';track.append(p);return;}
 reviews.forEach(r=>{
   const card=document.createElement('article');card.className='review-card';
   if(Number.isInteger(Number(r.rating))&&Number(r.rating)>=1&&Number(r.rating)<=5){const stars=document.createElement('div');stars.className='stars';stars.textContent='★'.repeat(Number(r.rating));card.append(stars);}
   const quote=document.createElement('p');quote.textContent='“'+r.message+'”';card.append(quote);
   if(r.name){const name=document.createElement('strong');name.textContent=r.name;card.append(name);}
   if(r.company){const company=document.createElement('small');company.textContent=r.company;card.append(company);}
   track.append(card);
 });
}
async function loadReviews(){
 try{
  const res=await fetch(GP.url+'/rest/v1/testimonials?select=name,company,message,rating&approved=eq.true&order=created_at.desc&limit=30',{headers:{apikey:GP.key}});
  if(!res.ok)throw Error('Reviews unavailable');
  const result=await res.json();
  reviews=Array.isArray(result)?result.filter(r=>typeof r.message==='string'&&r.message.trim()):[];
  showReviews();
 }catch(e){console.warn('Reviews unavailable',e);}
}
/* Parallax is decorative only and respects reduced-motion settings. */
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){const art=$('.hero-art');let ticking=false;window.addEventListener('scroll',()=>{if(!art||ticking)return;ticking=true;requestAnimationFrame(()=>{const y=Math.min(110,scrollY*.14);art.style.setProperty('--scrollY',y+'px');ticking=false;});},{passive:true});}
const params=new URLSearchParams(location.search);const initial=params.get('request');if(initial&&input){initAuth().then(()=>{if(user){input.value=initial;$('#assistant')?.scrollIntoView({behavior:'smooth'});}});}initAuth();loadReviews();

$('#confirmTextRequest')?.addEventListener('click',async()=>{
  if(busy || confirmedRequestId!==null || !conversation.some(m=>m.role==='user'))return;
  busy=true;const button=$('#confirmTextRequest');if(button)button.textContent='Submitting request…';updateAuth();
  saveNotice('Confirming your procurement request…');
  try{
    await saveConversation(true);
    const id=Number(activeRequestId);
    if(!Number.isSafeInteger(id)||id<1)throw new Error('Could not verify saved request number.');
    confirmedRequestId=id;
    if(button)button.textContent='✓ GP-'+id+' confirmed';
    saveNotice('Your request GP-'+id+' was confirmed. Opening your dashboard…');
    window.setTimeout(()=>window.location.assign('dashboard.html?submitted='+encodeURIComponent(id)),850);
  }catch(e){
    saveError=true;
    if(button)button.textContent='Confirm & submit request';
    saveNotice('Request not confirmed: '+e.message+' Please retry.',true);
  }finally{busy=false;updateAuth();}
});
$('#aiFiles')?.addEventListener('change',async e=>{await initAuth();if(!user)return;const files=Array.from(e.target.files||[]);if(!files.length)return;if(!conversation.some(m=>m.role==='user')){saveNotice('Describe your requirement before attaching files.',true);e.target.value='';return;}busy=true;updateAuth();try{const store=await storeForUser();for(const file of files){saveNotice('Uploading '+file.name+' privately…');const item=await store.attach(file,conversation);const row=document.createElement('li');row.textContent=item.name+' — attached privately';$('#attachmentList').append(row);}saveNotice('Files attached to your dashboard request for the procurement team.');}catch(err){saveNotice('Attachment failed: '+err.message,true);}finally{busy=false;e.target.value='';updateAuth();}});
