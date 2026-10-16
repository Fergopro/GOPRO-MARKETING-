import React,{useEffect,useMemo,useRef,useState} from "https://esm.sh/react@19?bundle";
import{createRoot}from"https://esm.sh/react-dom@19/client?deps=react@19&bundle";
import{experimental_useRealtime as useRealtime}from"https://esm.sh/@ai-sdk/react@latest?deps=react@19&bundle";
import{gateway}from"https://esm.sh/@ai-sdk/gateway@latest?bundle";
import{createClient}from"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const h=React.createElement;
const supabase=createClient(
  "https://oulckllygepbqbctzeka.supabase.co",
  "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI"
);

function textFromMessage(message){
  if(typeof message?.content==="string"){
    return message.content;
  }

  const parts=Array.isArray(message?.parts)?message.parts:[];

  return parts
    .map(part=>{
      if(typeof part?.text==="string") return part.text;
      if(typeof part?.transcript==="string") return part.transcript;
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

function App(){
  const [authSession,setAuthSession]=useState(null);
  const [access,setAccess]=useState(null);
  const [loading,setLoading]=useState(true);
  const [starting,setStarting]=useState(false);
  const [secondsLeft,setSecondsLeft]=useState(null);
  const [error,setError]=useState("");
  const startedAtRef=useRef(null);
  const usageSentRef=useRef(false);
  const streamRef=useRef(null);

  const model=useMemo(
    ()=>gateway.experimental_realtime("openai/gpt-realtime-2"),
    []
  );

  const realtime=useRealtime({
    model,
    api:{token:"/api/realtime-token"},
    sessionConfig:{
      voice:"marin",
      turnDetection:{type:"server-vad"},
      instructions:
        "You are GoProcures Voice AI, a concise professional worldwide procurement assistant. " +
        "Ask only the important questions needed to understand the item, quantity, specification, application, acceptable alternatives, delivery location and urgency. " +
        "Do not invent suppliers, prices, stock, certifications or delivery dates. " +
        "When the requirement is clear, summarize it briefly and ask the customer to confirm. " +
        "Speak naturally, warmly and professionally."
    },
    onError:(err)=>{
      console.error(err);
      setError(err?.message||"Voice AI connection error.");
    }
  });

  useEffect(()=>{
    let alive=true;

    (async()=>{
      const {data:{session}}=await supabase.auth.getSession();

      if(!alive) return;

      if(!session){
        location.replace("login.html");
        return;
      }

      setAuthSession(session);

      try{
        const r=await fetch("/api/voice-access",{
          method:"POST",
          headers:{
            "Content-Type":"application/json",
            Authorization:"Bearer "+session.access_token
          },
          body:JSON.stringify({action:"status"})
        });

        const j=await r.json();

        if(!r.ok){
          throw new Error(j.error||"Unable to check voice access.");
        }

        if(alive){
          setAccess(j);
        }
      }catch(e){
        if(alive) setError(e.message);
      }finally{
        if(alive) setLoading(false);
      }
    })();

    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(realtime.status!=="connected"||!startedAtRef.current){
      return;
    }

    const timer=setInterval(()=>{
      if(access?.plan!=="pro"){
        const elapsed=Math.floor(
          (Date.now()-startedAtRef.current)/1000
        );

        const left=Math.max(0,60-elapsed);
        setSecondsLeft(left);

        if(left<=0){
          endVoice();
        }
      }
    },250);

    return()=>clearInterval(timer);
  },[realtime.status,access?.plan]);

  async function reportUsage(){
    if(
      usageSentRef.current||
      !authSession||
      !startedAtRef.current
    ){
      return;
    }

    usageSentRef.current=true;

    const seconds=Math.max(
      1,
      Math.round(
        (Date.now()-startedAtRef.current)/1000
      )
    );

    try{
      await fetch("/api/voice-access",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          Authorization:
            "Bearer "+authSession.access_token
        },
        body:JSON.stringify({
          action:"usage",
          seconds
        })
      });
    }catch(e){
      console.error(e);
    }
  }

  async function startVoice(){
    if(starting||realtime.status==="connected"){
      return;
    }

    setStarting(true);
    setError("");
    usageSentRef.current=false;

    try{
      const r=await fetch("/api/voice-access",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          Authorization:
            "Bearer "+authSession.access_token
        },
        body:JSON.stringify({action:"start"})
      });

      const j=await r.json();

      if(!r.ok){
        if(j.upgrade_required){
          setAccess(prev=>({
            ...(prev||{}),
            voice_enabled:false,
            trial_available:false,
            plan:"free"
          }));
        }

        throw new Error(
          j.error||
          "Voice AI is not available."
        );
      }

      setAccess(j);

      const stream=
        await navigator.mediaDevices.getUserMedia({
          audio:{
            echoCancellation:true,
            noiseSuppression:true,
            autoGainControl:true
          }
        });

      streamRef.current=stream;
      startedAtRef.current=Date.now();

      if(j.session_type==="trial"){
        setSecondsLeft(60);
      }else{
        setSecondsLeft(null);
      }

      await realtime.connect({stream});

      try{
        await realtime.resumePlayback();
      }catch{}

    }catch(e){
      startedAtRef.current=null;
      setError(e.message);
    }finally{
      setStarting(false);
    }
  }

  async function endVoice(){
    try{
      if(
        realtime.status==="connected"||
        realtime.status==="connecting"
      ){
        await realtime.close();
      }
    }catch{
      realtime.disconnect();
    }

    if(streamRef.current){
      streamRef.current
        .getTracks()
        .forEach(track=>track.stop());
      streamRef.current=null;
    }

    await reportUsage();

    startedAtRef.current=null;

    if(access?.plan!=="pro"){
      setSecondsLeft(0);
      setAccess(prev=>({
        ...(prev||{}),
        voice_enabled:false,
        trial_available:false
      }));
    }
  }

  useEffect(()=>{
    return()=>{
      if(streamRef.current){
        streamRef.current
          .getTracks()
          .forEach(track=>track.stop());
      }
    };
  },[]);

  if(loading){
    return h("div",{className:"voice-loading"},
      h("div",{className:"voice-loader"}),
      h("p",null,"Checking Voice AI access...")
    );
  }

  const connected=realtime.status==="connected";
  const connecting=
    realtime.status==="connecting"||starting;
  const locked=
    access?.plan!=="pro"&&!access?.voice_enabled;

  const transcript=(realtime.messages||[])
    .map(m=>({
      role:m.role,
      text:textFromMessage(m)
    }))
    .filter(m=>m.text);

  return h("div",{className:"voice-page"},
    h("nav",{className:"voice-nav"},
      h("a",{className:"voice-brand",href:"index.html"},
        h("span",{className:"voice-brand-mark"},"GP"),
        h("span",null,"Go",h("em",null,"Procures"))
      ),
      h("div",{className:"voice-nav-actions"},
        h("a",{className:"voice-link",href:"index.html#assistant"},"Text AI"),
        h("a",{className:"voice-link",href:"dashboard.html"},"Dashboard")
      )
    ),

    h("div",{className:"voice-layout"},
      h("section",{className:"voice-main"},
        h("div",{className:"voice-eyebrow"},"REALTIME PROCUREMENT ASSISTANT"),
        h("h1",{className:"voice-title"},"Talk. ",h("span",null,"We understand the requirement.")),
        h("p",{className:"voice-sub"},
          "Speak naturally about what you need. GoProcures Voice AI will ask the procurement questions that matter and help turn the conversation into a clear sourcing requirement."
        ),

        h("div",{className:"voice-stage "+(connected?"connected":"")},
          h("div",{className:"voice-orb-wrap"},
            h("div",{className:"voice-ring r1"}),
            h("div",{className:"voice-ring r2"}),
            h("div",{className:"voice-ring r3"}),
            h("div",{className:"voice-orb"},"AI")
          ),
          h("div",{className:"voice-status"},
            connected
              ? h(React.Fragment,null,h("strong",null,"Listening")," · Speak naturally")
              : connecting
                ? "Connecting secure voice session..."
                : locked
                  ? "Voice AI requires GoProcures Pro"
                  : "Ready when you are"
          ),
          access?.plan!=="pro"&&secondsLeft!==null
            ? h("div",{className:"voice-timer"},
                "0:"+String(secondsLeft).padStart(2,"0")
              )
            : null,
          h("div",{className:"voice-controls"},
            !connected
              ? h("button",{
                  className:"voice-btn primary",
                  disabled:connecting||locked||!access?.voice_enabled,
                  onClick:startVoice
                },connecting?"Connecting...":"🎙 Start Voice AI")
              : h("button",{
                  className:"voice-btn stop",
                  onClick:endVoice
                },"End conversation")
          ),
          error
            ? h("div",{className:"voice-alert"},error)
            : null,
          locked
            ? h("div",{className:"voice-alert"},
                "Your free 1-minute Voice AI trial has been used. Upgrade to Pro to continue using realtime voice."
              )
            : null
        )
      ),

      h("aside",{className:"voice-side"},
        h("div",{className:"voice-plan"},
          h("div",null,
            h("span",null,"Voice access"),
            h("strong",null,
              access?.plan==="pro"
                ? "GoProcures Pro"
                : access?.trial_available
                  ? "Free trial available"
                  : "Free trial used"
            )
          ),
          h("div",{className:"voice-plan-badge"},
            access?.plan==="pro"?"PRO":"VOICE AI"
          )
        ),

        h("div",{className:"voice-card"},
          h("h3",null,"How access works"),
          h("p",null,
            access?.plan==="pro"
              ? "Your Pro account has realtime Voice AI enabled."
              : access?.trial_available
                ? "Your account includes one free 60-second Voice AI session. Once it starts, the trial is considered used."
                : "Realtime Voice AI is now locked on this free account. Pro access is required for more voice sessions."
          )
        ),

        h("div",{className:"voice-card"},
          h("h3",null,"Live conversation"),
          h("p",null,
            connected
              ? "Microphone and AI audio are active. You can interrupt naturally while the assistant is speaking."
              : "Your microphone only activates after you press Start Voice AI."
          )
        ),

        h("div",{className:"voice-transcript"},
          transcript.length
            ? transcript.map((m,i)=>
                h("div",{
                  key:i,
                  className:"voice-msg "+(m.role==="assistant"?"assistant":"user")
                },
                  h("b",null,m.role==="assistant"?"GOPROCURES AI":"YOU"),
                  m.text
                )
              )
            : h("div",{className:"voice-card"},
                h("h3",null,"Transcript"),
                h("p",null,"Your realtime conversation will appear here when transcription is available.")
              )
        )
      )
    )
  );
}

createRoot(document.getElementById("voiceRoot")).render(h(App));
