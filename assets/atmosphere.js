/* GetLayers Orb Studio — Violet Nebula, wrapped around the existing voice engine.
   Visuals receive only numeric level + state. No audio stream, identity or transcript is sent anywhere. */
import { mountAurora } from './aurora.js';
const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion:reduce)'),mobile=matchMedia('(max-width:640px)');
let paused=false;try{paused=localStorage.getItem('gp-decorative-motion')==='paused';}catch{}
let orb=null,previousState='',lastVisual={level:0,state:'idle'},disposed=false;
const motion=document.getElementById('procurementOrb'),canvas=document.getElementById('liveOrb'),toggle=document.getElementById('motionToggle');
function applyMotion(){document.body.classList.toggle('motion-paused',paused);if(toggle){toggle.setAttribute('aria-pressed',String(paused));toggle.setAttribute('aria-label',paused?'Resume decorative motion':'Pause decorative motion');toggle.textContent=paused?'▶ Motion':'Ⅱ Motion';}if(orb){if(paused)orb.pause();else orb.resume();}}
function applyVoice(detail){lastVisual=detail;if(!orb)return;const state=detail.state==='processing'?'thinking':['idle','listening','speaking','error','success'].includes(detail.state)?detail.state:'idle';if(state!==previousState){orb.setState(state);previousState=state;}orb.setAudioLevel(detail.connected?detail.level:0);if(motion)motion.dataset.voiceState=state;}
window.addEventListener('goprocures:voice-visual',event=>applyVoice(event.detail));
async function initOrb(){if(!canvas||!motion)return;try{const {createOrb,createOrbTheme}=await import('./orb-runtime.js');if(disposed)return;
 const theme=createOrbTheme({preset:'nebula-violet-01',id:'goprocures-violet-nebula',seed:1,colors:{base:'#1c0a2b',interior:'#08040d',accents:['#a24dff','#61b7ff','#a8a3ff']},appearance:{intensity:.85,detail:.7,glow:.8,glass:.28},motion:{speed:.7,drift:.75},audioResponse:{brightness:1.2,motion:.55,pulse:.85}});
 const m=theme.ambientMotion;motion.dataset.ambientMotion=String(m.enabled);motion.style.setProperty('--orb-motion-distance',-m.verticalTravel+'px');motion.style.setProperty('--orb-motion-scale',String(m.scale));motion.style.setProperty('--orb-motion-duration',m.durationSeconds+'s');motion.style.setProperty('--orb-motion-delay',m.delaySeconds+'s');
 orb=createOrb(canvas,{theme,quality:mobile.matches?'low':'balanced',state:'idle',reducedMotion:'user',onError:()=>motion.classList.add('orb-no-webgl')});motion.classList.remove('orb-no-webgl');motion.dataset.renderer='webgl';applyVoice(lastVisual);applyMotion();
 }catch{motion.classList.add('orb-no-webgl');motion.dataset.renderer='fallback';}}
const stopAurora=mountAurora(document.getElementById('auroraCanvas'),{isPaused:()=>paused});
initOrb();applyMotion();toggle?.addEventListener('click',()=>{paused=!paused;try{localStorage.setItem('gp-decorative-motion',paused?'paused':'running');}catch{}applyMotion();});
root.classList.add('motion-ready');
const reveal=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealed');reveal.unobserve(e.target);}}),{threshold:.1});document.querySelectorAll('.review-heading,.how h2,.how-grid article').forEach((element,i)=>{element.dataset.reveal='';element.style.transitionDelay=(i%4)*65+'ms';reveal.observe(element);});
// Small ambient globe: decorative global reach, with no fabricated live data.
const globe=document.getElementById('globalGlobe'),ctx=globe?.getContext('2d');let globeFrame=0,globeLast=0,angle=.4,globeVisible=true;
const points=Array.from({length:230},(_,i)=>{const y=1-2*(i+.5)/230,r=Math.sqrt(1-y*y),a=i*2.399963;return [Math.cos(a)*r,y,Math.sin(a)*r];});
function drawGlobe(){if(!ctx)return;ctx.clearRect(0,0,90,90);const glow=ctx.createRadialGradient(30,25,0,45,45,43);glow.addColorStop(0,'#667dff18');glow.addColorStop(1,'#13203e00');ctx.fillStyle=glow;ctx.fillRect(0,0,90,90);ctx.strokeStyle='#96adf328';ctx.lineWidth=.7;ctx.beginPath();ctx.arc(45,45,36,0,Math.PI*2);ctx.stroke();for(const [x,y,z]of points){const xr=x*Math.cos(angle)-z*Math.sin(angle),zr=x*Math.sin(angle)+z*Math.cos(angle);if(zr<-.15)continue;ctx.fillStyle='rgba(145,187,255,'+(.16+Math.max(0,zr)*.7)+')';ctx.beginPath();ctx.arc(45+xr*35,45+y*35,.45+Math.max(0,zr)*.45,0,Math.PI*2);ctx.fill();}}
function globeLoop(now){globeFrame=requestAnimationFrame(globeLoop);if(!globeVisible||document.hidden||paused||reduced.matches)return;if(now-globeLast<65)return;angle+=.005;globeLast=now;drawGlobe();}if(globe){drawGlobe();const io=new IntersectionObserver(([e])=>globeVisible=e.isIntersecting);io.observe(globe);globeFrame=requestAnimationFrame(globeLoop);window.addEventListener('pagehide',()=>io.disconnect(),{once:true});}
window.addEventListener('pagehide',()=>{disposed=true;orb?.destroy();stopAurora();reveal.disconnect();cancelAnimationFrame(globeFrame);},{once:true});
