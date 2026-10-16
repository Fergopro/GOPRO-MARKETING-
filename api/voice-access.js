import { createHmac, timingSafeEqual } from "node:crypto";

const U = "https://oulckllygepbqbctzeka.supabase.co";
const K = "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI";
const COOKIE = "gp_voice_session";

function sign(value, secret){
  return createHmac("sha256", secret)
    .update("goprocures-voice-session:" + value)
    .digest("hex");
}

async function getUser(req){
  const h = req.headers.authorization || "";
  if(!h.startsWith("Bearer ")) return null;

  const token = h.slice(7);

  const r = await fetch(U + "/auth/v1/user", {
    headers:{
      apikey: K,
      Authorization: "Bearer " + token
    }
  });

  if(!r.ok) return null;

  return r.json();
}

async function getEntitlement(secret, userId){
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

  if(rows[0]){
    return rows[0];
  }

  const create = await fetch(
    U + "/rest/v1/user_entitlements",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        apikey: secret,
        Authorization: "Bearer " + secret,
        Prefer:"return=representation"
      },
      body: JSON.stringify({
        user_id: userId
      })
    }
  );

  if(!create.ok){
    throw new Error(await create.text());
  }

  return (await create.json())[0];
}

function isPro(entitlement){
  if(entitlement?.plan !== "pro") return false;

  if(!entitlement.pro_expires_at){
    return true;
  }

  return new Date(entitlement.pro_expires_at).getTime() > Date.now();
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
      error:"Voice access service is not configured."
    });
  }

  const user = await getUser(req);

  if(!user?.id){
    return res.status(401).json({
      error:"Sign in required."
    });
  }

  try{
    const entitlement = await getEntitlement(secret, user.id);
    const action = String(req.body?.action || "status");

    if(action === "usage"){
      const seconds = Math.max(
        0,
        Math.min(
          3600,
          Math.round(Number(req.body?.seconds) || 0)
        )
      );

      if(seconds > 0){
        const total =
          Number(entitlement.voice_seconds_used || 0) +
          seconds;

        const r = await fetch(
          U + "/rest/v1/user_entitlements?user_id=eq." +
          encodeURIComponent(user.id),
          {
            method:"PATCH",
            headers:{
              "Content-Type":"application/json",
              apikey: secret,
              Authorization: "Bearer " + secret,
              Prefer:"return=minimal"
            },
            body: JSON.stringify({
              voice_seconds_used: total,
              updated_at: new Date().toISOString()
            })
          }
        );

        if(!r.ok){
          throw new Error(await r.text());
        }
      }
    }

    const pro = isPro(entitlement);
    const trialUsed =
      Boolean(entitlement.voice_trial_started_at) ||
      Number(entitlement.voice_trial_seconds || 0) >= 60;

    const cookieValue =
      user.id + "." + sign(user.id, secret);

    res.setHeader(
      "Set-Cookie",
      `${COOKIE}=${cookieValue}; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Lax`
    );

    return res.status(200).json({
      plan: pro ? "pro" : "free",
      voice_enabled: pro || !trialUsed,
      trial_available: !pro && !trialUsed,
      trial_seconds: !pro && !trialUsed ? 60 : 0,
      voice_seconds_used:
        Number(entitlement.voice_seconds_used || 0),
      pro_expires_at:
        entitlement.pro_expires_at || null
    });

  }catch(error){
    console.error("Voice access error:", error);

    return res.status(500).json({
      error:"Unable to check Voice AI access."
    });
  }
}