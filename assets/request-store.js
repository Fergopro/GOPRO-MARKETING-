/* Serialised persistence shared by text and voice. Uses the signed-in user's RLS. */
export class ProcurementRequestStore {
  constructor(client,user,channel){this.client=client;this.user=user;this.channel=channel;this.id=null;this.queue=Promise.resolve();}
  save(messages,{confirmed=false}={}){
    const snapshot=messages.map(m=>({role:m.role,content:String(m.content)}));
    const run=async()=>{
      const requirement=snapshot.filter(m=>m.role==='user').map(m=>m.content).join('\n');
      if(!requirement.trim())throw new Error('Add your procurement requirements first.');
      const payload={ai_conversation:snapshot,updated_at:new Date().toISOString()};
      if(confirmed){payload.client_confirmed=true;payload.confirmed_at=new Date().toISOString();}
      if(!this.id){Object.assign(payload,{auth_user_id:this.user.id,client_name:this.user.user_metadata?.full_name||this.user.email?.split('@')[0]||'Client',client_email:this.user.email,region:'To be confirmed',request_text:requirement,status:'New',category:this.channel==='voice'?'Voice AI Procurement':'AI Procurement'});const {data,error}=await this.client.from('requests').insert(payload).select('id').single();if(error)throw error;this.id=data.id;}
      else {if(confirmed)payload.request_text=requirement;const {data,error}=await this.client.from('requests').update(payload).eq('id',this.id).eq('auth_user_id',this.user.id).select('id').single();if(error)throw error;if(!data)throw new Error('Request could not be updated.');}
      return this.id;
    };
    const pending=this.queue.then(run);this.queue=pending.catch(()=>{});return pending;
  }
  async attach(file,messages){
    if(file.size>15*1024*1024)throw new Error('Please choose files smaller than 15 MB.');
    if(!/\.(pdf|jpe?g|png|webp|xlsx?|docx?)$/i.test(file.name))throw new Error('Choose a PDF, image, Word or Excel file.');
    const id=await this.save(messages);const safe=file.name.replace(/[^a-zA-Z0-9._-]+/g,'-');const path=this.user.id+'/'+id+'/'+crypto.randomUUID()+'-'+safe;
    const bucket=this.client.storage.from('client-documents');const {error}=await bucket.upload(path,file,{upsert:false,contentType:file.type||undefined});if(error)throw error;
    const meta=await this.client.from('request_files').insert({request_id:Number(id),auth_user_id:this.user.id,bucket:'client-documents',storage_path:path,file_name:file.name,mime_type:file.type||null,file_size:file.size});
    if(meta.error){await bucket.remove([path]);throw meta.error;}return {name:file.name,path};
  }
}
