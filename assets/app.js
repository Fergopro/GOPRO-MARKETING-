
const GP = {
  supabaseUrl: "https://oulckllygepbqbctzeka.supabase.co",
  supabaseKey: "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI"
};

const q = (selector, element = document) =>
  element.querySelector(selector);

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

let portalSupabase = null;
let portalUser = null;
let portalAuthReady = null;

let conversation = [];
let firstLeadMessage = "";

let capturedName = "";
let capturedEmail = "";
let capturedPhone = "";
let capturedCompany = "";

let aiBusy = false;

/*
  Lead requests are sent in sequence to prevent an older
  conversation snapshot overwriting a newer one.
*/

let leadSaveRunning = false;
let leadSavePending = false;

/* =========================================================
   CREATE CHAT AREA
========================================================= */

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

/* =========================================================
   SAFE TEXT FORMATTING
========================================================= */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatAIText(text) {
  const lines = String(text).split("\n");

  let html = "";

  lines.forEach((line) => {
    const cleanLine = line.trim();

    if (!cleanLine) {
      html += '<div class="ai-paragraph-space"></div>';
      return;
    }

    const numbered = cleanLine.match(/^(\d+)\.\s+(.*)$/);

    if (numbered) {
      let itemText = escapeHtml(numbered[2]);

      itemText = itemText.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      html += `
        <div class="ai-list-item">
          <span class="ai-list-number">${numbered[1]}</span>
          <span>${itemText}</span>
        </div>
      `;

      return;
    }

    let normalText = escapeHtml(cleanLine);

    normalText = normalText.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

    html += `
      <div class="ai-text-line">${normalText}</div>
    `;
  });

  return html;
}

/* =========================================================
   DISPLAY CHAT MESSAGES
========================================================= */

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

  avatar.textContent = role === "user" ? "U" : "AI";

  const message = document.createElement("div");

  message.className =
    role === "user"
      ? "ai-message ai-message-user"
      : "ai-message ai-message-agent";

  const label = document.createElement("div");

  label.className = "ai-message-label";

  label.textContent =
    role === "user" ? "YOU" : "GOPROCURES AI";

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

/* =========================================================
   THINKING INDICATOR
========================================================= */

