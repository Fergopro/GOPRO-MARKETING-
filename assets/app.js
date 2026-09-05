const GP = {
  supabaseUrl: "https://oulckllygepbqbctzeka.supabase.co",
  supabaseKey: "sb_publishable_uX1OBnvFiTFQqs4ZDBtifQ_aGQsLtAI"
};

const q = (s, e = document) => e.querySelector(s);

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


/* Create / find AI conversation UI */

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


/* Add message to conversation */

function addAIMessage(role, text) {
  const box = getAIConversationBox();

  if (!box) return;

  const message = document.createElement("div");

  message.className =
    role === "user"
      ? "ai-message ai-message-user"
      : "ai-message ai-message-agent";

  message.textContent = text;

  box.appendChild(message);
  box.scrollTop = box.scrollHeight;
}


/* Show temporary AI status */

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

  if (status) {
    status.textContent = text;
    status.style.display = "block";
  }
}


/* Hide AI status */

function hideAIStatus() {
  const status = q("#aiStatus");

  if (status) {
    status.style.display = "none";
  }
}


/* Send request to our secure Vercel API */

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

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
}


/* Main AI message handler */

async function submitAIMessage(text) {
  text = text.trim();

  if (!text) return;

  addAIMessage("user", text);

  conversation.push({
    role: "user",
    content: text
  });

  if (aiInput) {
    aiInput.value = "";
    aiInput.disabled = true;
  }

  if (aiSubmit) {
    aiSubmit.disabled = true;
  }

  showAIStatus("GoProcures AI is understanding your requirement...");

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


/* Submit button */

if (aiSubmit) {
  aiSubmit.onclick = () => {
    if (!aiInput) return;

    submitAIMessage(aiInput.value);
  };
}


/* Press Enter to send */

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
