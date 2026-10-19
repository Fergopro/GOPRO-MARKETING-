/* GetLayers Liquid Colour / Violet Crown exported recipe (2026-10-19).
   Aurora mathematics retained; palette, render budget and lifecycle adapted for GoProcures. */
const vertex='attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const fragment=`precision highp float;
uniform vec2 u_res;uniform float u_t;uniform vec3 u_deep,u_horizon,u_glow,u_rim;uniform float u_drift,u_fold,u_freq;
float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){vec2 ip=floor(p),u=fract(p);u=u*u*(3.-2.*u);return mix(mix(hash21(ip),hash21(ip+vec2(1.,0.)),u.x),mix(hash21(ip+vec2(0.,1.)),hash21(ip+vec2(1.,1.)),u.x),u.y);}
float fbm3(vec2 p){float v=0.,a=.5;mat2 rot=mat2(cos(.5),sin(.5),-sin(.5),cos(.5));for(int i=0;i<3;i++){v+=a*noise2(p);p=rot*p*2.02+vec2(37.,17.);a*=.5;}return v;}
float fbm2(vec2 p){float v=0.,a=.5;mat2 rot=mat2(cos(.5),sin(.5),-sin(.5),cos(.5));for(int i=0;i<2;i++){v+=a*noise2(p);p=rot*p*2.02+vec2(37.,17.);a*=.5;}return v;}
void main(){
 vec2 st=gl_FragCoord.xy/u_res-.5;st.x*=u_res.x/u_res.y;float x=st.x,hv=st.y+.5,time=u_t*.35;
 float hzp=1.-smoothstep(0.,.22,hv);vec3 sky=mix(u_deep,u_horizon,hzp*hzp*.18);
 float amp=.05+u_fold*.22,tiltG=(noise2(vec2(time*.11,71.3))-.5)*.9,tiltR=(noise2(vec2(time*.07,41.7))-.5)*.35;
 float wob=(fbm2(vec2(x*u_freq*.6+time*u_drift*.3,time*.09))-.5)*1.6;
 float ph=time*u_drift*.7+wob,sf=u_freq*u_freq*.65,th=x*sf+ph,th2=(x+.012)*sf+ph;
 float wv=.5+.5*(.78*sin(th)+.22*sin(2.*th+2.1)),wv2=.5+.5*(.78*sin(th2)+.22*sin(2.*th2+2.1));
 float wave=(wv-.5)*2.+x*tiltR,slope=abs(wv2-wv)/.012;vec3 aur=vec3(0.);float cover=0.;
 for(int i=0;i<2;i++){
  float fi=float(i),freq=u_freq*(1.+fi*.15),drift=u_drift*(.75+fi*.25);
  float nr=smoothstep(.35,.65,fbm2(vec2(x*freq*.5+time*drift*.4+fi*21.3,fi*3.77+time*.07)));
  float wig=fbm3(vec2(x*freq*2.6+time*drift+fi*3.7,fi*7.31+time*.13))-.5;
  float spine=.31+fi*.12+amp*wave,m=slope*amp*2.,widen=sqrt(1.+min(m*m*2.5,5.));
  float s=(.17+u_fold*.07)*(.7+nr*.85)*(1.-fi*.2)*widen;
  float knotK=1.+(.25+1.15*u_fold)*smoothstep(1.1,3.,slope*amp*6.);
  float surge=.78+.22*noise2(vec2(x*1.1-time*1.3,5.5+fi*2.2)),L=(.6+.4*nr)*knotK*surge,u=(hv-spine)/s;
  float xr=x*freq*(4.5+2.*nr)+wig*2.2+time*drift*1.6+max(u,0.)*s*(tiltG+x*.22)*3.,yr=hv*.8+fi*9.13;
  float v=.5*noise2(vec2(xr,yr))+.28*noise2(vec2(xr*2.7+13.7,yr*1.7+5.2))+.14*noise2(vec2(xr*6.1+31.9,yr*2.3+11.4))+.08*noise2(vec2(xr*12.3+57.1,yr*2.9+23.7));
  float soft=.55+.45*smoothstep(.3,.7,v),hard=.1+.9*smoothstep(.38,.6,v);
  float bn=noise2(vec2(x*freq*1.4+time*drift*.8+fi*17.3,fi*4.77)),flick=.85+.15*noise2(vec2(x*freq*3.1+time*2.8,7.7+fi*3.));
  float rayK=mix(soft,hard,u_fold)*(.45+.55*smoothstep(.26,.72,bn))*flick,kBody=1.-.7*fi;
  float d=u-.15,sig=d<0.?.26:.55,beam=exp(-(d*d)/(2.*sig*sig)),body=beam*(.28+.72*rayK),k=kBody*L;
  vec3 gcol=mix(u_glow,u_rim,beam*beam*.75);gcol=mix(gcol,u_deep,smoothstep(.35,1.05,u)*.5);gcol=mix(gcol,u_horizon,(1.-smoothstep(-.38,-.12,d))*.3);
  float gB=body*(.88+u_fold*.36)*k;aur+=gcol*gB;cover+=gB;
 }
 vec2 gp=vec2(x,hv)*60.,cell=floor(gp);float hct=hash21(cell),starI=0.;
 if(hct>.96){vec2 spos=vec2(hash21(cell+11.3),hash21(cell+27.7))*.6+.2;float r=length(fract(gp)-spos),tw=.6+.4*sin(u_t*(2.+hct*6.)+hct*100.),bmag=(hct-.96)/.04;starI=pow(max(0.,1.-r/.14),4.)*(.3+.7*bmag)*tw;starI*=smoothstep(.03,.12,hv)*clamp(1.-cover*2.2,0.,1.);starI*=1.-smoothstep(.25,.6,dot(sky,vec3(.299,.587,.114)));}
 gl_FragColor=vec4(clamp(sky+aur+vec3(.95,.97,1.)*starI,0.,1.),1.);
}`;
export function mountAurora(canvas,{isPaused=()=>false}={}){
 if(!canvas||matchMedia('(max-width:640px)').matches)return ()=>{};
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)return ()=>{};
 const shaders=[],program=gl.createProgram();
 for(const [kind,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);gl.deleteProgram(program);return ()=>{};}shaders.push(shader);gl.attachShader(program,shader);}
 gl.bindAttribLocation(program,0,'p');gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return ()=>{};
 gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
 const uniform=name=>gl.getUniformLocation(program,name),res=uniform('u_res'),clock=uniform('u_t');
 // Violet Crown structure with GoProcures' cool night palette.
 gl.uniform3f(uniform('u_deep'),.025,.035,.09);gl.uniform3f(uniform('u_horizon'),.14,.1,.30);gl.uniform3f(uniform('u_glow'),.38,.20,.70);gl.uniform3f(uniform('u_rim'),.49,.70,.98);
 gl.uniform1f(uniform('u_drift'),.15+.36*1.1);gl.uniform1f(uniform('u_fold'),.7);gl.uniform1f(uniform('u_freq'),1+(1-.43)*2.8);
 let raf=0,last=0,time=20.75,visible=true,drawn=false,destroyed=false;const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 function resize(){const box=canvas.getBoundingClientRect(),scale=Math.min(1,1000/Math.max(1,box.width));canvas.width=Math.max(1,Math.round(box.width*scale));canvas.height=Math.max(1,Math.round(box.height*scale));drawn=false;}
 function draw(){gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(res,canvas.width,canvas.height);gl.uniform1f(clock,time);gl.drawArrays(gl.TRIANGLES,0,3);drawn=true;}
 function frame(now){if(destroyed)return;raf=requestAnimationFrame(frame);if(!visible||document.hidden||isPaused()){last=0;return;}if(reduced.matches){if(!drawn)draw();last=0;return;}if(last&&now-last<40)return;if(last)time+=.22*1.2*Math.min(.05,(now-last)/1000);last=now;draw();}
 const observer=new ResizeObserver(resize);observer.observe(canvas);const intersection=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;});intersection.observe(canvas);canvas.addEventListener('webglcontextlost',()=>{destroyed=true;cancelAnimationFrame(raf);},{once:true});resize();draw();raf=requestAnimationFrame(frame);
 return()=>{destroyed=true;cancelAnimationFrame(raf);observer.disconnect();intersection.disconnect();gl.deleteBuffer(buffer);shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);};
}