function showAIStatus(text) {
  let status = q("#aiStatus");

  if (!status) {
    status = document.createElement("div");
    status.id = "aiStatus";
    status.className = "ai-status";

    const box = getAIConversationBox();

    if (box) box.appendChild(status);
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

  if (status) status.style.display = "none";
}

/* =========================================================
   CONTACT DETAIL EXTRACTION
========================================================= */

function extractContactDetails(text) {
  const value = String(text || "");

  const emailMatch = value.match(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
  );

  if (emailMatch) {
    capturedEmail = emailMatch[0];
  }

  /*
    Only recognise a phone number when the customer
    explicitly indicates that it is a contact number.

    This avoids confusing quantities such as
    "5000 units" with telephone numbers.
  */

  const phoneMatch = value.match(
    /\b(?:whatsapp|wa|phone|mobile|telephone|contact number|call me(?: on| at)?)\b[\s:=-]*(?:number\s*(?:is|:)?\s*)?(\+?\d[\d\s()-]{6,}\d)/i
  );

  if (phoneMatch) {
    const possiblePhone = phoneMatch[1].trim();

    const digits = possiblePhone.replace(/\D/g, "");

    if (digits.length >= 8 && digits.length <= 15) {
      capturedPhone = possiblePhone;
    }
  }
}

/* =========================================================
   SECURE LEAD SAVING
========================================================= */

async function saveLeadSnapshot() {
  if (!firstLeadMessage || conversation.length === 0) {
    return;
  }

  const payload = {
    message: firstLeadMessage,
    conversation: conversation.map((entry) => ({
      role: entry.role,
      content: entry.content
    })),
    name: capturedName || null,
    email: capturedEmail || null,
    phone: capturedPhone || null,
    company: capturedCompany || null
  };

  const response = await fetch("/api/lead", {
    method: "POST",

    credentials: "same-origin",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const result = await response.text();

    throw new Error(
      "Lead API " + response.status + ": " + result
    );
  }

  return await response.json();
}

/*
  All lead updates are processed in order.

  This prevents two overlapping saves from accidentally
  overwriting the full conversation with older data.

  Importantly, the AI never waits for this function.
*/

async function processLeadSaveQueue() {
  if (leadSaveRunning) return;

  leadSaveRunning = true;

  try {
    while (leadSavePending) {
      leadSavePending = false;

      try {
        await saveLeadSnapshot();
      } catch (error) {
        console.error("GoProcures lead save failed:", error);
      }
    }
  } finally {
    leadSaveRunning = false;
  }
}

function queueLeadSave() {
  leadSavePending = true;

  // Do not await this in the AI conversation.
  void processLeadSaveQueue();
}

/* =========================================================
   CONNECT TO GOPROCURES TEXT AI
========================================================= */

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

/* =========================================================
   SEND A CUSTOMER MESSAGE
========================================================= */

async function submitAIMessage(text) {
  if (aiBusy) return;

  await initPortalAuth();

  if (!portalUser) {
    window.location.href = "login.html";
    return;
  }

  text = String(text || "").trim();

  if (!text) return;

  aiBusy = true;

  if (!firstLeadMessage) {
    firstLeadMessage = text;
  }

  extractContactDetails(text);

  addAIMessage("user", text);

  conversation.push({
    role: "user",
    content: text
  });

  /*
    Start saving the lead immediately.

    This does not delay the AI response.
  */

  queueLeadSave();

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

    /*
      Update the same lead with the AI response.
    */

    queueLeadSave();

  } catch (error) {
    console.error("GoProcures AI error:", error);

    hideAIStatus();

    const errorMessage =
      "I'm having trouble connecting to the procurement AI right now. Please try again in a moment.";

    addAIMessage("assistant", errorMessage);

    conversation.push({
      role: "assistant",
      content: errorMessage
    });

    queueLeadSave();

  } finally {
    aiBusy = false;

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
   ENTER KEY
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
   INITIAL REQUEST FROM URL
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
   EXISTING CONTACT FORM
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
            apikey: GP.supabaseKey,
            Authorization: `Bearer ${GP.supabaseKey}`,
            Prefer: "return=minimal"
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


/* =========================================================
   AUTH-AWARE NAVIGATION + MOBILE MENU
========================================================= */

async function initPortalAuth() {
  if (portalAuthReady) return portalAuthReady;

  portalAuthReady = (async () => {
    try {
      const module = await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
      );

      portalSupabase = module.createClient(
        GP.supabaseUrl,
        GP.supabaseKey
      );

      const {
        data: { session }
      } = await portalSupabase.auth.getSession();

      portalUser = session?.user || null;
      updatePortalUI();

      portalSupabase.auth.onAuthStateChange((_event, session) => {
        portalUser = session?.user || null;
        updatePortalUI();
      });
    } catch (error) {
      console.error("GoProcures auth navigation error:", error);
      updatePortalUI();
    }
  })();

  return portalAuthReady;
}

function updatePortalUI() {
  const loggedIn = Boolean(portalUser);

  document.querySelectorAll(".auth-dashboard-link").forEach((el) => {
    el.hidden = !loggedIn;
  });

  document.querySelectorAll(".auth-login-link").forEach((el) => {
    el.hidden = loggedIn;
  });

  document.querySelectorAll(".auth-signout-link").forEach((el) => {
    el.hidden = !loggedIn;
  });

  document.querySelectorAll(".auth-ai-entry").forEach((el) => {
    el.href = loggedIn ? "index.html#assistant" : "login.html";
    el.textContent = loggedIn
      ? "Open Procurement AI →"
      : "Start a procurement →";
  });

  const banner = q("#aiAuthBanner");
  const userStrip = q("#aiUserStrip");
  const userLabel = q("#aiUserLabel");

  if (banner) banner.hidden = loggedIn;
  if (userStrip) userStrip.hidden = !loggedIn;

  if (userLabel && portalUser) {
    const name =
      portalUser.user_metadata?.full_name ||
      portalUser.user_metadata?.name ||
      portalUser.email ||
      "Client";

    userLabel.textContent = "Signed in as " + name;
  }

  if (aiInput) {
    aiInput.disabled = !loggedIn;
    aiInput.placeholder = loggedIn
      ? "e.g. I need 500 IBR sheets, 6m long..."
      : "Sign in to start a secure procurement request";
  }

  if (aiSubmit) {
    aiSubmit.disabled = !loggedIn;
  }

  document.querySelectorAll(".js-example").forEach((button) => {
    button.disabled = !loggedIn;
  });
}

const mobileToggle = q("#mobileToggle");
const mobileMenu = q("#mobileMenu");

if (mobileToggle && mobileMenu) {
  mobileToggle.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("open");
    mobileToggle.classList.toggle("open", open);
    mobileToggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });

  mobileMenu.querySelectorAll("a,button").forEach((item) => {
    item.addEventListener("click", () => {
      mobileMenu.classList.remove("open");
      mobileToggle.classList.remove("open");
      mobileToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  });
}

document.querySelectorAll(".auth-signout-link").forEach((button) => {
  button.addEventListener("click", async () => {
    await initPortalAuth();

    if (portalSupabase) {
      await portalSupabase.auth.signOut();
    }

    window.location.href = "login.html";
  });
});

void initPortalAuth();


/* =========================================================
   AUTH-AWARE NAVIGATION + WORKING MOBILE MENU
========================================================= */

async function initPortalAuth() {
  if (portalAuthReady) return portalAuthReady;

  portalAuthReady = (async () => {
    try {
      const module = await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
      );

      portalSupabase = module.createClient(
        GP.supabaseUrl,
        GP.supabaseKey
      );

      const {
        data: { session }
      } = await portalSupabase.auth.getSession();

      portalUser = session?.user || null;
      updatePortalUI();

      portalSupabase.auth.onAuthStateChange((_event, session) => {
        portalUser = session?.user || null;
        updatePortalUI();
      });
    } catch (error) {
      console.error("GoProcures auth navigation error:", error);
      updatePortalUI();
    }
  })();

  return portalAuthReady;
}

function updatePortalUI() {
  const loggedIn = Boolean(portalUser);

  document.querySelectorAll(".auth-dashboard-link").forEach((el) => {
    el.hidden = !loggedIn;
  });

  document.querySelectorAll(".auth-login-link").forEach((el) => {
    el.hidden = loggedIn;
  });

  document.querySelectorAll(".auth-signout-link").forEach((el) => {
    el.hidden = !loggedIn;
  });

  document.querySelectorAll(".auth-ai-entry").forEach((el) => {
    el.href = loggedIn ? "index.html#assistant" : "login.html";
    el.textContent = loggedIn
      ? "Open Procurement AI →"
      : "Start a procurement →";
  });

  const banner = q("#aiAuthBanner");
  const userStrip = q("#aiUserStrip");
  const userLabel = q("#aiUserLabel");

  if (banner) banner.hidden = loggedIn;
  if (userStrip) userStrip.hidden = !loggedIn;

  if (userLabel && portalUser) {
    const name =
      portalUser.user_metadata?.full_name ||
      portalUser.user_metadata?.name ||
      portalUser.email ||
      "Client";

    userLabel.textContent = "Signed in as " + name;
  }

  if (aiInput) {
    aiInput.disabled = !loggedIn;
    aiInput.placeholder = loggedIn
      ? "e.g. I need 500 IBR sheets, 6m long..."
      : "Sign in to start a secure procurement request";
  }

  if (aiSubmit) {
    aiSubmit.disabled = !loggedIn;
  }

  document.querySelectorAll(".js-example").forEach((button) => {
    button.disabled = !loggedIn;
  });
}

const mobileToggle = q("#mobileToggle");
const mobileMenu = q("#mobileMenu");

if (mobileToggle && mobileMenu) {
  mobileToggle.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("open");
    mobileToggle.classList.toggle("open", open);
    mobileToggle.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("menu-open", open);
  });

  mobileMenu.querySelectorAll("a,button").forEach((item) => {
    item.addEventListener("click", () => {
      mobileMenu.classList.remove("open");
      mobileToggle.classList.remove("open");
      mobileToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  });
}

document.querySelectorAll(".auth-signout-link").forEach((button) => {
  button.addEventListener("click", async () => {
    await initPortalAuth();

    if (portalSupabase) {
      await portalSupabase.auth.signOut();
    }

    window.location.href = "login.html";
  });
});

void initPortalAuth();
