const GP = {
  supabaseUrl: "https://oulckllygepbqbctzeka.supabase.co",
  supabaseKey: "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI"
};

const q = (s, e = document) => e.querySelector(s);
let gpSessionId = localStorage.getItem("goprocures_session_id");

if (!gpSessionId) {
  gpSessionId =
    (crypto.randomUUID && crypto.randomUUID()) ||
    "gp_" + Date.now() + "_" + Math.random().toString(36).slice(2);

  localStorage.setItem("goprocures_session_id", gpSessionId);
}

let currentLeadId = localStorage.getItem("goprocures_lead_id") || null;

/* =========================================================
   EXAMPLE REQUEST BUTTONS
========================================================= */

document.querySelectorAll(".js-example").forEach((button) => {
  button.onclick = () => {
    const input = q(button.dataset.input || "#aiQuickInput");

    if (input) {
      input.value = button.dataset.example || "";
      input.focus();
    }
  };
});

/* =========================================================
   AI PROCUREMENT AGENT
========================================================= */

const aiInput = q("#aiQuickInput");
const aiSubmit = q(".js-ai-submit");

let conversation = [];
async function createLeadIfNeeded(firstMessage) {
  if (currentLeadId) {
    return currentLeadId;
  }

  if (
    !GP.supabaseUrl.startsWith("http") ||
    GP.supabaseKey.includes("PASTE_")
  ) {
    console.warn("Supabase is not configured for AI lead capture.");
    return null;
  }

  try {
    const response = await fetch(
      `${GP.supabaseUrl}/rest/v1/leads`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": GP.supabaseKey,
          "Authorization": `Bearer ${GP.supabaseKey}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          message: firstMessage,
          source: "goprocures_ai",
          enquiry_type: "AI Procurement Enquiry",
          session_id: gpSessionId,
          status: "incomplete",
          conversation: [
            {
              role: "user",
              content: firstMessage
            }
          ],
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString()
        })
      }
    );

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();

    if (Array.isArray(data) && data[0]?.id) {
      currentLeadId = data[0].id;
      localStorage.setItem("goprocures_lead_id", currentLeadId);
    }

    return currentLeadId;

  } catch (error) {
    console.error("Could not create AI lead:", error);
    return null;
  }
}

async function updateLeadConversation() {
  if (!currentLeadId) return;

  try {
    await fetch(
      `${GP.supabaseUrl}/rest/v1/leads?id=eq.${currentLeadId}`,
      {
        method: "PATCH",
       headers: {
  "Content-Type": "application/json",
  "apikey": GP.supabaseKey,
  "Authorization": `Bearer ${GP.supabaseKey}`,
  "Prefer": "return=minimal",
  "x-goprocures-session": gpSessionId
},
        },
        body: JSON.stringify({
          conversation: conversation,
          updated_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString()
        })
      }
    );
  } catch (error) {
    console.error("Could not update AI lead:", error);
  }
}

function getAIConversationBox() {
  let box = q("#aiConversation");

  if (!box && aiInput) {
    box = document.createElement("div");

    box.id = "aiConversation";
    box.className = "ai-conversation";

    const inputArea = aiInput.closest(".ai-input");

    if (inputArea) {
      inputArea.parentNode.insertBefore(box, inputArea);
    }
  }

  return box;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatAIText(text) {
  let html = escapeHtml(text);

  /* Bold text */
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  /* Clean numbered lists */
  html = html.replace(
    /(?:^|\n)\s*(\d+)\.\s+/g,
    '<div class="ai-list-item"><span class="ai-list-number">$1</span><span>'
  );

  /*
    Close numbered list item before the next item.
    This handles normal AI responses while keeping
    the layout clean.
  */
  html = html.replace(
    /<\/span>\s*<div class="ai-list-item">/g,
    '</span></div><div class="ai-list-item">'
  );

  /* Normal line breaks */
  html = html.replace(/\n\n+/g, '<div class="ai-paragraph-space"></div>');
  html = html.replace(/\n/g, "<br>");

  return html;
}

function addAIMessage(role, text) {
  const box = getAIConversationBox();

  if (!box) return;

  const row = document.createElement("div");

  row.className =
    role === "user"
      ? "ai-message-row ai-message-row-user"
      : "ai-message-row ai-message-row-agent";

  const avatar = document.createElement("div");

  avatar.className =
    role === "user"
      ? "ai-chat-avatar ai-chat-avatar-user"
      : "ai-chat-avatar ai-chat-avatar-agent";

  avatar.textContent =
    role === "user"
      ? "U"
      : "AI";

  const message = document.createElement("div");

  message.className =
    role === "user"
      ? "ai-message ai-message-user"
      : "ai-message ai-message-agent";

  const label = document.createElement("div");

  label.className = "ai-message-label";

  label.textContent =
    role === "user"
      ? "YOU"
      : "GOPROCURES AI";

  const body = document.createElement("div");

  body.className = "ai-message-body";

  if (role === "assistant") {
    body.innerHTML = formatAIText(text);
  } else {
    body.textContent = text;
  }

  message.appendChild(label);
  message.appendChild(body);

  if (role === "user") {
    row.appendChild(message);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(message);
  }

  box.appendChild(row);

  box.scrollTo({
    top: box.scrollHeight,
    behavior: "smooth"
  });
}

function showAIStatus(text) {
  let status = q("#aiStatus");

  if (!status) {
    status = document.createElement("div");

    status.id = "aiStatus";
    status.className = "ai-status";

    const box = getAIConversationBox();

    if (box) {
      box.appendChild(status);
    }
  }

  status.innerHTML = `
    <span class="ai-thinking-dots">
      <span></span>
      <span></span>
      <span></span>
    </span>
    <span>${escapeHtml(text)}</span>
  `;

  status.style.display = "flex";

  const box = getAIConversationBox();

  if (box) {
    box.scrollTo({
      top: box.scrollHeight,
      behavior: "smooth"
    });
  }
}

function hideAIStatus() {
  const status = q("#aiStatus");

  if (status) {
    status.style.display = "none";
  }
}

async function askGoProcuresAI(text) {
  const response = await fetch("/api/goprocure-ai", {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      message: text,
      conversation: conversation
    })
  });

  const raw = await response.text();

  let result;

  try {
    result = JSON.parse(raw);
  } catch {
    result = {
      error: raw
    };
  }

  if (!response.ok) {
    throw new Error(
      result.error ||
      raw ||
      "Unable to connect to GoProcures AI."
    );
  }

  return result;
}

async function submitAIMessage(text) {
  text = String(text || "").trim();

  if (!text) return;

  addAIMessage("user", text);

  conversation.push({
    role: "user",
    content: text
  });
  await createLeadIfNeeded(text);
await updateLeadConversation();

  if (aiInput) {
    aiInput.value = "";
    aiInput.disabled = true;
  }

  if (aiSubmit) {
    aiSubmit.disabled = true;
  }

  showAIStatus("Understanding your requirement...");

  try {
    const result = await askGoProcuresAI(text);

    hideAIStatus();

    const reply =
      result.reply ||
      result.message ||
      result.content ||
      "I understand. Let me help you clarify the procurement requirement.";

    addAIMessage("assistant", reply);

    conversation.push({
      role: "assistant",
      content: reply
    });
    
    await updateLeadConversation();

  } catch (error) {
    console.error("GoProcures AI error:", error);

    hideAIStatus();

    addAIMessage(
      "assistant",
      "I'm having trouble connecting to the procurement AI right now. Please try again in a moment."
    );

  } finally {
    if (aiInput) {
      aiInput.disabled = false;
      aiInput.focus();
    }

    if (aiSubmit) {
      aiSubmit.disabled = false;
    }
  }
}

/* =========================================================
   SEND BUTTON
========================================================= */

if (aiSubmit) {
  aiSubmit.onclick = () => {
    if (!aiInput) return;

    submitAIMessage(aiInput.value);
  };
}

/* =========================================================
   PRESS ENTER TO SEND
========================================================= */

if (aiInput) {
  aiInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      submitAIMessage(aiInput.value);
    }
  });
}

/* =========================================================
   LOAD REQUEST FROM URL
========================================================= */

const params = new URLSearchParams(window.location.search);

const initialRequest = params.get("request");

if (initialRequest && aiInput) {
  aiInput.value = initialRequest;

  setTimeout(() => {
    submitAIMessage(initialRequest);
  }, 500);
}

/* =========================================================
   CONTACT FORM → SUPABASE
========================================================= */

const form = q("#contactForm");

if (form) {
  form.onsubmit = async (event) => {
    event.preventDefault();

    const button = q('button[type="submit"]', form);

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    const formData = new FormData(form);

    try {
      if (
        !GP.supabaseUrl.startsWith("http") ||
        GP.supabaseKey.includes("PASTE_")
      ) {
        alert(
          "Please configure the Supabase publishable key in assets/app.js."
        );

        return;
      }

      const response = await fetch(
        `${GP.supabaseUrl}/rest/v1/leads`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "apikey": GP.supabaseKey,
            "Authorization": `Bearer ${GP.supabaseKey}`,
            "Prefer": "return=minimal"
          },

          body: JSON.stringify({
            name: formData.get("name"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            company: formData.get("company"),
            enquiry_type: formData.get("enquiry_type"),
            message: formData.get("message"),
            source: "main-website-contact"
          })
        }
      );

      if (!response.ok) {
        throw new Error(await response.text());
      }

      form.reset();

      alert(
        "Thank you. Your message has been sent to GoProcures."
      );

    } catch (error) {
      console.error(error);

      alert(
        "We could not submit the form. Please contact GoProcures directly."
      );

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Send to GoProcures";
      }
    }
  };
}
