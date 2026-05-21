// =============================================================================
// NEURALCHAT — Main Script
// =============================================================================

// --- DOM REFERENCES ---
const chatBody            = document.querySelector(".chat-body");
const messageInput        = document.querySelector(".message-input");
const sendMessageButton   = document.querySelector("#send-message");
const fileInput           = document.querySelector("#file-input");
const fileUploadButton    = document.querySelector("#file-upload");
const previewContainer    = document.querySelector(".file-preview-container");
const micButton           = document.querySelector("#mic-button");

// ── API CONFIG ──────────────────────────────────────────────────────────────
// 🔑 তোমার OpenRouter API key এখানে বসাও
const API_KEY = prompt("Enter your OpenRouter API Key");
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── USER DATA ────────────────────────────────────────────────────────────────
const userData = { message: null, file: null };

// ── CONVERSATION HISTORY (multi-turn memory) ─────────────────────────────────
const conversationHistory = [];

// =============================================================================
// HELPERS
// =============================================================================

const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add(...classes);
  div.innerHTML = content;
  return div;
};

const scrollToBottom = () => {
  chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
};

// Auto-resize textarea
messageInput.addEventListener("input", () => {
  messageInput.style.height = "auto";
  messageInput.style.height = messageInput.scrollHeight + "px";
});

// =============================================================================
// FILE UPLOAD
// =============================================================================

fileUploadButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;

  userData.file = file;
  previewContainer.innerHTML = "";

  const preview = document.createElement("div");
  preview.classList.add("file-preview");

  if (file.type.startsWith("image/")) {
    const imageURL = URL.createObjectURL(file);
    preview.innerHTML = `
      <img src="${imageURL}" alt="preview">
      <button class="remove-file"><i class="ri-close-line"></i></button>
    `;
  } else {
    preview.innerHTML = `
      <div style="height:100%;display:flex;align-items:center;justify-content:center;padding:8px;text-align:center;font-size:11px;">
        📄 ${file.name}
      </div>
      <button class="remove-file"><i class="ri-close-line"></i></button>
    `;
  }

  previewContainer.appendChild(preview);

  preview.querySelector(".remove-file").addEventListener("click", () => {
    userData.file = null;
    previewContainer.innerHTML = "";
    fileInput.value = "";
  });
});

// =============================================================================
// VOICE INPUT (MIC)
// =============================================================================

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = "en-US";

  micButton.addEventListener("click", () => {
    recognition.start();
    micButton.classList.add("active");
    micButton.innerHTML = `<i class="ri-mic-fill"></i>`;
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value += transcript;
    messageInput.style.height = "auto";
    messageInput.style.height = messageInput.scrollHeight + "px";
  };

  recognition.onend = () => {
    micButton.classList.remove("active");
    micButton.innerHTML = `<i class="ri-mic-2-fill"></i>`;
  };
} else {
  // Browser support নেই হলে mic button hide করো
  micButton.style.display = "none";
}

// =============================================================================
// GENERATE BOT RESPONSE
// =============================================================================

const generateBotResponse = async (incomingMessageDiv) => {
  const messageElement = incomingMessageDiv.querySelector(".message-text");

  // History তে user message যোগ করো
  conversationHistory.push({
    role: "user",
    content: userData.message || "(file sent)"
  });

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
       Authorization: `Bearer ${API_KEY}`,
        "Content-Type":   "application/json",
        "HTTP-Referer":   window.location.href,
        "X-Title":        "NeuralChat"
      },
      body: JSON.stringify({
        model: "openai/gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are NeuralChat, a helpful, friendly, and concise AI assistant. Respond clearly and naturally."
          },
          ...conversationHistory
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || "Something went wrong. Please try again.");
    }

    const apiResponseText = data.choices[0].message.content.trim();

    // History তে assistant reply যোগ করো
    conversationHistory.push({ role: "assistant", content: apiResponseText });

    // Render with basic markdown-like formatting
    messageElement.innerHTML = formatMessage(apiResponseText);

  } catch (error) {
    console.error(error);
    messageElement.innerHTML = `<span style="color:#ef4444;">⚠️ ${error.message}</span>`;
  } finally {
    incomingMessageDiv.classList.remove("thinking");
    scrollToBottom();
  }
};

// Basic text formatter (bold, code, line breaks)
const formatMessage = (text) => {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code style='background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;font-size:0.85em;'>$1</code>")
    .replace(/\n/g, "<br>");
};

// =============================================================================
// SEND MESSAGE
// =============================================================================

