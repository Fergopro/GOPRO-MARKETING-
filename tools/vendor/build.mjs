import { build } from 'esbuild';
await build({entryPoints:[new URL('./entry.js',import.meta.url).pathname],outfile:new URL('../../assets/vendor/supabase.js',import.meta.url).pathname,bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022'});
