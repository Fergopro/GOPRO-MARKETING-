const GP_URL='https://oulckllygepbqbctzeka.supabase.co';
const GP_KEY='sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI';
let pending;
export function getProcurementClient(){return pending ||= import('./vendor/supabase.js').then(({createClient})=>createClient(GP_URL,GP_KEY));}
