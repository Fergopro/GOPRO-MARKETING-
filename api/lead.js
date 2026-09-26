
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const SUPABASE_URL =
  "https://oulckllygepbqbctzeka.supabase.co";

const COOKIE_NAME = "gp_lead_session";
const COOKIE_AGE = 60 * 60 * 24 * 30;

function sign(value, secret) {
  return createHmac("sha256", secret)
    .update("goprocures-lead-cookie:" + value)
    .digest("hex");
}

function getSession(req, secret) {
  const cookie = req.cookies?.[COOKIE_NAME];

  if (cookie) {
    const [token, signature] = cookie.split(".");

    if (
      token &&
      signature &&
      /^[a-f0-9]{64}$/.test(token) &&
      /^[a-f0-9]{64}$/.test(signature)
    ) {
      const expected = sign(token, secret);

      if (
        timingSafeEqual(
          Buffer.from(signature, "hex"),
          Buffer.from(expected, "hex")
        )
      ) {
        return { token };
      }
    }
  }

  return {
    token: randomBytes(32).toString("hex")
  };
}

function getSessionId(token, secret) {
  return createHmac("sha256", secret)
    .update("goprocures-lead-id:" + token)
    .digest("hex");
}

function clean(value, max = 500) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  res.setHeader("Cache-Control", "no-store");

  const origin = req.headers.origin;
  const host =
    req.headers["x-forwarded-host"] || req.headers.host;

  if (origin) {
    try {
      if (new URL(origin).host !== host) {
        return res.status(403).json({
          error: "Invalid request origin"
        });
      }
    } catch {
      return res.status(403).json({
        error: "Invalid request origin"
      });
    }
  }

  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!secret) {
    console.error("SUPABASE_SECRET_KEY is missing");

    return res.status(500).json({
      error: "Lead service is not configured"
    });
  }

  const body = req.body || {};

  if (
    !Array.isArray(body.conversation) ||
    body.conversation.length > 80
  ) {
    return res.status(400).json({
      error: "Invalid conversation"
    });
  }

  const conversation = body.conversation.map((entry) => ({
    role: entry?.role === "assistant" ? "assistant" : "user",
    content: clean(entry?.content, 5000)
  }));

  const firstMessage = clean(body.message, 5000);

  if (!firstMessage || conversation.length === 0) {
    return res.status(400).json({
      error: "A procurement enquiry is required"
    });
  }

  const name = clean(body.name, 150);
  const email = clean(body.email, 254);
  const phone = clean(body.phone, 50);
  const company = clean(body.company, 150);

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return res.status(400).json({
      error: "Invalid email address"
    });
  }

  const session = getSession(req, secret);
  const id = getSessionId(session.token, secret);

  const cookieValue =
    session.token + "." + sign(session.token, secret);

  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${cookieValue}; Path=/; Max-Age=${COOKIE_AGE}; HttpOnly; Secure; SameSite=Lax`
  );

  const headers = {
    "Content-Type": "application/json",
    apikey: secret,
    Prefer: "return=representation"
  };

  const now = new Date().toISOString();

  try {
    const findResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/leads` +
      `?session_id=eq.${id}` +
      `&source=eq.goprocures_ai` +
      `&select=id,status,email,phone` +
      `&order=created_at.desc&limit=1`,
      {
        headers: {
          apikey: secret
        }
      }
    );

    if (!findResponse.ok) {
      throw new Error(await findResponse.text());
    }

    const existing = await findResponse.json();
    const lead = existing[0];

    const hasContact = Boolean(
      email || phone || lead?.email || lead?.phone
    );

    if (lead) {
      const updateData = {
        conversation,
        updated_at: now,
        last_seen_at: now,
        status:
          ["qualified", "submitted"].includes(lead.status)
            ? lead.status
            : hasContact
              ? "contact_captured"
              : "incomplete"
      };

      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (company) updateData.company = company;

      const updateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/leads?id=eq.${lead.id}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify(updateData)
        }
      );

      if (!updateResponse.ok) {
        throw new Error(await updateResponse.text());
      }

      const updated = await updateResponse.json();

      return res.status(200).json({
        success: true,
        action: "updated",
        lead_id: updated[0]?.id
      });
    }

    const createResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/leads`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: name || null,
          email: email || null,
          phone: phone || null,
          company: company || null,
          message: firstMessage,
          source: "goprocures_ai",
          enquiry_type: "AI Procurement Enquiry",
          session_id: id,
          status: hasContact
            ? "contact_captured"
            : "incomplete",
          conversation,
          updated_at: now,
          last_seen_at: now
        })
      }
    );

    if (!createResponse.ok) {
      throw new Error(await createResponse.text());
    }

    const created = await createResponse.json();

    return res.status(200).json({
      success: true,
      action: "created",
      lead_id: created[0]?.id
    });

  } catch (error) {
    console.error("GoProcures lead API error:", error);

    return res.status(500).json({
      error: "Unable to save procurement lead"
    });
  }
}