const handleOutgoingMessage = async (e) => {
  e.preventDefault();

  userData.message = messageInput.value.trim();
  if (!userData.message && !userData.file) return;

  // Build user message HTML
  let messageHTML = `<div class="message-text">${escapeHTML(userData.message)}</div>`;

  if (userData.file && userData.file.type.startsWith("image/")) {
    const imageURL = URL.createObjectURL(userData.file);
    messageHTML = `
      <div class="message-text">
        <img src="${imageURL}" style="max-width:200px;border-radius:12px;margin-bottom:8px;display:block;">
        <div>${escapeHTML(userData.message)}</div>
      </div>
    `;
  } else if (userData.file) {
    messageHTML = `
      <div class="message-text">
        <div style="padding:8px 12px;background:rgba(255,255,255,0.1);border-radius:10px;margin-bottom:8px;">
          📄 ${userData.file.name}
        </div>
        <div>${escapeHTML(userData.message)}</div>
      </div>
    `;
  }

  const outgoingDiv = createMessageElement(messageHTML, "user-message");
  chatBody.appendChild(outgoingDiv);
  scrollToBottom();

  // Reset inputs
  const savedMessage = userData.message;
  const savedFile    = userData.file;

  messageInput.value = "";
  messageInput.style.height = "auto";
  previewContainer.innerHTML = "";
  fileInput.value = "";
  userData.file = null;

  // Show typing indicator after short delay
  setTimeout(() => {
    const botHTML = `
      <div class="bot-avatar"><i class="ri-brain-2-fill"></i></div>
      <div class="message-text">
        <div class="thinking">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>
    `;
    const incomingDiv = createMessageElement(botHTML, "bot-message", "thinking");
    chatBody.appendChild(incomingDiv);
    scrollToBottom();

    generateBotResponse(incomingDiv);
  }, 500);
};

// XSS protection
const escapeHTML = (str) =>
  str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

// =============================================================================
// EVENT LISTENERS — SEND
// =============================================================================

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleOutgoingMessage(e);
  }
});

sendMessageButton.addEventListener("click", handleOutgoingMessage);
document.querySelector(".chat-form").addEventListener("submit", handleOutgoingMessage);

// =============================================================================
// SETTINGS PANEL
// =============================================================================

const settingsButton  = document.querySelector("#settings-button");
const settingsPanel   = document.querySelector(".settings-panel");
const closeSettings   = document.querySelector("#close-settings");

const newChatButton   = document.querySelector(".new-chat");
const darkModeBtn     = document.querySelector(".dark-mode-btn");
const lightModeBtn    = document.querySelector(".light-mode-btn");
const notificationBtn = document.querySelector(".notification-btn");
const voiceModeBtn    = document.querySelector(".voice-mode-btn");
const clearChatBtn    = document.querySelector(".clear-chat-btn");
const aboutAiBtn      = document.querySelector(".about-ai-btn");

// Open / close settings
settingsButton.addEventListener("click", () => settingsPanel.classList.add("active"));
closeSettings.addEventListener("click",  () => settingsPanel.classList.remove("active"));

// Close on backdrop click
settingsPanel.addEventListener("click", (e) => {
  if (e.target === settingsPanel) settingsPanel.classList.remove("active");
});

// =============================================================================
// NEW CHAT
// =============================================================================

const welcomeHTML = `
  <div class="bot-message">
    <div class="bot-avatar"><i class="ri-brain-2-fill"></i></div>
    <div class="message-text">
      Hey there! 👋<br>
      I'm <strong>NeuralChat</strong> — your AI assistant.<br>
      What can I help you with today?
    </div>
  </div>
`;

newChatButton.addEventListener("click", () => {
  chatBody.innerHTML = welcomeHTML;
  conversationHistory.length = 0; // history clear
  settingsPanel.classList.remove("active");
});

// =============================================================================
// DARK / LIGHT MODE  (saved to localStorage)
// =============================================================================

// Load saved theme
if (localStorage.getItem("theme") === "light") {
  document.body.classList.add("light-mode");
}

darkModeBtn.addEventListener("click", () => {
  document.body.classList.remove("light-mode");
  localStorage.setItem("theme", "dark");
});

lightModeBtn.addEventListener("click", () => {
  document.body.classList.add("light-mode");
  localStorage.setItem("theme", "light");
});

// =============================================================================
// NOTIFICATIONS TOGGLE
// =============================================================================

let notificationEnabled = true;
const notifBadge = notificationBtn.querySelector(".badge");

notificationBtn.addEventListener("click", () => {
  notificationEnabled = !notificationEnabled;
  notifBadge.textContent = notificationEnabled ? "ON" : "OFF";
  notifBadge.className = `badge ${notificationEnabled ? "badge-on" : "badge-off"}`;
});

// =============================================================================
// VOICE MODE TOGGLE
// =============================================================================

let voiceEnabled = true;
const voiceBadge = voiceModeBtn.querySelector(".badge");

voiceModeBtn.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  voiceBadge.textContent = voiceEnabled ? "ON" : "OFF";
  voiceBadge.className = `badge ${voiceEnabled ? "badge-on" : "badge-off"}`;
  micButton.style.display = voiceEnabled ? "" : "none";
});

// =============================================================================
// CLEAR CHATS
// =============================================================================

clearChatBtn.addEventListener("click", () => {
  if (confirm("Clear all chats?")) {
    chatBody.innerHTML = `
      <div class="bot-message">
        <div class="bot-avatar"><i class="ri-brain-2-fill"></i></div>
        <div class="message-text">Chats cleared ✅<br>Start a new conversation!</div>
      </div>
    `;
    conversationHistory.length = 0;
    settingsPanel.classList.remove("active");
  }
});

// =============================================================================
// ABOUT AI TOGGLE
// =============================================================================

aboutAiBtn.addEventListener("click", () => aboutAiBtn.classList.toggle("active"));