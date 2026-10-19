/* GoProcures Voice AI — AI Gateway WebSocket, no React runtime.
   Browser receives only a short-lived Gateway client token. */
(() => {
  "use strict";

  const URL = "https://oulckllygepbqbctzeka.supabase.co";
  const KEY = "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";
  const $ = id => document.getElementById(id);
  const ui = {
    status: $("voiceStatus"), error: $("voiceError"), info: $("voiceInfo"),
    start: $("startVoice"), stop: $("stopVoice"), retry: $("retryVoice"),
    stage: $("voiceStage"), timer: $("voiceTimer"),
    plan: $("voicePlan"), badge: $("voiceBadge"),
    explanation: $("voiceAccessExplanation"),
    transcript: $("voiceTranscript")
  };
  let client, session, access, microphone, socket, audioCtx, inputNode, processor, silentGain;
  let playedAudioCtx, outputTime = 0, outputSources = new Set();
  let timerInterval = null, startedAt = 0, starting = false, connected = false;
  let sessionIsTrial = false, usageReported = true, assistantTranscript = "";

  function setStatus(message) { ui.status.textContent = message; }
  function showError(message) {
    ui.error.textContent = String(message || "Voice AI unavailable.");
    ui.error.hidden = false;
  }
  function clearError() { ui.error.hidden = true; ui.error.textContent = ""; }
  function detail(error) { return error?.message || String(error || "Unexpected error"); }

  async function api(path, body) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (session?.access_token || "")
      },
      body: JSON.stringify(body || {}),
      credentials: "same-origin"
    });
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : {};
    if (!response.ok) {
      const fallback = response.status === 404
        ? "Voice endpoint was not deployed (HTTP 404). Check the latest Vercel Preview deployment."
        : response.status === 500
          ? "Voice server error (HTTP 500). Please check Vercel Function Logs and Preview environment variables."
          : "Voice request failed (HTTP " + response.status + ").";
      throw new Error(result.error || fallback);
    }
    return result;
  }

  function isPro(row) {
    return row?.plan === "pro" &&
      (!row.pro_expires_at || new Date(row.pro_expires_at).getTime() > Date.now());
  }

  async function refreshAccess() {
    if (!client || !session) throw new Error("Sign in to continue.");
    // Read account entitlements directly through Supabase RLS.
    // This avoids requiring the Vercel server just to display the page.
    const result = await client
      .from("user_entitlements")
      .select("plan,voice_trial_started_at,voice_trial_seconds,voice_seconds_used,pro_expires_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (result.error) throw new Error("Account verification failed: " + result.error.message);

    const row = result.data || {plan:"free",voice_trial_started_at:null,voice_trial_seconds:0};
    const pro = isPro(row);
    const used = Boolean(row.voice_trial_started_at) ||
      Number(row.voice_trial_seconds || 0) >= 60;
    access = {
      plan: pro ? "pro" : "free",
      voice_enabled: pro || !used,
      trial_available: !pro && !used
    };
    ui.plan.textContent = pro ? "GoProcures Pro" :
      used ? "Free trial used" : "Free 60-second trial available";
    ui.badge.textContent = pro ? "PRO" : "VOICE AI";
    ui.explanation.textContent = pro ?
      "Your Pro account can use realtime Voice AI." :
      used ? "Your free trial has been used. Upgrade to GoProcures Pro to continue." :
      "Your account includes one free 60-second voice trial. Pro is needed after the trial.";
    ui.start.disabled = !access.voice_enabled;
    if (!connected && !starting) setStatus(access.voice_enabled ?
      "Ready when you are" : "Voice AI requires GoProcures Pro");
    return access;
  }

  async function boot() {
    ui.retry.hidden = true; clearError();
    setStatus("Checking account access...");
    try {
      if (!window.isSecureContext) throw new Error("Voice AI requires a secure HTTPS connection.");
      const pkg = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      client = pkg.createClient(URL, KEY);
      const found = await client.auth.getSession();
      session = found.data?.session;
      if (!session) { location.replace("login.html"); return; }
      await refreshAccess();
    } catch (error) {
      setStatus("Unable to check Voice AI access");
      showError(detail(error));
      ui.start.disabled = true;
      ui.retry.hidden = false;
    }
  }

  function message(role, text) {
    if (!text) return;
    if (ui.transcript.querySelector(".voice-card")) ui.transcript.replaceChildren();
    const card = document.createElement("div");
    card.className = "voice-msg " + (role === "assistant" ? "assistant" : "user");
    const tag = document.createElement("b");
    tag.textContent = role === "assistant" ? "GOPROCURES AI" : "YOU";
    const body = document.createElement("div");
    body.textContent = text;
    card.append(tag, body);
    ui.transcript.append(card);
    ui.transcript.scrollTop = ui.transcript.scrollHeight;
  }

  function cutPlayback() {
    for (const node of outputSources) {
      try { node.stop(); } catch {}
    }
    outputSources.clear();
    outputTime = 0;
  }

  function playChunk(encoded) {
    if (!encoded || !playedAudioCtx) return;
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const sampleCount = Math.floor(bytes.length / 2);
    if (!sampleCount) return;
    const pcm = new Float32Array(sampleCount);
    const dv = new DataView(bytes.buffer);
    for (let i = 0; i < sampleCount; i++) pcm[i] = dv.getInt16(i*2, true)/32768;
    const buffer = playedAudioCtx.createBuffer(1, sampleCount, 24000);
    buffer.getChannelData(0).set(pcm);
    const node = playedAudioCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(playedAudioCtx.destination);
    const when = Math.max(playedAudioCtx.currentTime + .045, outputTime || 0);
    node.start(when);
    outputTime = when + buffer.duration;
    outputSources.add(node);
    node.onended = () => outputSources.delete(node);
  }

  function eventFromGateway(payload) {
    let event;
    try { event = JSON.parse(payload); } catch { return; }
    if (Array.isArray(event)) { event.forEach(eventFromGatewayObject); return; }
    eventFromGatewayObject(event);
  }

  function eventFromGatewayObject(event) {
    switch(event?.type) {
      case "session-created":
      case "session-updated":
      case "session-started":
        setStatus("Listening — what can we procure for you?");
        break;
      case "speech-started":
        cutPlayback();
        setStatus("Listening to your request...");
        break;
      case "speech-stopped":
        setStatus("Processing your requirement...");
        break;
      case "audio-delta":
      case "audio-chunk":
        playChunk(event.delta);
        setStatus("GoProcures AI is speaking...");
        break;
      case "audio-transcript-delta":
        assistantTranscript += event.delta || "";
        break;
      case "audio-transcript-done":
        message("assistant", event.transcript || assistantTranscript);
        assistantTranscript = "";
        setStatus("Listening — you can continue speaking");
        break;
      case "input-transcription-completed":
        message("user", event.transcript);
        break;
      case "error":
        showError(event.message || event.error?.message || "AI voice session error.");
        setStatus("Voice configuration failed — please end the session.");
        break;
      case "session-closed":
        stop();
        break;
    }
  }

  function monoPcmBase64(input, originalSampleRate) {
    // Linear resampling to 24 kHz PCM16; the Gateway normalizes this format.
    const wanted = 24000, ratio = originalSampleRate / wanted;
    const count = Math.max(1, Math.floor(input.length / ratio));
    const bytes = new Uint8Array(count * 2);
    const view = new DataView(bytes.buffer);
    for (let i=0; i<count; i++) {
      const pos = i*ratio, index = Math.floor(pos), mix = pos-index;
      const sample = (input[index] || 0)*(1-mix) + (input[Math.min(index+1,input.length-1)] || 0)*mix;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(i*2, clamped < 0 ? clamped*32768 : clamped*32767, true);
    }
    let raw = "";
    for (let i=0;i<bytes.length;i++) raw += String.fromCharCode(bytes[i]);
    return btoa(raw);
  }

  async function beginMic() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();
    inputNode = audioCtx.createMediaStreamSource(microphone);
    processor = audioCtx.createScriptProcessor(2048,1,1);
    silentGain = audioCtx.createGain();
    silentGain.gain.value = 0;
    processor.onaudioprocess = event => {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > 220000) return; // avoid runaway queue
      const input = event.inputBuffer.getChannelData(0);
      socket.send(JSON.stringify({
        type: "input-audio-append",
        audio: monoPcmBase64(input, audioCtx.sampleRate)
      }));
    };
    inputNode.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(audioCtx.destination);
  }

  async function openGateway(credentials) {
    if (!credentials?.url?.startsWith("wss://") || !credentials?.token)
      throw new Error("Gateway did not provide a valid realtime WebSocket token.");
    const ws = new WebSocket(credentials.url,[
      "ai-gateway-realtime.v1",
      "ai-gateway-auth." + credentials.token
    ]);
    socket = ws;
    await new Promise((resolve,reject) => {
      let complete = false;
      const timeout = setTimeout(() => {
        if (!complete) {complete = true; reject(new Error("Gateway connection timed out.")); ws.close();}
      },15000);
      ws.onopen = () => {
        if (complete) return;
        complete = true; clearTimeout(timeout); resolve();
      };
      ws.onerror = () => {
        if (complete) return;
        complete = true; clearTimeout(timeout);
        reject(new Error("Gateway WebSocket failed. Check the AI Gateway key, model access and Vercel logs."));
      };
      ws.onclose = () => {
        if (complete && connected) {
          showError("Voice connection ended. You can return to your dashboard or try again.");
          stop();
        } else if (!complete) {
          complete=true;clearTimeout(timeout);reject(new Error("Gateway rejected the realtime connection."));
        }
      };
    });
    ws.onmessage = e => eventFromGateway(e.data);
    const brain = await import("./procurement-brain.js");
    const procurementBrain = brain.PROCUREMENT_VOICE_INSTRUCTIONS;
    ws.send(JSON.stringify({type:"session-update",config:{
      voice:"cedar",
      instructions: procurementBrain,
      inputAudioFormat:{type:"audio/pcm",sampleRate:24000},
      outputAudioFormat:{type:"audio/pcm",sampleRate:24000},
      outputModalities:["audio"],
      turnDetection:{type:"server-vad",threshold:0.72,prefixPaddingMs:400,silenceDurationMs:1100},
      inputAudioTranscription:{model:"gpt-4o-mini-transcribe"}
    }}));
  }

  async function start() {
    if (starting || connected || !access?.voice_enabled) return;
    starting = true;
    ui.start.disabled = true;
    ui.retry.hidden = true;
    clearError();
    setStatus("Preparing microphone...");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Your browser requires HTTPS and microphone support.");
      }
      microphone = await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}
      });
      playedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      await playedAudioCtx.resume();
      setStatus("Checking Voice AI service...");
      // The trial is consumed at the start request, never from simply opening the page.
      const rights = await api("/api/voice-access",{action:"start"});
      sessionIsTrial = rights.session_type === "trial";
      setStatus("Connecting to AI Gateway...");
      const credentials = await api("/api/realtime-token",{});
      await openGateway(credentials);
      await beginMic();
      usageReported = false;
      connected = true;
      startedAt = Date.now();
      ui.start.hidden = true;
      ui.stop.hidden = false;
      ui.stage.classList.add("connected");
      setStatus("Listening — what can we procure for you?");
      ui.info.textContent = "Microphone is active. You can interrupt naturally. End conversation to stop.";
      if (sessionIsTrial) {
        ui.timer.hidden = false;
        function tick() {
          const seconds = Math.floor((Date.now()-startedAt)/1000);
          const remaining = Math.max(0,60-seconds);
          ui.timer.textContent = "0:" + String(remaining).padStart(2,"0");
          if (!remaining) stop();
        }
        tick();
        timerInterval = setInterval(tick,250);
      }
    } catch (e) {
      setStatus("Voice AI connection failed");
      showError(detail(e));
      await stop(false);
      ui.retry.hidden = false;
    } finally {
      starting = false;
    }
  }

  async function reportUsage() {
    if (usageReported || !startedAt) return;
    usageReported = true;
    const seconds = Math.max(1,Math.round((Date.now()-startedAt)/1000));
    startedAt = 0;
    try { await api("/api/voice-access",{action:"usage",seconds}); }
    catch (e) { console.warn("Voice usage logging unsuccessful",e); }
  }

  async function stop(refresh=true) {
    if (timerInterval) {clearInterval(timerInterval);timerInterval=null;}
    connected=false;
    const oldSocket=socket;socket=null;
    if (oldSocket && oldSocket.readyState === WebSocket.OPEN) {
      try {oldSocket.send(JSON.stringify({type:"session-close"}));}catch{}
    }
    try {oldSocket?.close();} catch {}
    processor?.disconnect();inputNode?.disconnect();silentGain?.disconnect();
    processor=null;inputNode=null;silentGain=null;
    microphone?.getTracks().forEach(t => t.stop());microphone=null;
    try {await audioCtx?.close();} catch {} audioCtx=null;
    cutPlayback();
    try {await playedAudioCtx?.close();}catch{} playedAudioCtx=null;
    ui.stage.classList.remove("connected");
    ui.stop.hidden = true; ui.start.hidden=false;ui.timer.hidden=true;
    await reportUsage();
    if (refresh) {
      try { await refreshAccess(); } catch(e){ showError(detail(e)); }
    } else {
      ui.start.disabled = !access?.voice_enabled;
    }
  }

  ui.start.addEventListener("click",start);
  ui.stop.addEventListener("click",()=>stop());
  ui.retry.addEventListener("click",async()=>{
    clearError();ui.retry.hidden=true;await boot();
  });
  window.addEventListener("pagehide",()=>{
    microphone?.getTracks().forEach(t=>t.stop());
    socket?.close();
    if (connected) {
      const seconds = Math.max(1,Math.round((Date.now()-startedAt)/1000));
      navigator.sendBeacon && console.debug("GoProcures voice finished after",seconds,"seconds");
    }
  });
  boot();
})();