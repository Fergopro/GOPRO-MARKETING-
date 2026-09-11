const GP = {
  supabaseUrl: "https://oulckllygepbqbctzeka.supabase.co",
  supabaseKey: "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI"
};

const q = (selector, element = document) =>
  element.querySelector(selector);


/* =========================================================
   VISITOR / LEAD SESSION
========================================================= */

let gpSessionId =
  localStorage.getItem("goprocures_session_id");

if (!gpSessionId) {
  gpSessionId =
    (crypto.randomUUID && crypto.randomUUID()) ||
    "gp_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

  localStorage.setItem(
    "goprocures_session_id",
    gpSessionId
  );
}

let currentLeadId =
  localStorage.getItem("goprocures_lead_id") || null;

let leadCreationStarted = false;


/* =========================================================
   EXAMPLE REQUEST BUTTONS
========================================================= */

document
  .querySelectorAll(".js-example")
  .forEach((button) => {
    button.onclick = () => {
      const input = q(
        button.dataset.input || "#aiQuickInput"
      );

      if (input) {
        input.value =
          button.dataset.example || "";

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


/* =========================================================
   CREATE CHAT AREA
========================================================= */

function getAIConversationBox() {
  let box = q("#aiConversation");

  if (!box && aiInput) {
    box = document.createElement("div");

    box.id = "aiConversation";
    box.className = "ai-conversation";

    const inputArea =
      aiInput.closest(".ai-input");

    if (inputArea) {
      inputArea.parentNode.insertBefore(
        box,
        inputArea
      );
    }
  }

  return box;
}


/* =========================================================
   SAFE HTML
========================================================= */

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


/* =========================================================
   FORMAT AI RESPONSE
========================================================= */

function formatAIText(text) {
  const lines = String(text)
    .split("\n");

  let html = "";

  lines.forEach((line) => {
    const cleanLine = line.trim();

    if (!cleanLine) {
      html +=
        '<div class="ai-paragraph-space"></div>';

      return;
    }

    const numbered =
      cleanLine.match(/^(\d+)\.\s+(.*)$/);

    if (numbered) {
      let itemText =
        escapeHtml(numbered[2]);

      itemText = itemText.replace(
        /\*\*(.*?)\*\*/g,
        "<strong>$1</strong>"
      );

      html += `
        <div class="ai-list-item">
          <span class="ai-list-number">
            ${numbered[1]}
          </span>

          <span>
            ${itemText}
          </span>
        </div>
      `;

      return;
    }

    let normalText =
      escapeHtml(cleanLine);

    normalText = normalText.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

    html += `
      <div class="ai-text-line">
        ${normalText}
      </div>
    `;
  });

  return html;
}


/* =========================================================
   ADD CHAT MESSAGE
========================================================= */

function addAIMessage(role, text) {
  const box =
    getAIConversationBox();

  if (!box) return;

  const row =
    document.createElement("div");

  row.className =
    role === "user"
      ? "ai-message-row ai-message-row-user"
      : "ai-message-row ai-message-row-agent";


  const avatar =
    document.createElement("div");

  avatar.className =
    role === "user"
      ? "ai-chat-avatar ai-chat-avatar-user"
      : "ai-chat-avatar ai-chat-avatar-agent";

  avatar.textContent =
    role === "user"
      ? "U"
      : "AI";


  const message =
    document.createElement("div");

  message.className =
    role === "user"
      ? "ai-message ai-message-user"
      : "ai-message ai-message-agent";


  const label =
    document.createElement("div");

  label.className =
    "ai-message-label";

  label.textContent =
    role === "user"
      ? "YOU"
      : "GOPROCURES AI";


  const body =
    document.createElement("div");

  body.className =
    "ai-message-body";


  if (role === "assistant") {
    body.innerHTML =
      formatAIText(text);
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
   AI THINKING STATUS
========================================================= */

function showAIStatus(text) {
  let status = q("#aiStatus");

  if (!status) {
    status =
      document.createElement("div");

    status.id = "aiStatus";
    status.className = "ai-status";

    const box =
      getAIConversationBox();

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

    <span>
      ${escapeHtml(text)}
    </span>
  `;

  status.style.display = "flex";


  const box =
    getAIConversationBox();

  if (box) {
    box.scrollTo({
      top: box.scrollHeight,
      behavior: "smooth"
    });
  }
}


function hideAIStatus() {
  const status =
    q("#aiStatus");

  if (status) {
    status.style.display = "none";
  }
}


/* =========================================================
   CAPTURE FIRST LEAD
========================================================= */

function captureInitialLead(firstMessage) {
  /*
    IMPORTANT:

    This deliberately runs in the background.

    The customer should NEVER have to wait
    for Supabase before the AI responds.
  */

  if (currentLeadId) {
    return;
  }

  if (leadCreationStarted) {
    return;
  }

  if (
    !GP.supabaseUrl.startsWith("http") ||
    GP.supabaseKey.includes("PASTE_")
  ) {
    console.warn(
      "Supabase lead capture is not configured."
    );

    return;
  }


  leadCreationStarted = true;


  fetch(
    `${GP.supabaseUrl}/rest/v1/leads`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "apikey": GP.supabaseKey,
        "Authorization":
          `Bearer ${GP.supabaseKey}`,
        "Prefer": "return=representation"
      },

      body: JSON.stringify({
        message: firstMessage,

        source:
          "goprocures_ai",

        enquiry_type:
          "AI Procurement Enquiry",

        session_id:
          gpSessionId,

        status:
          "incomplete",

        conversation: [
          {
            role: "user",
            content: firstMessage
          }
        ],

        updated_at:
          new Date().toISOString(),

        last_seen_at:
          new Date().toISOString()
      })
    }
  )

    .then(async (response) => {
      if (!response.ok) {
        throw new Error(
          await response.text()
        );
      }

      return response.json();
    })

    .then((data) => {
      if (
        Array.isArray(data) &&
        data[0]?.id
      ) {
        currentLeadId =
          data[0].id;

        localStorage.setItem(
          "goprocures_lead_id",
          currentLeadId
        );

        console.log(
          "GoProcures lead captured:",
          currentLeadId
        );
      }
    })

    .catch((error) => {
      console.error(
        "Could not create AI lead:",
        error
      );

      /*
        Allow another attempt later
        if the initial insert failed.
      */

      leadCreationStarted = false;
    });
}


/* =========================================================
   CALL GOPROCURES AI
========================================================= */

async function askGoProcuresAI(text) {
  const response = await fetch(
    "/api/goprocure-ai",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        message: text,
        conversation: conversation
      })
    }
  );


  const raw =
    await response.text();


  let result;


  try {
    result =
      JSON.parse(raw);
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
   SEND MESSAGE
========================================================= */

async function submitAIMessage(text) {
  text =
    String(text || "").trim();


  if (!text) return;


  /*
    Display customer message immediately.
  */

  addAIMessage(
    "user",
    text
  );


  /*
    Add message to AI conversation memory.
  */

  conversation.push({
    role: "user",
    content: text
  });


  /*
    Capture the lead in the background.

    NO await here.

    Supabase cannot delay the AI.
  */

  captureInitialLead(text);


  /*
    Disable input while AI is answering.
  */

  if (aiInput) {
    aiInput.value = "";
    aiInput.disabled = true;
  }


  if (aiSubmit) {
    aiSubmit.disabled = true;
  }


  showAIStatus(
    "Understanding your requirement..."
  );


  try {
    const result =
      await askGoProcuresAI(text);


    hideAIStatus();


    const reply =
      result.reply ||
      result.message ||
      result.content ||
      "I understand. Let me help you clarify the procurement requirement.";


    addAIMessage(
      "assistant",
      reply
    );


    conversation.push({
      role: "assistant",
      content: reply
    });


  } catch (error) {
    console.error(
      "GoProcures AI error:",
      error
    );


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

    submitAIMessage(
      aiInput.value
    );
  };
}


/* =========================================================
   PRESS ENTER TO SEND
========================================================= */

if (aiInput) {
  aiInput.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        submitAIMessage(
          aiInput.value
        );
      }
    }
  );
}


/* =========================================================
   LOAD REQUEST FROM URL
========================================================= */

const params =
  new URLSearchParams(
    window.location.search
  );


const initialRequest =
  params.get("request");


if (
  initialRequest &&
  aiInput
) {
  aiInput.value =
    initialRequest;


  setTimeout(() => {
    submitAIMessage(
      initialRequest
    );
  }, 500);
}


/* =========================================================
   CONTACT FORM → SUPABASE
========================================================= */

const form =
  q("#contactForm");


if (form) {
  form.onsubmit =
    async (event) => {

      event.preventDefault();


      const button =
        q(
          'button[type="submit"]',
          form
        );


      if (button) {
        button.disabled = true;
        button.textContent =
          "Sending...";
      }


      const formData =
        new FormData(form);


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


        const response =
          await fetch(
            `${GP.supabaseUrl}/rest/v1/leads`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                "apikey":
                  GP.supabaseKey,

                "Authorization":
                  `Bearer ${GP.supabaseKey}`,

                "Prefer":
                  "return=minimal"
              },

              body: JSON.stringify({
                name:
                  formData.get("name"),

                email:
                  formData.get("email"),

                phone:
                  formData.get("phone"),

                company:
                  formData.get("company"),

                enquiry_type:
                  formData.get(
                    "enquiry_type"
                  ),

                message:
                  formData.get("message"),

                source:
                  "main-website-contact"
              })
            }
          );


        if (!response.ok) {
          throw new Error(
            await response.text()
          );
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
          button.textContent =
            "Send to GoProcures";
        }
      }
    };
}
