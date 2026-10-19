var W=Object.freeze({absoluteGateDb:-55,initialNoiseFloorDb:-60,minimumNoiseFloorDb:-96,maximumNoiseFloorDb:-24,openMarginDb:11,closeMarginDb:8,hangoverSeconds:.2,noiseWindowSeconds:6,stableNoiseWindowSeconds:.6,stableNoiseMinimumSeconds:.3,stableNoiseDeviationDb:1.25,stableNoiseCeilingDb:-28,noiseRiseSeconds:3,stableNoiseRiseSeconds:.35,activeNoiseRiseSeconds:12,noiseFallSeconds:.12,referenceWindowSeconds:4,initialSpeechReferenceDb:-22,minimumSpeechReferenceDb:-32,maximumSpeechReferenceDb:-12,minimumSpeechRangeDb:12,louderReferenceSeconds:.65,quieterReferenceSeconds:1.4,referencePercentile:.95,outputGamma:1.6,warmupSeconds:0}),me=["absoluteGateDb","initialNoiseFloorDb","minimumNoiseFloorDb","maximumNoiseFloorDb","stableNoiseCeilingDb","initialSpeechReferenceDb","minimumSpeechReferenceDb","maximumSpeechReferenceDb"],pe=["noiseWindowSeconds","stableNoiseWindowSeconds","noiseRiseSeconds","stableNoiseRiseSeconds","activeNoiseRiseSeconds","noiseFallSeconds","referenceWindowSeconds","minimumSpeechRangeDb","louderReferenceSeconds","quieterReferenceSeconds","outputGamma"],fe=["openMarginDb","closeMarginDb","hangoverSeconds","stableNoiseMinimumSeconds","stableNoiseDeviationDb","warmupSeconds"];function b(t,e,i){return Math.min(i,Math.max(e,t))}function Q(t,e,i,r){return i>0?t+(e-t)*(1-Math.exp(-i/r)):t}function Y(t,e){if(t.length===0)return Number.NaN;let i=[...t].sort((n,l)=>n-l),r=(i.length-1)*b(e,0,1),o=Math.floor(r),a=Math.ceil(r),s=r-o;return i[o]*(1-s)+i[a]*s}function be(t){if(t.length<2)return Number.POSITIVE_INFINITY;let e=t.reduce((r,o)=>r+o,0)/t.length,i=t.reduce((r,o)=>{let a=o-e;return r+a*a},0)/t.length;return Math.sqrt(i)}function R(t,e,i,r,o=!0){let a=t[e],s=o?a>=i:a>i;if(!Number.isFinite(a)||!s||a>r){let n=o?"between":"greater than",l=o?` and ${r}`:` and no more than ${r}`;throw new RangeError(`${e} must be ${n} ${i}${l}.`)}}function ge(t){if(!t||typeof t!="object"||Array.isArray(t))throw new TypeError("Audio calibration options must be an object.");for(let i of Object.keys(t))if(!Object.hasOwn(W,i))throw new TypeError(`${i} is not a supported audio calibration option.`);let e={...W,...t};for(let i of me)R(e,i,-120,0);for(let i of pe)R(e,i,0,120,!1);for(let i of fe)R(e,i,0,120);if(R(e,"referencePercentile",0,1),e.minimumNoiseFloorDb>e.initialNoiseFloorDb||e.initialNoiseFloorDb>e.maximumNoiseFloorDb)throw new RangeError("initialNoiseFloorDb must be between the minimum and maximum noise floor.");if(e.minimumSpeechReferenceDb>e.initialSpeechReferenceDb||e.initialSpeechReferenceDb>e.maximumSpeechReferenceDb)throw new RangeError("initialSpeechReferenceDb must be between the minimum and maximum speech reference.");if(e.closeMarginDb>e.openMarginDb)throw new RangeError("closeMarginDb must not exceed openMarginDb.");if(e.stableNoiseMinimumSeconds>e.stableNoiseWindowSeconds)throw new RangeError("stableNoiseMinimumSeconds must not exceed stableNoiseWindowSeconds.");return Object.freeze(e)}function ve(t){if(!t?.length)return-120;let e=0;for(let o=0;o<t.length;o+=1)e+=t[o];e/=t.length;let i=0;for(let o=0;o<t.length;o+=1){let a=t[o]-e;i+=a*a}let r=Math.sqrt(i/t.length);return b(20*Math.log10(Math.max(r,1e-6)),-120,0)}var E=class{constructor(e={}){this.options=ge(e),this.reset()}reset(){let{initialNoiseFloorDb:e,initialSpeechReferenceDb:i}=this.options;this.time=0,this.lastTimestamp=null,this.noiseFloorDb=e,this.speechReferenceDb=i,this.active=!1,this.belowGateSeconds=0,this.noiseLevels=[],this.speechLevels=[],this.last=Object.freeze({level:0,levelDb:-120,noiseFloorDb:this.noiseFloorDb,gateOpenDb:this.options.absoluteGateDb,gateCloseDb:this.options.absoluteGateDb,speechReferenceDb:this.speechReferenceDb,active:!1,stableNoise:!1,warmingUp:this.options.warmupSeconds>0})}process(e,i){return this.processDb(ve(e),i)}processDb(e,i){let r=Number(i),o=Number.isFinite(r),a=1/60;o&&this.lastTimestamp!==null&&(a=b(r-this.lastTimestamp,1/240,.1)),o&&(this.lastTimestamp=r),this.time+=a;let s=Number(e),n=b(Number.isFinite(s)?s:-120,-120,0);this.noiseLevels.push({time:this.time,value:n});let l=this.time-this.options.noiseWindowSeconds;for(;this.noiseLevels[0]?.time<l;)this.noiseLevels.shift();let h=this.time-this.options.stableNoiseWindowSeconds,u=this.noiseLevels.filter(f=>f.time>=h),v=u.map(f=>f.value),m=(u.length>1?u.at(-1).time-u[0].time:0)>=this.options.stableNoiseMinimumSeconds&&n<=this.options.stableNoiseCeilingDb&&be(v)<=this.options.stableNoiseDeviationDb,y=b(Y(this.noiseLevels.map(f=>f.value),.2),this.options.minimumNoiseFloorDb,this.options.maximumNoiseFloorDb),D=y<this.noiseFloorDb?this.options.noiseFallSeconds:m?this.options.stableNoiseRiseSeconds:this.active?this.options.activeNoiseRiseSeconds:this.options.noiseRiseSeconds;this.noiseFloorDb=Q(this.noiseFloorDb,y,a,D);let p=Math.max(this.options.absoluteGateDb,this.noiseFloorDb+this.options.openMarginDb),w=Math.max(this.options.absoluteGateDb-3,this.noiseFloorDb+this.options.closeMarginDb);this.active?n>=w?this.belowGateSeconds=0:(this.belowGateSeconds+=a,this.belowGateSeconds>=this.options.hangoverSeconds&&(this.active=!1,this.belowGateSeconds=0)):n>=p&&(this.active=!0,this.belowGateSeconds=0),this.active&&!m&&n>=p&&this.speechLevels.push({time:this.time,value:n});let ce=this.time-this.options.referenceWindowSeconds;for(;this.speechLevels[0]?.time<ce;)this.speechLevels.shift();if(this.speechLevels.length>=12){let f=Math.min(this.options.maximumSpeechReferenceDb,Math.max(this.options.minimumSpeechReferenceDb,p+this.options.minimumSpeechRangeDb)),$=b(Y(this.speechLevels.map(de=>de.value),this.options.referencePercentile),f,this.options.maximumSpeechReferenceDb),ue=$>this.speechReferenceDb?this.options.louderReferenceSeconds:this.options.quieterReferenceSeconds;this.speechReferenceDb=Q(this.speechReferenceDb,$,a,ue)}let le=Math.max(this.options.minimumSpeechRangeDb,this.speechReferenceDb-p),he=b((n-p)/le,0,1),_=this.time<this.options.warmupSeconds,U=this.active&&!m&&!_?Math.pow(he,this.options.outputGamma):0;return this.last=Object.freeze({level:U,levelDb:n,noiseFloorDb:this.noiseFloorDb,gateOpenDb:p,gateCloseDb:w,speechReferenceDb:this.speechReferenceDb,active:this.active,stableNoise:m,warmingUp:_}),U}};var M=new WeakMap;function ye(t){return typeof AnalyserNode<"u"&&t instanceof AnalyserNode}function Se(t){try{if(t.crossOrigin==="anonymous"||t.crossOrigin==="use-credentials")return!0;let e=t.currentSrc||t.src;return e?new URL(e,location.href).origin===location.origin:!1}catch{return!1}}function B(t,e,i){let r=new Float32Array(t.fftSize),o=typeof t.getFloatTimeDomainData=="function"?null:new Uint8Array(t.fftSize),a=new E(i),s=0,n=()=>{if(s=requestAnimationFrame(n),o){t.getByteTimeDomainData(o);for(let l=0;l<r.length;l+=1)r[l]=(o[l]-128)/128}else t.getFloatTimeDomainData(r);e(a.process(r,performance.now()/1e3))};return s=requestAnimationFrame(n),()=>{cancelAnimationFrame(s),e(0)}}function X(t,e,i={}){if(typeof e!="function")throw new TypeError("setLevel must be a function");let{calibration:r}=i;if(ye(t))return B(t,e,r);if(!(t instanceof HTMLMediaElement))throw new TypeError("Expected an HTMLMediaElement or AnalyserNode");if(!Se(t))throw new Error("Cross-origin media requires a compatible CORS response before it can drive the orb.");let o=M.get(t);if(!o){let a=new AudioContext,s=a.createMediaElementSource(t),n=a.createBiquadFilter(),l=a.createAnalyser(),h=a.createGain();n.type="highpass",n.frequency.value=80,n.Q.value=.707,l.fftSize=1024,l.smoothingTimeConstant=0,h.gain.value=0,s.connect(a.destination),s.connect(n),n.connect(l),l.connect(h),h.connect(a.destination),o={analyser:l,analysisMonitor:h,context:a,highPass:n,mediaSource:s},M.set(t,o)}return o.context.resume(),B(o.analyser,e,r)}async function K(t,e={}){if(typeof t!="function")throw new TypeError("setLevel must be a function");if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone capture is unavailable in this browser.");let i=e.constraints??{audio:{echoCancellation:{ideal:!0},noiseSuppression:{ideal:!0},autoGainControl:{ideal:!1},channelCount:{ideal:1}}},r=await navigator.mediaDevices.getUserMedia(i),o=new AudioContext,a=o.createMediaStreamSource(r),s=o.createBiquadFilter(),n=o.createAnalyser(),l=o.createGain();s.type="highpass",s.frequency.value=80,s.Q.value=.707,n.fftSize=1024,n.smoothingTimeConstant=0,l.gain.value=0,a.connect(s),s.connect(n),n.connect(l),l.connect(o.destination),await o.resume();let h=B(n,t,{warmupSeconds:.35,...e.calibration});return()=>{h(),a.disconnect(),s.disconnect(),n.disconnect(),l.disconnect(),r.getTracks().forEach(u=>u.stop()),o.close()}}function Z(t){let e=M.get(t);e&&(M.delete(t),e.mediaSource.disconnect(),e.highPass.disconnect(),e.analyser.disconnect(),e.analysisMonitor.disconnect(),e.context.close())}function J(t){return{phase:t,audioSmooth:0,audioFast:0,spinDir:1,spinVel:0,prevA:0,flipQueued:!1,oscSign:1,spin:t*3.7,lastT:null}}function ee(t,e,i,r=void 0){let o=t.lastT===null?0:Math.min(.1,Math.max(0,e-t.lastT));t.lastT=e;let a=Math.min(1,Math.max(0,i)),s=Math.min(2,Math.max(0,r?.speed??1)),n=Math.min(2,Math.max(0,r?.drift??1)),l=a>t.audioSmooth?.11:.3;t.audioSmooth+=(a-t.audioSmooth)*(o>0?1-Math.exp(-o/l):0);let h=a>t.audioFast?.04:.18;t.audioFast+=(a-t.audioFast)*(o>0?1-Math.exp(-o/h):0);let u=6.31*t.phase%1,v=n*.35*Math.sin(e*(.11+.08*(2.17*t.phase%1))+t.phase),C=Math.sin(e*(.45+.2*u)+t.phase);Math.sign(C)!==t.oscSign&&(t.oscSign=Math.sign(C),t.flipQueued=!0),t.flipQueued&&t.audioFast<.18&&(t.spinDir=-t.spinDir,t.flipQueued=!1);let m=s*(.65*(.65+.7*u)*(1+v)+t.spinDir*t.audioFast*2.2);t.spinVel+=(m-t.spinVel)*(o>0?1-Math.exp(-o/.35):0);let y=Math.max(0,t.audioFast-t.prevA);return t.prevA=t.audioFast,t.spinVel+=t.spinDir*Math.min(6*y,1.4)*o*14*s,t.spin+=t.spinVel*o,t}var Ce=Object.freeze({spiral:0,nebula:1,core:2,"deep-field":3}),Fe=Object.freeze({enabled:!1,verticalTravel:0,scale:1,durationSeconds:0,delaySeconds:0}),z=Object.freeze({enabled:!0,verticalTravel:8,scale:1,durationSeconds:7,delaySeconds:0}),Ae=Object.freeze({detail:1,glow:1,intensity:1}),xe=Object.freeze({drift:1,speed:1}),De=Object.freeze({brightness:1,motion:1,pulse:1}),we=Object.freeze([0,0,0]);function c({accentColors:t,ambientMotion:e=Fe,archetype:i,baseColor:r,lensStrength:o,phase:a,referenceDiameter:s=264}){return Object.freeze({accentColors:Object.freeze([...t]),ambientMotion:Object.freeze({...e}),archetype:i,baseColor:r,lensStrength:o??(s>=48?.4:0),phase:a,referenceDiameter:s})}var T="core-teal-01",Ve=Object.freeze(["core","spiral","nebula","deep-field"]),g=Object.freeze({"core-teal-01":c({archetype:"core",phase:4.6,baseColor:"#07262B",accentColors:["#00C2A8","#38E1FF","#FFC65C"],referenceDiameter:264,ambientMotion:{...z,verticalTravel:10}}),"spiral-pink-01":c({archetype:"spiral",phase:6.05,baseColor:"#2A0F22",accentColors:["#FF7ECB","#D14FFF","#FFDCF2"],referenceDiameter:244,ambientMotion:{enabled:!0,verticalTravel:5,scale:1.03,durationSeconds:6.5,delaySeconds:0}}),"nebula-pink-01":c({archetype:"nebula",phase:4.083,baseColor:"#241627",accentColors:["#FFC9E0","#E4A8FF","#FFE9F4"],referenceDiameter:186,ambientMotion:{enabled:!0,verticalTravel:5,scale:1.03,durationSeconds:7.8,delaySeconds:.4}}),"spiral-cyan-01":c({archetype:"spiral",phase:1.285,baseColor:"#0A1B2E",accentColors:["#38BDF8","#0E7BD1","#CFF2FF"],referenceDiameter:150,ambientMotion:{enabled:!0,verticalTravel:5,scale:1.03,durationSeconds:9.1,delaySeconds:.8}}),"spiral-cyan-02":c({archetype:"spiral",phase:2.502,baseColor:"#101B2E",accentColors:["#7DBED4","#6E8BFF","#A24DFF"],referenceDiameter:208,ambientMotion:{...z,verticalTravel:9}}),"nebula-violet-01":c({archetype:"nebula",phase:1.995,baseColor:"#1C0A2B",accentColors:["#A24DFF","#FF4DD8","#6E8BFF"],referenceDiameter:260,ambientMotion:{...z,verticalTravel:9}}),"core-blue-01":c({archetype:"core",phase:5.016,baseColor:"#131A2E",accentColors:["#2563EB","#FF2D87","#FFD086"],referenceDiameter:42,lensStrength:0}),"spiral-orange-01":c({archetype:"spiral",phase:2.289,baseColor:"#5C4030",accentColors:["#D86A3D","#FFB873","#FFE3C2"],referenceDiameter:42,lensStrength:0}),"nebula-cyan-01":c({archetype:"nebula",phase:.432,baseColor:"#2E4250",accentColors:["#7DBED4","#C5A8E8","#F4F4F8"],referenceDiameter:42,lensStrength:0}),"core-cyan-01":c({archetype:"core",phase:1.573,baseColor:"#0A2438",accentColors:["#3DA5D9","#5FC9D8","#A6E5E5"],referenceDiameter:42,lensStrength:0}),"core-lime-01":c({archetype:"core",phase:1.542,baseColor:"#1A3A20",accentColors:["#7BAE48","#A8B85C","#F4E4A8"],referenceDiameter:42,lensStrength:0}),"nebula-orange-01":c({archetype:"nebula",phase:.108,baseColor:"#301608",accentColors:["#FFB25C","#FF7E45","#FFE9CE"]}),"core-blue-02":c({archetype:"core",phase:4.401,baseColor:"#0E1A34",accentColors:["#5C8DFF","#3452D9","#DCE8FF"]}),"deep-field-cyan-01":c({archetype:"deep-field",phase:5.402,baseColor:"#0F2024",accentColors:["#5FB7C4","#33808F","#DDF4F7"]}),"deep-field-green-01":c({archetype:"deep-field",phase:1.89,baseColor:"#0C2414",accentColors:["#57D98A","#2FA05C","#DFFBE9"]}),"core-red-01":c({archetype:"core",phase:1.577,baseColor:"#2A0A10",accentColors:["#FF3B4E","#B01C3A","#FF9860"]}),"core-orange-01":c({archetype:"core",phase:.287,baseColor:"#301004",accentColors:["#FF7A18","#FFB340","#FF4E2A"]}),"deep-field-blue-01":c({archetype:"deep-field",phase:2.619,baseColor:"#0E1230",accentColors:["#8FA8FF","#5B6CFF","#E8ECFF"]}),"nebula-blue-01":c({archetype:"nebula",phase:.484,baseColor:"#1B1E33",accentColors:["#C7CFFF","#9FB4E8","#F2F4FF"]}),"spiral-violet-01":c({archetype:"spiral",phase:5.961,baseColor:"#221434",accentColors:["#C084FC","#F0A6FF","#FFD1EC"]}),"deep-field-yellow-01":c({archetype:"deep-field",phase:2.497,baseColor:"#171310",accentColors:["#E8C98A","#B08A50","#FFF2D8"]}),"core-yellow-01":c({archetype:"core",phase:.224,baseColor:"#2E1E04",accentColors:["#FFD54A","#FFB300","#FFF3B0"]}),"core-orange-02":c({archetype:"core",phase:4.701,baseColor:"#2E1408",accentColors:["#FF8A4C","#FFC24B","#FF5E62"]}),"deep-field-teal-01":c({archetype:"deep-field",phase:1.778,baseColor:"#0A2220",accentColors:["#63D8C2","#2E9E8C","#DFFCF4"]}),"spiral-cyan-03":c({archetype:"spiral",phase:3.465,baseColor:"#101632",accentColors:["#4CC9F0","#7B5CFF","#B8F1FF"]}),"spiral-blue-01":c({archetype:"spiral",phase:1.258,baseColor:"#141B26",accentColors:["#7FA6C9","#4A7196","#DCE8F2"]}),"spiral-cyan-04":c({archetype:"spiral",phase:.825,baseColor:"#0E2030",accentColors:["#4FC3F7","#8BE38B","#E1F7FF"]}),"nebula-red-01":c({archetype:"nebula",phase:1.692,baseColor:"#2A1418",accentColors:["#FF9DA0","#FFC6A8","#FFE8E0"]}),"deep-field-orange-01":c({archetype:"deep-field",phase:2.167,baseColor:"#221408",accentColors:["#D9A05B","#A0693A","#FFE0B8"]}),"core-lime-02":c({archetype:"core",phase:3.431,baseColor:"#12240E",accentColors:["#9BE84C","#3ED598","#EAFFC9"]}),"nebula-yellow-01":c({archetype:"nebula",phase:1.461,baseColor:"#26200C",accentColors:["#FFE08A","#F4C14F","#FFF8E0"]}),"spiral-orange-02":c({archetype:"spiral",phase:1.878,baseColor:"#26160C",accentColors:["#E88B4E","#C9653A","#F7D9B8"]}),"nebula-orange-02":c({archetype:"nebula",phase:.365,baseColor:"#251106",accentColors:["#FFAD33","#E86A2C","#FFE2A8"]}),"deep-field-blue-02":c({archetype:"deep-field",phase:.757,baseColor:"#14161C",accentColors:["#9AA6B8","#5E6B80","#E6ECF5"]}),"nebula-violet-02":c({archetype:"nebula",phase:3.978,baseColor:"#1A1430",accentColors:["#A78BFA","#F0ABFC","#E0E7FF"]}),"deep-field-teal-02":c({archetype:"deep-field",phase:6.142,baseColor:"#0F1F24",accentColors:["#5EEAD4","#99F6E4","#E0F2FE"]})}),qe=Object.freeze(Object.keys(g).sort());function te(t){return Object.freeze([Number.parseInt(t.slice(1,3),16)/255,Number.parseInt(t.slice(3,5),16)/255,Number.parseInt(t.slice(5,7),16)/255])}function S(t=T){let e=Object.hasOwn(g,t)?t:T,i=g[e];return Object.freeze({id:e,phase:i.phase,archetype:i.archetype,archetypeIndex:Ce[i.archetype],interiorColor:we,baseColor:te(i.baseColor),accentColors:Object.freeze(i.accentColors.map(te)),lensStrength:i.lensStrength,appearance:Ae,motion:xe,audioResponse:De,ambientMotion:i.ambientMotion,referenceDiameter:i.referenceDiameter,renderProfile:i.lensStrength>0?"layered":"compact"})}var N=Math.PI*2,Re=/^#[0-9a-f]{6}$/i,Ee=/^[a-z][a-z0-9-]{0,63}$/,Me=Object.freeze({detail:1,glow:1,intensity:1}),Te=Object.freeze({drift:1,speed:1}),Oe=Object.freeze({brightness:1,motion:1,pulse:1}),Pe=Object.freeze({appearance:Me,audioResponse:Oe,motion:Te}),H=Object.freeze(["idle","listening","thinking","speaking","success","error"]),G=Object.freeze({low:Object.freeze({frameRate:30,maxPixelRatio:1,maxResolution:512}),balanced:Object.freeze({frameRate:45,maxPixelRatio:1.5,maxResolution:896}),high:Object.freeze({frameRate:60,maxPixelRatio:2,maxResolution:1280})});function F(t,e){if(t===void 0)return{};if(!t||typeof t!="object"||Array.isArray(t))throw new TypeError(`${e} must be an object.`);return t}function A(t,e,i){for(let r of Object.keys(t))if(!e.includes(r))throw new TypeError(`${i}.${r} is not a supported option.`)}function d(t,e,i,r,o){if(t===void 0)return e;let a=Number(t);if(!Number.isFinite(a)||a<i||a>r)throw new RangeError(`${o} must be between ${i} and ${r}.`);return a}function L(t,e,i){if(t===void 0)return e;if(typeof t!="string"||!Re.test(t))throw new TypeError(`${i} must use the #RRGGBB format.`);return t.toUpperCase()}function I(t){return Object.freeze([Number.parseInt(t.slice(1,3),16)/255,Number.parseInt(t.slice(3,5),16)/255,Number.parseInt(t.slice(5,7),16)/255])}function Be(t,e){if(t===void 0)return e;let i=Number(t);if(!Number.isFinite(i))throw new TypeError("seed must be a finite number.");return(i%N+N)%N}function k(t){return Object.freeze({...t})}function ie(t={}){let e=F(t,"options");A(e,["appearance","audioResponse","colors","id","motion","preset","seed"],"options");let i=e.preset??T;if(typeof i!="string"||!Object.hasOwn(g,i))throw new RangeError("preset must be one of the registered orb variant IDs.");let r=S(i),o=F(e.colors,"colors"),a=F(e.appearance,"appearance"),s=F(e.motion,"motion"),n=F(e.audioResponse,"audioResponse");A(o,["accents","base","interior"],"colors"),A(a,["detail","glass","glow","intensity"],"appearance"),A(s,["drift","speed"],"motion"),A(n,["brightness","motion","pulse"],"audioResponse");let l=e.id??`${i}-custom`;if(typeof l!="string"||!Ee.test(l))throw new TypeError("id must start with a letter and contain only lowercase letters, numbers, or hyphens.");let h=L(o.base,g[i].baseColor,"colors.base"),u=L(o.interior,"#000000","colors.interior"),v=g[i].accentColors;if(o.accents!==void 0){if(!Array.isArray(o.accents)||o.accents.length!==3)throw new TypeError("colors.accents must contain exactly three #RRGGBB colors.");v=o.accents.map((p,w)=>L(p,void 0,`colors.accents[${w}]`))}let C=k({detail:d(a.detail,1,0,1,"appearance.detail"),glow:d(a.glow,1,0,2,"appearance.glow"),intensity:d(a.intensity,1,.25,2,"appearance.intensity")}),m=k({drift:d(s.drift,1,0,2,"motion.drift"),speed:d(s.speed,1,0,2,"motion.speed")}),y=k({brightness:d(n.brightness,1,0,2,"audioResponse.brightness"),motion:d(n.motion,1,0,2,"audioResponse.motion"),pulse:d(n.pulse,1,0,2,"audioResponse.pulse")}),D=d(a.glass,r.lensStrength,0,1,"appearance.glass");return Object.freeze({...r,id:l,sourceVariantId:i,phase:Be(e.seed,r.phase),interiorColor:I(u),baseColor:I(h),accentColors:Object.freeze(v.map(I)),lensStrength:D,renderProfile:D>0?"layered":"compact",appearance:C,motion:m,audioResponse:y})}function j(t="high"){if(typeof t!="string"||!Object.hasOwn(G,t))throw new RangeError("quality must be low, balanced, or high.");return G[t]}function V(t="idle"){if(!H.includes(t))throw new RangeError(`state must be one of: ${H.join(", ")}.`);return t}var oe=`
attribute vec2 aPosition;
attribute vec2 aTextureCoord;
varying vec2 vUv;

void main() {
  vUv = aTextureCoord;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`,q=`
precision highp float;

varying vec2 vUv;
uniform vec2 uResolution;
uniform vec3 uInteriorColor;
uniform vec3 uBaseColor;
uniform vec3 uAccentPrimary;
uniform vec3 uAccentSecondary;
uniform vec3 uAccentHighlight;
uniform float uTime;
uniform float uSeed;
uniform float uAudioBrightness;
uniform float uAudioPulse;
uniform float uSpin;
uniform float uArchetype;
uniform float uGlass;
uniform float uVisualIntensity;
uniform float uDetail;
uniform float uGlow;
uniform float uState;
uniform float uStateBlend;

float scalarHash(float value) {
  return fract(sin(value * 127.1) * 43758.5453);
}

vec4 sampleSky(vec3 direction, float time) {
  float longitude = atan(direction.z, direction.x);
  float latitude = asin(clamp(direction.y, -1.0, 1.0));
  float varianceA = fract(uSeed * 7.13);
  float varianceB = fract(uSeed * 3.71);
  float varianceC = fract(uSeed * 5.37);

  float type = uArchetype >= 0.0 ? uArchetype : floor(fract(uSeed * 9.73) * 4.0);
  float nebulaType = step(0.5, type) * (1.0 - step(1.5, type));
  float coreType = step(1.5, type) * (1.0 - step(2.5, type));
  float deepType = step(2.5, type);

  float planeOffset = latitude
    + (0.15 + 0.4 * varianceA) * sin(longitude * (1.0 + floor(varianceB * 2.0)) + 1.3)
    + 0.12 * sin(longitude * 3.0 + time * 0.1);
  float band = exp(-planeOffset * planeOffset * (5.0 + 10.0 * varianceC));
  band = mix(band, max(band, 0.8), nebulaType);
  band *= 1.0 - 0.85 * deepType;

  float waveA = sin(longitude * 2.0 + sin(latitude * 3.0 + time * 0.25) * 1.6 + time * 0.15);
  float waveB = sin(longitude * 5.0 - sin(latitude * 4.0 - time * 0.2) * 1.2 - time * 0.22 + 2.4);
  float cloud = pow(0.5 + 0.5 * waveA, 2.0) * (0.45 + 0.55 * pow(0.5 + 0.5 * waveB, 2.0));
  float dustLane = pow(0.5 + 0.5 * sin(longitude * 4.0 + latitude * 7.0 + sin(longitude * 2.0) * 2.0), 3.0);
  float galaxy = clamp(band * cloud * (1.0 - dustLane * (0.55 + 0.35 * varianceB)), 0.0, 1.0);

  vec3 paletteHue = mix(
    mix(uAccentPrimary, uAccentSecondary, varianceA),
    mix(uAccentSecondary, uAccentHighlight, varianceC),
    0.5 + 0.5 * sin(longitude + latitude * 2.0 - time * 0.2)
  );
  vec3 greyHue = vec3(dot(paletteHue, vec3(0.299, 0.587, 0.114)));
  paletteHue = clamp(greyHue + (paletteHue - greyHue) * 1.45, 0.0, 1.0);
  vec3 dustColor = mix(vec3(0.72, 0.78, 0.92), paletteHue, 0.45 + 0.3 * varianceA + 0.45 * nebulaType);
  vec3 color = dustColor * galaxy * (0.6 + 0.9 * nebulaType);

  float shear = sin(longitude * 13.0 + latitude * 4.0 - time * 0.35)
    * sin(longitude * 5.0 + time * 0.2);
  color += dustColor * band * cloud * max(shear, 0.0) * 0.14;

  float secondPlane = latitude - (0.35 + 0.25 * varianceB) * sin(longitude * 2.0 - 1.1) + 0.4;
  float secondArm = exp(-secondPlane * secondPlane * 7.0) * cloud;
  color += mix(dustColor, uAccentSecondary, 0.35) * secondArm * 0.2;

  vec3 ambientColor = mix(
    vec3(0.04, 0.03, 0.1),
    mix(uAccentPrimary, mix(uAccentSecondary, uAccentHighlight, varianceC), varianceA) * 0.22,
    0.75
  );
  color += ambientColor * (0.5 + 0.22 * sin(time * 0.4 + longitude)) * (0.4 + 0.6 * band);
  color += vec3(1.0, 0.88, 0.68) * pow(band, 4.0) * pow(cloud, 2.0) * 0.4;

  float coreAngle = varianceB * 6.28318;
  vec3 coreDirection = normalize(vec3(cos(coreAngle) * 0.85, 0.6 * (varianceC - 0.5), sin(coreAngle) * 0.85));
  float bulge = max(dot(direction, coreDirection), 0.0);
  color += mix(vec3(1.0, 0.85, 0.6), uAccentHighlight, 0.25)
    * (pow(bulge, 14.0) * 1.6 + pow(bulge, 4.0) * 0.5) * coreType;

  float pocketA = pow(cloud, 5.0) * band * (0.7 + 0.3 * sin(time * 0.6 + longitude * 3.0));
  color += mix(uAccentHighlight, uAccentPrimary, fract(varianceA + 0.5 * sin(longitude * 2.0) + 0.5))
    * pocketA * (0.5 + 0.4 * varianceB + 0.8 * nebulaType);
  float pocketB = pow(0.5 + 0.5 * sin(longitude * 3.0 + latitude * 4.0 - time * 0.18 + 2.0), 6.0) * band;
  color += mix(uAccentSecondary, uAccentHighlight, varianceC) * pocketB * (0.25 + 0.3 * varianceA + 0.5 * nebulaType);

  float detail = smoothstep(90.0, 200.0, uResolution.y) * uDetail;
  vec2 grainGrid = vec2(longitude, latitude) * 34.0;
  vec2 grainCell = floor(grainGrid);
  vec2 grainLocal = fract(grainGrid);
  float grainHash = scalarHash(grainCell.x * 3.7 + grainCell.y * 11.3);
  vec2 grainPoint = vec2(
    0.2 + 0.6 * scalarHash(grainHash * 91.0),
    0.2 + 0.6 * scalarHash(grainHash * 47.0)
  );
  float grainDistance = length((grainLocal - grainPoint) * vec2(cos(latitude), 1.0));
  float resolutionFactor = clamp(uResolution.y / 420.0, 0.22, 1.0);
  float grain = exp(-grainDistance * grainDistance * 700.0 * resolutionFactor)
    * step(0.3, grainHash) * (0.15 + 0.85 * band);
  color += vec3(0.88, 0.9, 1.0) * grain * 0.4 * detail;
  float coverage = clamp(galaxy * 0.7 + pow(band, 4.0) * 0.25, 0.0, 1.0);

  for (int scaleIndex = 0; scaleIndex < 3; scaleIndex++) {
    float scale = scaleIndex == 0 ? 6.0 : (scaleIndex == 1 ? 11.0 : 19.0);
    vec2 grid = vec2(longitude, latitude) * scale;
    vec2 cell = floor(grid);
    vec2 local = fract(grid);
    float hashX = scalarHash(cell.x * 13.7 + cell.y * 7.3 + float(scaleIndex) * 91.0);
    float hashY = scalarHash(cell.x * 5.1 + cell.y * 17.9 + float(scaleIndex) * 37.0);
    vec2 starPoint = vec2(0.15 + 0.7 * hashX, 0.15 + 0.7 * hashY);
    float distanceToStar = length((local - starPoint) * vec2(cos(latitude), 1.0));
    float census = (varianceB - 0.5) * 0.2 + 0.35 * nebulaType - 0.2 * coreType + 0.3 * deepType;
    float threshold = scaleIndex == 2 ? 0.3 : 0.55;
    float keep = step(threshold + census, scalarHash(hashX * 89.0 + hashY * 31.0) + band * 0.25);
    float twinkle = mix(
      0.92,
      0.6 + 0.4 * sin(time * (1.5 + 3.0 * hashX) + hashX * 40.0),
      resolutionFactor
    );
    float sizeHash = scalarHash(hashX * 53.0 + hashY * 71.0 + cell.x);
    float magnitude = 0.35 + 1.8 * sizeHash * sizeHash;
    float sharpness = (scaleIndex == 0 ? 260.0 : (scaleIndex == 1 ? 700.0 : 1600.0))
      / magnitude * resolutionFactor;
    float star = exp(-distanceToStar * distanceToStar * sharpness) * keep * twinkle;
    vec3 temperature = hashX < 0.33
      ? vec3(0.85, 0.9, 1.0)
      : (hashX < 0.66 ? vec3(1.0, 0.95, 0.85) : mix(vec3(1.0), uAccentSecondary, 0.3));
    vec3 tint = mix(vec3(1.0), temperature, 0.6);
    float brightness = (scaleIndex == 0 ? 1.7 : (scaleIndex == 1 ? 0.9 : 0.5))
      * (0.55 + 0.7 * magnitude);
    float scaleFade = mix(scaleIndex == 2 ? 0.14 : 0.45, 1.0, detail);
    color += tint * star * brightness * scaleFade;

    if (scaleIndex == 0) {
      float largeStar = smoothstep(1.2, 2.0, magnitude);
      color += tint * exp(-distanceToStar * distanceToStar * 60.0) * 0.18 * largeStar * twinkle * scaleFade;
      vec2 offset = (local - starPoint) * vec2(cos(latitude), 1.0);
      float spike = exp(-offset.x * offset.x * 1200.0) * exp(-offset.y * offset.y * 26.0)
        + exp(-offset.y * offset.y * 1200.0) * exp(-offset.x * offset.x * 26.0);
      color += tint * spike * 0.3 * largeStar * twinkle * scaleFade;
      coverage = max(coverage, spike * 0.3 * largeStar * scaleFade);
    }
    coverage = max(coverage, star * min(brightness, 1.5) * scaleFade);
  }

  float pulsarAngle = varianceA * 6.28318;
  vec3 pulsarDirection = normalize(vec3(
    sin(pulsarAngle) * 0.9,
    1.4 * (varianceB - 0.5),
    cos(pulsarAngle) * 0.9
  ));
  float pulsarAlignment = max(dot(direction, pulsarDirection), 0.0);
  float pulse = pow(0.5 + 0.5 * sin(time * (1.2 + varianceC + 1.5 * uAudioPulse) + varianceC * 6.28), 8.0);
  pulse = min(1.0, pulse + 0.6 * uAudioPulse);
  float pulsarFade = mix(0.45, 1.0, detail);
  color += vec3(0.9, 0.95, 1.0)
    * (pow(pulsarAlignment, 900.0) * (0.6 + 1.2 * pulse) + pow(pulsarAlignment, 110.0) * 0.5 * pulse)
    * pulsarFade;
  coverage = max(coverage, pow(pulsarAlignment, 900.0) * (0.5 + 0.5 * pulse) * pulsarFade);
  return vec4(min(color, vec3(1.0)), min(coverage, 1.0));
}

vec4 sampleRotatedSphere(vec3 direction, float spin, float time) {
  float roll = time * 0.13;
  float rollCos = cos(roll);
  float rollSin = sin(roll);
  direction = vec3(
    rollCos * direction.x - rollSin * direction.y,
    rollSin * direction.x + rollCos * direction.y,
    direction.z
  );
  float tilt = 0.45 + 0.35 * sin(time * 0.24);
  float tiltCos = cos(tilt);
  float tiltSin = sin(tilt);
  direction = vec3(
    direction.x,
    tiltCos * direction.y - tiltSin * direction.z,
    tiltSin * direction.y + tiltCos * direction.z
  );
  float spinCos = cos(spin);
  float spinSin = sin(spin);
  direction = vec3(
    spinCos * direction.x + spinSin * direction.z,
    direction.y,
    -spinSin * direction.x + spinCos * direction.z
  );
  return sampleSky(direction, time);
}

vec3 shadeOrb(vec2 point) {
  float radius = length(point);
#ifdef COMPACT_ORB
  if (radius > 1.0) discard;
#endif
  float clampedRadius = min(radius, 0.9995);
  float depth = sqrt(1.0 - clampedRadius * clampedRadius);
  vec3 normal = vec3(point.x, point.y, depth);
  float rim = pow(1.0 - depth, 2.4);

  vec3 refracted = refract(vec3(0.0, 0.0, -1.0), normal, 0.75);
  float backDistance = -2.0 * dot(normal, refracted);
  vec3 backDirection = normalize(normal + refracted * backDistance);

  float time = uTime * 0.8 + uSeed;
  float varianceA = fract(uSeed * 6.31);
  float varianceB = fract(uSeed * 2.17);
  float warpedTime = time
    + (0.9 + 1.3 * varianceA) * sin(time * (0.09 + 0.07 * varianceB))
    + (0.5 + 0.8 * varianceB) * sin(time * (0.21 + 0.09 * varianceA) + 2.6);
  vec4 front = sampleRotatedSphere(normal, uSpin, warpedTime);
#ifdef COMPACT_ORB
  vec4 back = vec4(0.0);
#else
  vec4 back = sampleRotatedSphere(backDirection, uSpin, warpedTime * 0.8 + 2.7);
#endif

  vec3 voidColor = mix(uBaseColor * 0.04, uBaseColor * 0.35, rim);
  vec3 color = mix(uInteriorColor, voidColor, 0.97 - 0.04 * rim);
  float frontAlpha = clamp(front.a, 0.0, 1.0);
  float backAlpha = clamp(back.a, 0.0, 1.0);
  color = mix(color, back.rgb, backAlpha * 0.16);
  color = mix(color, front.rgb, frontAlpha * 0.85);

  float auroraLongitude = atan(normal.x, normal.z);
  float speechWave = pow(
    0.5 + 0.5 * sin(auroraLongitude * 3.0 + sin(auroraLongitude * 7.0 + time * 1.1) * 0.7 + time * 0.5),
    3.0
  ) * (0.55 + 0.45 * sin(auroraLongitude * 5.0 - time * 0.65 + 1.7));
  float visibleSky = -normal.y;
  float hangingMask = smoothstep(-0.15, 0.5, visibleSky);
  float rayPattern = 0.7 + 0.3 * sin(
    auroraLongitude * 24.0 + sin(auroraLongitude * 9.0 - time * 0.8) * 2.0 + time * 1.6
  );
  float aurora = clamp(speechWave, 0.0, 1.0) * hangingMask * rayPattern * (1.0 + 2.2 * uAudioPulse);
  float auroraVariance = fract(uSeed * 2.93);
  vec3 auroraColor = mix(
    vec3(0.12, 0.95, 0.55),
    vec3(0.45, 0.35, 1.0),
    smoothstep(0.0, 0.95, visibleSky + 0.35 * speechWave)
  );
  auroraColor = mix(auroraColor, mix(uAccentPrimary, uAccentHighlight, auroraVariance), 0.15 + 0.4 * auroraVariance);
  color += auroraColor * aurora * 0.8;

  float meteorPeriod = 4.5 + 3.5 * fract(uSeed * 4.91);
  float meteorEpoch = floor(time / meteorPeriod);
  float meteorPhase = fract(time / meteorPeriod);
  vec2 meteorStart = vec2(
    -1.1 + 2.2 * scalarHash(meteorEpoch * 1.3),
    0.85 - 1.4 * scalarHash(meteorEpoch * 2.9)
  );
  vec2 meteorDirection = normalize(vec2(
    0.7 + 0.5 * scalarHash(meteorEpoch * 4.1),
    -0.35 - 0.4 * scalarHash(meteorEpoch * 5.3)
  ));
  vec2 meteorHead = meteorStart + meteorDirection * meteorPhase * 2.8;
  vec2 meteorRelative = point - meteorHead;
  float meteorAlong = dot(meteorRelative, meteorDirection);
  float meteorPerpendicular = dot(meteorRelative, vec2(-meteorDirection.y, meteorDirection.x));
  float meteorVisible = smoothstep(0.0, 0.06, meteorPhase) * smoothstep(0.5, 0.32, meteorPhase);
  float meteorTail = exp(-meteorPerpendicular * meteorPerpendicular * 1600.0)
    * exp(meteorAlong * 9.0) * step(meteorAlong, 0.0) * smoothstep(-0.5, -0.02, meteorAlong);
  float meteorGlow = exp(-dot(meteorRelative, meteorRelative) * 900.0);
  color += (vec3(1.0) * meteorGlow * 1.2 + mix(vec3(1.0), uAccentSecondary, 0.3) * meteorTail * 0.85)
    * meteorVisible;

  vec3 movingLight = normalize(vec3(
    0.85 * sin(time * 0.42),
    0.45 * sin(time * 0.26 + 1.2),
    0.5
  ));
  float diffuse = (0.62 + 0.65 * max(dot(normal, movingLight), 0.0)) * (1.0 + 0.35 * uAudioBrightness);
  color *= diffuse;
  vec3 voiceColor = mix(uAccentSecondary, vec3(1.0, 0.97, 0.9), 0.45);
  color += voiceColor * pow(1.0 - clampedRadius, 1.8) * uAudioBrightness * 0.5;
  color += (uAccentSecondary * 0.7 + vec3(0.12)) * rim * uAudioBrightness * 0.65 * uGlow;
  color += color * uAudioBrightness * 0.18 * sin(time * 14.0 + clampedRadius * 40.0 + uSeed * 7.0);
  float counterLight = max(dot(normal.xy, -movingLight.xy), 0.0) * rim;
  color += mix(uAccentPrimary, vec3(0.5, 0.6, 0.9), 0.5) * counterLight * 0.18 * uGlow;

  vec3 keyDirection = normalize(vec3(
    -0.45 + 0.3 * sin(time * 0.34),
    0.62 + 0.2 * sin(time * 0.27 + 1.7),
    0.64
  ));
  float keyStrength = 0.5 * (0.78 + 0.22 * sin(time * 0.45 + 2.2));
  color += vec3(1.0) * pow(max(dot(normal, keyDirection), 0.0), 150.0) * keyStrength * uGlow;
  vec3 sheenDirection = normalize(vec3(sin(time * 0.07) * 0.9, 0.35 + 0.3 * cos(time * 0.05), 0.7));
  color += vec3(1.0) * pow(max(dot(normal, sheenDirection), 0.0), 7.0) * 0.05 * uGlow;
  vec3 glintDirection = normalize(vec3(0.52, -0.5 + 0.12 * sin(time * 0.09), 0.69));
  color += vec3(1.0) * pow(max(dot(normal, glintDirection), 0.0), 140.0) * 0.25 * uGlow;
  color = mix(color, front.rgb, frontAlpha * rim * 0.3);
  float listeningState = step(0.5, uState) * (1.0 - step(1.5, uState));
  float thinkingState = step(1.5, uState) * (1.0 - step(2.5, uState));
  float successState = step(3.5, uState) * (1.0 - step(4.5, uState));
  float errorState = step(4.5, uState);
  float statePulse = 0.5 + 0.5 * sin(time * (1.1 + thinkingState * 0.7));
  float stateStrength = uStateBlend * (
    listeningState * 0.12
    + thinkingState * (0.08 + 0.1 * statePulse)
    + successState * 0.22
    + errorState * 0.18
  );
  vec3 stateColor = mix(uAccentPrimary, uAccentSecondary, thinkingState * statePulse);
  stateColor = mix(stateColor, uAccentHighlight, successState);
  stateColor = mix(stateColor, vec3(1.0, 0.08, 0.05), errorState);
  color += stateColor * (0.15 + 0.85 * rim) * stateStrength * uGlow;
  color *= uVisualIntensity;
  float limb = smoothstep(0.94, 1.0, clampedRadius);
  return mix(color, color * 0.85, limb * 0.4);
}

void main() {
  vec2 point = vUv * 2.0 - 1.0;
  if (length(point) > 1.0) discard;
  if (uGlass > 0.0) {
    float radius = length(point);
    float exponential = exp(2.0 * 1.7724539 * (radius - 0.9) / 0.1414214);
    float edgeFalloff = 0.5 + 0.5 * (exponential - 1.0) / (exponential + 1.0);
    if (edgeFalloff > 0.004) {
      float lensPulse = 1.0 + 0.16 * (
        0.6 * sin(uTime * 0.9 + uSeed)
        + 0.4 * sin(uTime * 1.7 + uSeed * 1.3)
      );
      float displacement = uGlass * edgeFalloff * lensPulse;
      float redShift = 1.4 * (1.0 + 0.06 * sin(uTime * 1.3 + uSeed));
      float greenShift = 1.2 * (1.0 + 0.06 * sin(uTime * 1.3 + uSeed + 2.1));
      float blueShift = 1.0 * (1.0 + 0.06 * sin(uTime * 1.3 + uSeed + 4.2));
      vec3 color = vec3(
        shadeOrb(point * (1.0 - displacement * redShift)).r,
        shadeOrb(point * (1.0 - displacement * greenShift)).g,
        shadeOrb(point * (1.0 - displacement * blueShift)).b
      );
      vec2 absolutePoint = min(abs(point), 1.0);
      float lobe = max(
        abs(absolutePoint.x * 0.766 + absolutePoint.y * 0.643),
        abs(absolutePoint.x * 0.766 - absolutePoint.y * 0.643)
      );
      float glow = 0.65 * pow(clamp((lobe - 0.0707) / 1.3435, 0.0, 1.0), 2.4) * edgeFalloff;
      glow += 1.02 * clamp(1.0 + (radius - 1.0) / 0.15, 0.0, 1.0)
        * step(radius, 1.0) * pow(lobe, 2.0);
      color += vec3(0.25) * min(glow, 1.0) * uGlow;
      gl_FragColor = vec4(color, 1.0);
      return;
    }
  }
  gl_FragColor = vec4(shadeOrb(point), 1.0);
}
`,re=q.replace("precision highp float;",`precision highp float;
#define COMPACT_ORB`);var x=1280,ze=Object.freeze({idle:0,listening:1,thinking:2,speaking:3,success:4,error:5});function Ne(){if(typeof OffscreenCanvas<"u")return new OffscreenCanvas(x,x);let t=document.createElement("canvas");return t.width=x,t.height=x,t}function ae(t,e,i){let r=t.createShader(e);if(t.shaderSource(r,i),t.compileShader(r),!t.getShaderParameter(r,t.COMPILE_STATUS)){let o=t.getShaderInfoLog(r)||"Unknown shader compile failure";throw t.deleteShader(r),new Error(o)}return r}function Le(t,e){let i=ae(t,t.VERTEX_SHADER,oe),r=ae(t,t.FRAGMENT_SHADER,e),o=t.createProgram();if(t.attachShader(o,i),t.attachShader(o,r),t.bindAttribLocation(o,0,"aPosition"),t.bindAttribLocation(o,1,"aTextureCoord"),t.linkProgram(o),t.deleteShader(i),t.deleteShader(r),!t.getProgramParameter(o,t.LINK_STATUS)){let a=t.getProgramInfoLog(o)||"Unknown shader link failure";throw t.deleteProgram(o),new Error(a)}return o}var O=class{constructor(e,{fixedTime:i=null,onError:r=()=>{},quality:o="high",state:a="idle",variant:s,timeOffset:n=4e3*Math.random()}={}){if(this.visibleCanvas=e,this.onError=r,this.variant=s??S(),this.quality=o,this.qualityProfile=j(o),this.state=V(a),this.internalCanvas=Ne(),this.visibleContext=e.getContext("2d",{alpha:!0}),this.gl=this.internalCanvas.getContext("webgl",{premultipliedAlpha:!0,alpha:!0,antialias:!1,preserveDrawingBuffer:!0}),!this.visibleContext||!this.gl)throw new Error("This browser could not create the required canvas contexts.");this.batchExtension=this.gl.getExtension("ANGLE_instanced_arrays"),this.compactPipeline=this.variant.lensStrength<=0&&!!this.batchExtension,this.program=null,this.locations=null,this.buffer=null,this.ready=!1,this.diameter=528,this.requestedDevicePixelRatio=1,this.devicePixelRatio=1,this.renderDiameter=528,this.active=!0,this.reducedMotion=!1,this.destroyed=!1,this.targetAudioLevel=0,this.stateBlend=1,this.lastStateFrameAt=null,this.motionState=J(this.variant.phase),this.timeOffset=n,this.fixedTime=Number.isFinite(i)?i:null,this.lastFrameAt=0,this.timer=0,this.frame=this.frame.bind(this),this.handleContextLost=this.handleContextLost.bind(this),this.handleContextRestored=this.handleContextRestored.bind(this),this.internalCanvas.addEventListener?.("webglcontextlost",this.handleContextLost),this.internalCanvas.addEventListener?.("webglcontextrestored",this.handleContextRestored),this.initializeGlResources(),this.visibleContext.globalCompositeOperation="copy"}initializeGlResources(){let e=this.gl,i=this.compactPipeline?re:q;this.program=Le(e,i),this.locations=this.getLocations(),this.buffer=this.createQuad(),this.gl.disable(this.gl.DEPTH_TEST),this.gl.enable(this.gl.BLEND),this.gl.blendFunc(this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA),this.gl.enable(this.gl.SCISSOR_TEST),this.gl.useProgram(this.program),this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer),this.gl.enableVertexAttribArray(this.locations.position),this.gl.vertexAttribPointer(this.locations.position,2,this.gl.FLOAT,!1,16,0),this.gl.enableVertexAttribArray(this.locations.textureCoord),this.gl.vertexAttribPointer(this.locations.textureCoord,2,this.gl.FLOAT,!1,16,8),this.visibleContext.globalCompositeOperation="copy",this.setStaticUniforms(),this.ready=!0}getLocations(){let e=this.gl,i=["uResolution","uInteriorColor","uBaseColor","uAccentPrimary","uAccentSecondary","uAccentHighlight","uTime","uSeed","uAudioBrightness","uAudioPulse","uSpin","uArchetype","uGlass","uVisualIntensity","uDetail","uGlow","uState","uStateBlend"],r={position:e.getAttribLocation(this.program,"aPosition"),textureCoord:e.getAttribLocation(this.program,"aTextureCoord")};for(let o of i)r[o]=e.getUniformLocation(this.program,o);return r}createQuad(){let e=this.gl,i=e.createBuffer();return e.bindBuffer(e.ARRAY_BUFFER,i),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,0,1,1,-1,1,1,-1,1,0,0,1,1,1,0]),e.STATIC_DRAW),i}setStaticUniforms(){let e=this.gl,i=this.variant.appearance??{detail:1,glow:1,intensity:1};e.useProgram(this.program),e.uniform3f(this.locations.uInteriorColor,...this.variant.interiorColor??[0,0,0]),e.uniform3f(this.locations.uBaseColor,...this.variant.baseColor),e.uniform3f(this.locations.uAccentPrimary,...this.variant.accentColors[0]),e.uniform3f(this.locations.uAccentSecondary,...this.variant.accentColors[1]),e.uniform3f(this.locations.uAccentHighlight,...this.variant.accentColors[2]),e.uniform1f(this.locations.uSeed,this.variant.phase),e.uniform1f(this.locations.uArchetype,this.variant.archetypeIndex),e.uniform1f(this.locations.uGlass,this.variant.lensStrength),e.uniform1f(this.locations.uVisualIntensity,i.intensity),e.uniform1f(this.locations.uDetail,i.detail),e.uniform1f(this.locations.uGlow,i.glow)}resize(e,i){this.diameter=Math.max(1,Math.round(e)),this.requestedDevicePixelRatio=Math.max(1,i||1),this.devicePixelRatio=Math.min(this.qualityProfile.maxPixelRatio,this.requestedDevicePixelRatio),this.renderDiameter=Math.min(this.qualityProfile.maxResolution,Math.max(1,Math.round(this.diameter*this.devicePixelRatio))),this.visibleCanvas.width!==this.renderDiameter&&(this.visibleCanvas.width=this.renderDiameter),this.visibleCanvas.height!==this.renderDiameter&&(this.visibleCanvas.height=this.renderDiameter),this.visibleContext.globalCompositeOperation="copy",this.render(performance.now())}setAudioLevel(e){this.targetAudioLevel=Math.min(1,Math.max(0,Number(e)||0))}setVariant(e){this.variant=e,this.motionState.phase=e.phase;let i=e.lensStrength<=0&&!!this.batchExtension;i!==this.compactPipeline?(this.buffer&&this.gl.deleteBuffer(this.buffer),this.program&&this.gl.deleteProgram(this.program),this.compactPipeline=i,this.initializeGlResources()):this.setStaticUniforms(),this.render(performance.now())}setQuality(e){this.quality=e,this.qualityProfile=j(e),this.resize(this.diameter,this.requestedDevicePixelRatio)}setState(e){this.state=V(e),this.stateBlend=this.reducedMotion?1:0,this.lastStateFrameAt=null,this.render(performance.now())}setActive(e){this.active=!!e,this.active&&this.requestFrame()}setReducedMotion(e){this.reducedMotion=!!e,this.reducedMotion&&(this.stateBlend=1),this.render(performance.now()),this.reducedMotion||this.requestFrame()}requestFrame(){this.destroyed||this.timer||!this.active||this.reducedMotion||(typeof requestAnimationFrame=="function"?this.timer=requestAnimationFrame(this.frame):this.timer=setTimeout(()=>this.frame(performance.now()),1e3/this.qualityProfile.frameRate))}frame(e){if(this.timer=0,!this.active||this.destroyed||this.reducedMotion)return;let i=e-this.lastFrameAt,r=1e3/this.qualityProfile.frameRate;if(i<r){this.requestFrame();return}this.lastFrameAt=e-i%r,this.render(e),this.requestFrame()}render(e){if(!this.ready)return!1;let i=this.gl,r=this.fixedTime??e/1e3+this.timeOffset,o=this.variant.audioResponse??{brightness:1,motion:1,pulse:1};ee(this.motionState,r,Math.min(1,this.targetAudioLevel*o.motion),this.variant.motion);let a=this.lastStateFrameAt===null?0:Math.min(.1,Math.max(0,(e-this.lastStateFrameAt)/1e3));this.lastStateFrameAt=e,this.stateBlend+=(1-this.stateBlend)*(a>0?1-Math.exp(-a/.18):0);let s=x-this.renderDiameter;return i.viewport(0,s,this.renderDiameter,this.renderDiameter),i.scissor(0,s,this.renderDiameter,this.renderDiameter),i.clearColor(0,0,0,0),i.clear(i.COLOR_BUFFER_BIT),i.useProgram(this.program),i.uniform2f(this.locations.uResolution,this.renderDiameter,this.renderDiameter),i.uniform1f(this.locations.uTime,r),i.uniform1f(this.locations.uAudioBrightness,Math.min(1,this.motionState.audioSmooth*o.brightness)),i.uniform1f(this.locations.uAudioPulse,Math.min(1,this.motionState.audioSmooth*o.pulse)),i.uniform1f(this.locations.uSpin,this.motionState.spin),i.uniform1f(this.locations.uState,ze[this.state]),i.uniform1f(this.locations.uStateBlend,this.stateBlend),i.drawArrays(i.TRIANGLE_STRIP,0,4),this.visibleContext.drawImage(this.internalCanvas,0,0,this.renderDiameter,this.renderDiameter,0,0,this.renderDiameter,this.renderDiameter),!0}start(){let e=performance.now();this.render(e),this.lastFrameAt=e,this.requestFrame()}handleContextLost(e){e.preventDefault?.(),this.ready=!1}handleContextRestored(){try{this.initializeGlResources(),this.render(performance.now()),this.requestFrame()}catch(e){this.onError(e instanceof Error?e:new Error(String(e)))}}destroy(){this.destroyed=!0,this.timer&&(typeof cancelAnimationFrame=="function"?cancelAnimationFrame(this.timer):clearTimeout(this.timer));let e=this.gl;this.internalCanvas.removeEventListener?.("webglcontextlost",this.handleContextLost),this.internalCanvas.removeEventListener?.("webglcontextrestored",this.handleContextRestored),this.buffer&&e.deleteBuffer(this.buffer),this.program&&e.deleteProgram(this.program)}};function Ie(t){if(typeof HTMLCanvasElement>"u"||!(t instanceof HTMLCanvasElement))throw new TypeError("createOrb requires an HTMLCanvasElement.");return t}function ne(t){if(t===void 0||typeof t=="string")return S(t);if(!t||typeof t!="object"||!Array.isArray(t.accentColors))throw new TypeError("theme must be a registered variant ID or a resolved orb theme.");return t}var P=class{constructor(e,i={}){this.canvas=Ie(e),this.destroyed=!1,this.paused=!1,this.visible=!0,this.pageVisible=typeof document>"u"||document.visibilityState==="visible",this.audioDetach=null,this.reducedMotionSetting=i.reducedMotion??"user",this.motionPreference=typeof matchMedia=="function"?matchMedia("(prefers-reduced-motion: reduce)"):null,this.engine=new O(e,{fixedTime:i.fixedTime,onError:i.onError,quality:i.quality,state:i.state,timeOffset:i.timeOffset,variant:ne(i.theme)}),this.handleVisibility=()=>{this.pageVisible=document.visibilityState==="visible",this.updateActivity()},this.handleMotionPreference=r=>{this.reducedMotionSetting==="user"&&this.engine.setReducedMotion(r.matches)},this.resizeObserver=typeof ResizeObserver=="function"?new ResizeObserver(()=>this.resize()):null,this.intersectionObserver=typeof IntersectionObserver=="function"?new IntersectionObserver(([r])=>{this.visible=r.isIntersecting,this.updateActivity()}):null,this.resizeObserver?.observe(e),this.intersectionObserver?.observe(e),this.motionPreference?.addEventListener("change",this.handleMotionPreference),document.addEventListener("visibilitychange",this.handleVisibility),this.engine.setReducedMotion(this.shouldReduceMotion()),this.resize(),this.engine.start()}shouldReduceMotion(){return typeof this.reducedMotionSetting=="boolean"?this.reducedMotionSetting:!!this.motionPreference?.matches}resize(){let e=this.canvas.getBoundingClientRect(),i=Math.max(1,Math.min(e.width||this.canvas.clientWidth||264,e.height||this.canvas.clientHeight||e.width||264));this.engine.resize(i,globalThis.devicePixelRatio||1)}updateActivity(){this.engine.setActive(!this.destroyed&&!this.paused&&this.visible&&this.pageVisible)}setTheme(e){let i=ne(e);return this.engine.setVariant(i),i}setState(e){this.engine.setState(e)}setQuality(e){this.engine.setQuality(e)}setAudioLevel(e){this.engine.setAudioLevel(e)}setReducedMotion(e){if(e!=="user"&&typeof e!="boolean")throw new TypeError("reducedMotion must be true, false, or user.");this.reducedMotionSetting=e,this.engine.setReducedMotion(this.shouldReduceMotion())}attachAudioSource(e,i){return this.disconnectAudio(),this.audioDetach=X(e,r=>this.setAudioLevel(r),i),()=>this.disconnectAudio()}async connectMicrophone(e){return this.disconnectAudio(),this.audioDetach=await K(i=>this.setAudioLevel(i),e),()=>this.disconnectAudio()}disconnectAudio(){this.audioDetach?.(),this.audioDetach=null,this.setAudioLevel(0)}releaseAudioSource(e){Z(e)}pause(){this.paused=!0,this.updateActivity()}resume(){this.paused=!1,this.updateActivity()}destroy(){this.destroyed||(this.destroyed=!0,this.disconnectAudio(),this.resizeObserver?.disconnect(),this.intersectionObserver?.disconnect(),this.motionPreference?.removeEventListener("change",this.handleMotionPreference),document.removeEventListener("visibilitychange",this.handleVisibility),this.engine.destroy())}};function se(t,e){return new P(t,e)}export{se as createOrb,ie as createOrbTheme};
