/* GoProcures Voice AI – no external React runtime required. */
(() => {
  "use strict";
  const SUPABASE_URL = "https://oulckllygepbqbctzeka.supabase.co";
  const PUBLISHABLE_KEY = "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";
  const $ = id => document.getElementById(id);
  const status = $("voiceStatus"), errBox = $("voiceError"), info = $("voiceInfo");
  const startBtn = $("startVoice"), stopBtn = $("stopVoice"), retryBtn = $("retryVoice");
  const stage = $("voiceStage"), timer = $("voiceTimer");
  const transcript = $("voiceTranscript");
  let client, session, access, peer, channel, microphone, remoteAudio;
  let startedAt = 0, countdown = null, connecting = false, finishedTrial = false;

  function setStatus(s) { status.textContent = s; }
  function error(s) { errBox.textContent = s; errBox.hidden = false; }
  function clearError() { errBox.hidden = true; errBox.textContent = ""; }
  async function jsonRequest(path, body, authorized = true) {
    const headers = { "Content-Type":"application/json" };
    if (authorized) {
      if (!session?.access_token) throw new Error("Please sign in again.");
      headers.Authorization = "Bearer " + session.access_token;
    }
    const response = await fetch(path, {method:"POST", headers, body:JSON.stringify(body||{})});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Voice service is temporarily unavailable.");
    return data;
  }
  function showAccess() {
    const pro = access?.plan === "pro";
    const free = !!access?.trial_available;
    $("voicePlan").textContent = pro ? "GoProcures Pro" : free ? "Free 60-second trial available" : "Free trial used";
    $("voiceBadge").textContent = pro ? "PRO" : "VOICE AI";
    $("voiceAccessExplanation").textContent = pro
      ? "Your Pro account is enabled for realtime Voice AI."
      : free ? "You have one free 60-second Voice AI trial. Pro is required after your trial."
      : "Your trial has been used. Upgrade to GoProcures Pro to use voice again.";
    startBtn.disabled = !access?.voice_enabled;
    if (access?.voice_enabled) setStatus("Ready when you are");
    else setStatus("Voice AI requires GoProcures Pro");
  }
  async function checkAccess() {
    try {
      clearError();
      if (!window.isSecureContext) throw new Error("Voice AI requires HTTPS.");
      const module = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      client = module.createClient(SUPABASE_URL, PUBLISHABLE_KEY);
      const result = await client.auth.getSession();
      session = result.data?.session;
      if (!session) { window.location.replace("login.html"); return; }
      access = await jsonRequest("/api/voice-access", {action:"status"});
      showAccess();
    } catch (e) {
      setStatus("Voice AI could not start");
      error(e.message || "Unable to load your account.");
      retryBtn.hidden = false;
    }
  }
  function recordText(role, text) {
    if (!text) return;
    if (transcript.querySelector(".voice-card")) transcript.replaceChildren();
    const el = document.createElement("div");
    el.className = "voice-msg " + (role === "assistant" ? "assistant" : "user");
    const label = document.createElement("b");
    label.textContent = role === "assistant" ? "GOPROCURES AI" : "YOU";
    const content = document.createElement("div");
    content.textContent = text;
    el.append(label, content);
    transcript.append(el);
    transcript.scrollTop = transcript.scrollHeight;
  }
  function onRealtimeEvent(raw) {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === "conversation.item.input_audio_transcription.completed") {
      recordText("user", msg.transcript);
    } else if (msg.type === "response.audio_transcript.done" || msg.type === "response.output_audio_transcript.done") {
      recordText("assistant", msg.transcript);
    } else if (msg.type === "error") {
      error(msg.error?.message || "Voice connection error.");
    }
  }
  async function openConnection(credentials) {
    if (!credentials?.url || !credentials?.token) throw new Error("Voice token unavailable.");
    if (!window.RTCPeerConnection) throw new Error("Your browser does not support live voice.");
    peer = new RTCPeerConnection();
    remoteAudio = document.createElement("audio");
    remoteAudio.autoplay = true;
    remoteAudio.playsInline = true;
    remoteAudio.hidden = true;
    document.body.appendChild(remoteAudio);
    peer.ontrack = event => { remoteAudio.srcObject = event.streams[0]; remoteAudio.play().catch(() => {}); };
    peer.onconnectionstatechange = () => {
      if (["failed","disconnected"].includes(peer?.connectionState)) {
        error("Voice connection dropped. Please check your network and try again.");
        stop();
      }
    };
    microphone.getAudioTracks().forEach(track => peer.addTrack(track, microphone));
    channel = peer.createDataChannel("oai-events");
    channel.onmessage = event => onRealtimeEvent(event.data);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const answer = await fetch(credentials.url, {
      method: "POST",
      headers: {"Authorization":"Bearer " + credentials.token, "Content-Type":"application/sdp"},
      body: offer.sdp
    });
    if (!answer.ok) throw new Error("Realtime voice connection failed (" + answer.status + ").");
    await peer.setRemoteDescription({type:"answer",sdp:await answer.text()});
    channel.onopen = () => {
      channel.send(JSON.stringify({type:"session.update",session:{
        instructions:"You are GoProcures Voice AI, a professional worldwide procurement assistant. Ask succinct questions to clarify item, quantity, specification, delivery destination and urgency. Do not invent supplier offers or claim to have sourced anything. Summarize the client's requirements before asking for confirmation.",
        voice:"marin",
        turn_detection:{type:"server_vad"}
      }}));
    };
  }
  async function start() {
    if (connecting || !access?.voice_enabled) return;
    connecting = true; startBtn.disabled = true; retryBtn.hidden = true;
    clearError(); setStatus("Requesting microphone permission...");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access requires HTTPS and a supported browser.");
      microphone = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      setStatus("Connecting securely...");
      // The trial is not claimed until after microphone permission is granted.
      const rights = await jsonRequest("/api/voice-access", {action:"start"});
      if (rights.session_type === "trial") finishedTrial = true;
      const token = await jsonRequest("/api/realtime-token", {}, false);
      await openConnection(token);
      startedAt = Date.now();
      stage.classList.add("connected");
      startBtn.hidden = true; stopBtn.hidden = false;
      setStatus("Listening — tell us what you need");
      info.textContent = "Microphone is active. Click End conversation to stop.";
      if (rights.session_type === "trial") {
        timer.hidden = false;
        const tick = () => {
          const remaining = Math.max(0, 60 - Math.floor((Date.now()-startedAt)/1000));
          timer.textContent = "0:" + String(remaining).padStart(2,"0");
          if (!remaining) stop();
        };
        tick(); countdown = setInterval(tick, 250);
      }
    } catch(e) {
      error(e.message || "Unable to connect to Voice AI.");
      setStatus("Voice AI connection failed");
      await stop(false);
      retryBtn.hidden = false;
    } finally { connecting = false; }
  }
  async function stop(refresh=true) {
    if (countdown) { clearInterval(countdown); countdown = null; }
    try { channel?.close(); } catch {}
    try { peer?.close(); } catch {}
    peer = null; channel = null;
    microphone?.getTracks().forEach(track => track.stop()); microphone = null;
    if(remoteAudio) {remoteAudio.srcObject = null; remoteAudio.remove();remoteAudio=null;}
    stage.classList.remove("connected"); stopBtn.hidden = true; startBtn.hidden = false;
    if (startedAt && session) {
      const seconds = Math.max(1,Math.round((Date.now()-startedAt)/1000));
      startedAt = 0;
      jsonRequest("/api/voice-access", {action:"usage",seconds}).catch(console.error);
    }
    if (refresh) {
      try { access = await jsonRequest("/api/voice-access",{action:"status"}); showAccess(); }
      catch(e) {error(e.message);}
    } else startBtn.disabled = !access?.voice_enabled;
  }
  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", () => stop());
  retryBtn.addEventListener("click", async () => {retryBtn.hidden=true;clearError();await checkAccess();});
  window.addEventListener("pagehide", () => {
    microphone?.getTracks().forEach(track=>track.stop());
    peer?.close();
  });
  checkAccess();
})();