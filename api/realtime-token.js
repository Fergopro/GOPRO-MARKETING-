import { createHmac, timingSafeEqual } from "node:crypto";
import { gateway } from "@ai-sdk/gateway";

const U = "https://oulckllygepbqbctzeka.supabase.co";
const COOKIE = "gp_voice_session";

function sign(value, secret){
  return createHmac("sha256", secret)
    .update("goprocures-voice-session:" + value)
    .digest("hex");
}

function cookieValue(req, name){
  const raw = req.headers.cookie || "";

  const found = raw
    .split(";")
    .map(v=>v.trim())
    .find(v=>v.startsWith(name + "="));

  return found
    ? decodeURIComponent(found.slice(name.length + 1))
    : "";
}

function verifySession(req, secret){
  const value = cookieValue(req, COOKIE);

  if(!value){
    return null;
  }

  const i = value.lastIndexOf(".");

  if(i <= 0){
    return null;
  }

  const userId = value.slice(0, i);
  const supplied = value.slice(i + 1);
  const expected = sign(userId, secret);

  try{
    if(
      supplied.length !== expected.length ||
      !timingSafeEqual(
        Buffer.from(supplied),
        Buffer.from(expected)
      )
    ){
      return null;
    }
  }catch{
    return null;
  }

  return userId;
}

async function entitlement(secret, userId){
  const r = await fetch(
    U + "/rest/v1/user_entitlements?user_id=eq." +
    encodeURIComponent(userId) +
    "&select=*&limit=1",
    {
      headers:{
        apikey: secret,
        Authorization: "Bearer " + secret
      }
    }
  );

  if(!r.ok){
    throw new Error(await r.text());
  }

  const rows = await r.json();

  return rows[0] || null;
}

function isPro(row){
  if(row?.plan !== "pro"){
    return false;
  }

  if(!row.pro_expires_at){
    return true;
  }

  return new Date(row.pro_expires_at).getTime() > Date.now();
}

export default async function handler(req, res){
  res.setHeader("Cache-Control", "no-store");

  if(req.method !== "POST"){
    return res.status(405).json({
      error:"Method not allowed"
    });
  }

  const secret = process.env.SUPABASE_SECRET_KEY;

  if(!secret){
    return res.status(500).json({
      error:"Voice session service is not configured."
    });
  }

  const userId = verifySession(req, secret);

  if(!userId){
    return res.status(401).json({
      error:"Voice session authorization required."
    });
  }

  try{
    const row = await entitlement(secret, userId);

    if(!row){
      return res.status(403).json({
        error:"Voice access not found."
      });
    }

    const pro = isPro(row);

    let expiresAfterSeconds = 600;

    if(!pro){
      const started = row.voice_trial_started_at
        ? new Date(row.voice_trial_started_at).getTime()
        : 0;

      const ageSeconds =
        started
          ? (Date.now() - started) / 1000
          : Infinity;

      if(
        !started ||
        Number(row.voice_trial_seconds || 0) < 60 ||
        ageSeconds > 120
      ){
        return res.status(402).json({
          error:"Your free Voice AI minute has ended.",
          upgrade_required:true
        });
      }

      expiresAfterSeconds = 75;
    }

    const { token, url } =
      await gateway.experimental_realtime.getToken({
        model:"openai/gpt-realtime-2",
        expiresAfterSeconds
      });

    return res.status(200).json({
      token,
      url,
      tools:[]
    });

  }catch(error){
    console.error("Realtime token error:", error);

    return res.status(500).json({
      error:"Unable to start GoProcures Voice AI."
    });
  }
}