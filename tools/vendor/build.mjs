import { build } from 'esbuild';
const common={bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022'};
if(!process.argv.includes('--motion-only'))await build({...common,entryPoints:[new URL('./entry.js',import.meta.url).pathname],outfile:new URL('../../assets/vendor/supabase.js',import.meta.url).pathname});
await build({...common,entryPoints:[new URL('./motion.js',import.meta.url).pathname],outfile:new URL('../../assets/orb-runtime.js',import.meta.url).pathname});
