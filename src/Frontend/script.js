/* global marked, DOMPurify */
const USE_LOCAL_PYTHON_BACKEND = true;
const API_BASE = "http://localhost:8000/api";

// --- 1. AUTHENTICATION LOGIC ---

// Check if user is already logged in on page load
window.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("cognistream_token");
  const userName = localStorage.getItem("cognistream_user");

  if (token) {
    document.getElementById("auth-modal").style.display = "none";
    document.getElementById("user-display-name").textContent =
      userName || "User";
    // Note: We will fetch the user's specific history here in the next phase!
  }
});

// Toggle between Login and Register forms
function toggleAuthMode() {
  const loginSec = document.getElementById("login-section");
  const regSec = document.getElementById("register-section");
  loginSec.classList.toggle("hidden");
  regSec.classList.toggle("hidden");
}

// Handle Registration
document
  .getElementById("register-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.innerHTML = "Registering...";
    btn.disabled = true;

    const payload = {
      name: document.getElementById("reg-name").value,
      email: document.getElementById("reg-email").value,
      country: document.getElementById("reg-country").value,
      password: document.getElementById("reg-password").value,
    };

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");

      alert("Registration successful! Please log in.");
      toggleAuthMode();
    } catch (err) {
      alert(err.message);
    } finally {
      btn.innerHTML = "Register";
      btn.disabled = false;
    }
  });

// Handle Login
document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector("button");
  btn.innerHTML = "Logging in...";
  btn.disabled = true;

  const payload = {
    email: document.getElementById("login-email").value,
    password: document.getElementById("login-password").value,
  };

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");

    // Save the secure token and name to the browser's memory
    localStorage.setItem("cognistream_token", data.access_token);
    localStorage.setItem("cognistream_user", data.name);

    // Hide modal and update UI
    document.getElementById("auth-modal").style.display = "none";
    document.getElementById("user-display-name").textContent = data.name;

    // Clear inputs
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
  } catch (err) {
    alert(err.message);
  } finally {
    btn.innerHTML = "Log In";
    btn.disabled = false;
  }
});

// Handle Logout
function logout() {
  localStorage.removeItem("cognistream_token");
  localStorage.removeItem("cognistream_user");
  window.location.reload(); // Reloads the page to show the login modal again
}

let conversationHistory = [];
let currentSessionId = crypto.randomUUID();

const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const overlay = document.getElementById("sidebar-overlay");

// --- Initialization ---
window.onload = () => {
  loadSidebarHistory();

  // Set initial toggle state based on screen size
  const sidebar = document.getElementById("sidebar");
  const mainToggleBtn = document.getElementById("main-toggle-btn");

  if (window.innerWidth < 768) {
    sidebar.classList.add("-translate-x-full");
    mainToggleBtn.classList.remove("hidden");
    mainToggleBtn.classList.add("flex");
  } else {
    sidebar.classList.remove("hidden");
    sidebar.classList.remove("-translate-x-full");
    mainToggleBtn.classList.add("hidden");
    mainToggleBtn.classList.remove("flex");
  }
};

// --- Master Sidebar Toggle Logic ---
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const mainToggleBtn = document.getElementById("main-toggle-btn");
  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    sidebar.classList.toggle("-translate-x-full");
    if (sidebar.classList.contains("-translate-x-full")) {
      mainToggleBtn.classList.remove("hidden");
      mainToggleBtn.classList.add("flex");
      overlay.classList.add("hidden");
    } else {
      mainToggleBtn.classList.add("hidden");
      mainToggleBtn.classList.remove("flex");
      overlay.classList.remove("hidden");
    }
  } else {
    sidebar.classList.toggle("hidden");
    if (sidebar.classList.contains("hidden")) {
      mainToggleBtn.classList.remove("hidden");
      mainToggleBtn.classList.add("flex");
    } else {
      mainToggleBtn.classList.add("hidden");
      mainToggleBtn.classList.remove("flex");
    }
  }
}

// --- New Chat (Triggered by CogniStream AI Header Click) ---
function startNewChat() {
  currentSessionId = crypto.randomUUID();
  conversationHistory = [];

  chatContainer.innerHTML = `
                <div id="welcome-screen" class="flex-1 flex flex-col items-center justify-center text-center px-4 msg-enter h-full pb-[15vh]">
                    <h2 class="text-[32px] sm:text-[36px] font-semibold text-white tracking-tight">How can I assist you today?</h2>
                </div>
            `;

  const sidebar = document.getElementById("sidebar");
  if (
    window.innerWidth < 768 &&
    !sidebar.classList.contains("-translate-x-full")
  ) {
    toggleSidebar();
  }
}

// --- Fetch and Display Chat History ---
async function loadSidebarHistory() {
  const historyList = document.getElementById("history-list");
  try {
    const token = localStorage.getItem("cognistream_token");
    const response = await fetch(`${API_BASE}/sessions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error("Network response was not ok");
    const sessions = await response.json();

    historyList.innerHTML = "";

    sessions.forEach((session) => {
      // Create a wrapper div to hold both the chat name and the delete button
      const wrapper = document.createElement("div");
      wrapper.className =
        "group flex items-center justify-between w-full hover:bg-[#2f2f2f] rounded-lg transition-colors pr-2";

      const btn = document.createElement("button");
      btn.className =
        "flex-1 text-left px-3 py-2.5 text-sm text-[#ececec] truncate flex items-center gap-3";
      btn.innerHTML = `<svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg> <span class="truncate">${session.title}</span>`;
      btn.onclick = () => loadPastChat(session.session_id);

      // Create the trash can delete button (hidden until hover)
      const deleteBtn = document.createElement("button");
      deleteBtn.className =
        "opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 p-1 rounded transition-all";
      deleteBtn.title = "Delete Chat";
      deleteBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
      deleteBtn.onclick = (e) => {
        e.stopPropagation(); // Stops the click from also opening the chat
        deleteChat(session.session_id);
      };

      wrapper.appendChild(btn);
      wrapper.appendChild(deleteBtn);
      historyList.appendChild(wrapper);
    });
  } catch (e) {
    console.log("Could not load history. Local backend might be offline.");
    historyList.innerHTML = `
                    <div class="text-xs text-slate-400 p-3 text-center rounded-lg bg-[#2f2f2f] mt-2">
                        Backend Offline<br/><span class="text-[10px] text-slate-500">Ensure app.py is running</span>
                    </div>`;
  }
}

// --- Delete a Chat Session ---
async function deleteChat(sessionId) {
  if (!confirm("Are you sure you want to delete this chat?")) return;

  try {
    const token = localStorage.getItem("cognistream_token");
    const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error("Failed to delete");

    // If you delete the chat you are currently looking at, reset to the welcome screen
    if (currentSessionId === sessionId) {
      startNewChat();
    } else {
      // Otherwise, just refresh the sidebar silently
      loadSidebarHistory();
    }
  } catch (e) {
    console.log("Could not delete chat. Backend might be offline.");
    alert("Failed to delete chat. Ensure backend is running.");
  }
}

// --- Load a Past Chat ---
async function loadPastChat(sessionId) {
  currentSessionId = sessionId;
  conversationHistory = [];

  try {
    const token = localStorage.getItem("cognistream_token");
    const response = await fetch(`${API_BASE}/history/${sessionId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error("Network response was not ok");
    const messages = await response.json();

    chatContainer.innerHTML = "";

    messages.forEach((msg) => {
      conversationHistory.push({ role: msg.role, content: msg.content });

      if (msg.role === "user") {
        appendUserMessage(msg.content);
      } else {
        const id = appendBotMessageContainer();
        const safeHtml = DOMPurify.sanitize(marked.parse(msg.content));
        document.getElementById(id).innerHTML = safeHtml;

        const actionContainer = document.getElementById(`actions-${id}`);
        if (actionContainer) {
          actionContainer.classList.remove("hidden");
          actionContainer.dataset.text = msg.content;
        }
      }
    });

    const sidebar = document.getElementById("sidebar");
    if (
      window.innerWidth < 768 &&
      !sidebar.classList.contains("-translate-x-full")
    ) {
      toggleSidebar();
    }
    scrollToBottom();
  } catch (e) {
    console.log("Could not load past chat. Backend might be offline.");
  }
}

// --- Core UI Functions ---
userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height =
    (this.scrollHeight < 128 ? this.scrollHeight : 128) + "px";
});

userInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage().catch(console.error);
  }
});

sendBtn.addEventListener("click", () => sendMessage().catch(console.error));

function hideWelcomeScreen() {
  const welcome = document.getElementById("welcome-screen");
  if (welcome) welcome.remove();
}

function appendUserMessage(text) {
  hideWelcomeScreen();
  const html = `<div class="flex justify-end msg-enter mb-6"><div class="bg-[#2f2f2f] text-white rounded-3xl px-5 py-3 max-w-[85%] sm:max-w-[70%]"><p class="text-sm sm:text-base whitespace-pre-wrap leading-relaxed">${text}</p></div></div>`;
  chatContainer.insertAdjacentHTML("beforeend", html);
  scrollToBottom();
}

function appendBotMessageContainer() {
  hideWelcomeScreen();
  const id = "bot-msg-" + Date.now();
  const html = `
                <div id="container-${id}" class="flex gap-4 w-full max-w-4xl mx-auto msg-enter mb-8">
                    <div class="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0 mt-0.5 bg-white">
                        <img src="../Assets/CogniStream.svg" class="w-5 h-5 object-contain" alt="Logo">
                    </div>
                    <div class="flex-1 overflow-hidden flex flex-col">
                        <div id="${id}" class="markdown-content text-sm sm:text-base leading-relaxed text-[#ececec]">
                            <div class="flex space-x-1.5 items-center h-6 mt-1">
                                <div class="w-2 h-2 bg-slate-400 rounded-full typing-dot"></div>
                                <div class="w-2 h-2 bg-slate-400 rounded-full typing-dot"></div>
                                <div class="w-2 h-2 bg-slate-400 rounded-full typing-dot"></div>
                            </div>
                        </div>
                        <div id="actions-${id}" class="mt-2 hidden">
                            <button onclick="playTTS('${id}')" class="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-medium bg-[#2f2f2f] px-3 py-1.5 rounded-md w-max">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10v4a2 2 0 002 2h2.586l3.707 3.707A.996.996 0 0015 19V5a.996.996 0 00-1.707-.707L9.586 8H7a2 2 0 00-2 2z"></path></svg>
                                <span class="btn-text">Read Aloud</span>
                            </button>
                        </div>
                    </div>
                </div>`;
  chatContainer.insertAdjacentHTML("beforeend", html);
  scrollToBottom();
  return id;
}

function scrollToBottom() {
  chatContainer.scrollTo({
    top: chatContainer.scrollHeight,
    behavior: "smooth",
  });
}

// --- Main Chat Logic ---
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = "";
  userInput.style.height = "auto";
  appendUserMessage(text);
  const responseElementId = appendBotMessageContainer();

  try {
    const token = localStorage.getItem("cognistream_token");

    // 1. SETUP ROUTING: Detect if user typed the /image command
    let apiUrl = `${API_BASE}/chat`;
    let requestBody = {
      message: text,
      history: conversationHistory,
      session_id: currentSessionId,
    };

    const isImageRequest = text.toLowerCase().startsWith("/image ");
    if (isImageRequest) {
      apiUrl = `${API_BASE}/generate-image`;
      requestBody = {
        prompt: text.substring(7).trim(), // Strip away the "/image " part
        session_id: currentSessionId,
      };
    }

    // 2. FETCH DATA
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    const botResponseText = data.reply;

    // 3. PROTECT TEXT AI: Don't feed base64 images back into the text model's memory
    if (!isImageRequest) {
      conversationHistory.push({ role: "user", content: text });
      conversationHistory.push({ role: "model", content: botResponseText });
    }

    // 4. RENDER UI
    const safeHtml = DOMPurify.sanitize(marked.parse(botResponseText));
    document.getElementById(responseElementId).innerHTML = safeHtml;

    // 5. HIDE TTS FOR IMAGES
    const actionContainer = document.getElementById(
      `actions-${responseElementId}`,
    );
    if (actionContainer) {
      if (isImageRequest || botResponseText.startsWith("![Generated Image]")) {
        actionContainer.classList.add("hidden");
      } else {
        actionContainer.classList.remove("hidden");
        actionContainer.dataset.text = botResponseText;
      }
    }

    if (conversationHistory.length === 2 && !isImageRequest) {
      setTimeout(loadSidebarHistory, 1500);
    }
  } catch (error) {
    console.log("Chat failed. Backend might be offline.", error);
    document.getElementById(responseElementId).innerHTML =
      `<span class="text-red-400">Error: High traffic or backend offline. Message not saved.</span>`;
  }
  scrollToBottom();
}

// --- TTS Functionality (Streaming & Queueing) ---
let currentAudioSource = null;
let currentlyPlayingButton = null;
let ttsSessionToken = 0; // Unique ID to track start/stop clicks and prevent ghost audio

async function playTTS(id) {
  const actionContainer = document.getElementById(`actions-${id}`);
  const btn = actionContainer.querySelector("button");
  const textSpan = btn.querySelector(".btn-text");

  const originalText = "Read Aloud";
  const originalIcon = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5 10v4a2 2 0 002 2h2.586l3.707 3.707A.996.996 0 0015 19V5a.996.996 0 00-1.707-.707L9.586 8H7a2 2 0 00-2 2z"></path></svg>`;

  // Helper to reset the button UI cleanly
  function resetButton(targetBtn) {
    targetBtn.dataset.isPlaying = "false";
    targetBtn.innerHTML =
      originalIcon + `<span class="btn-text">${originalText}</span>`;
    targetBtn.classList.remove(
      "text-red-400",
      "hover:text-red-300",
      "bg-red-500/10",
      "animate-pulse",
    );
    targetBtn.disabled = false;
  }

  // 1. STOP LOGIC: If currently playing or loading, kill the session
  if (btn.dataset.isPlaying === "true" || btn.dataset.isPlaying === "loading") {
    ttsSessionToken++; // Invalidate current loop
    if (currentAudioSource) {
      try {
        currentAudioSource.stop();
      } catch (e) {}
      currentAudioSource = null;
    }
    resetButton(btn);
    currentlyPlayingButton = null;
    return;
  }

  // Stop any OTHER audio that might be playing in another chat bubble
  ttsSessionToken++;
  const myToken = ttsSessionToken; // Lock this specific execution thread
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {}
    currentAudioSource = null;
  }
  if (currentlyPlayingButton && currentlyPlayingButton !== btn) {
    resetButton(currentlyPlayingButton);
  }

  // 2. CHUNK TEXT INTO SENTENCES (Keeps punctuation for natural pauses)
  let cleanText = actionContainer.dataset.text.replace(/[#*`_]/g, "");
  // Split by . ! or ?
  let sentences = cleanText.match(/[^.!?]+[.!?]+/g);
  if (!sentences) sentences = [cleanText]; // Fallback if no punctuation exists
  sentences = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

  if (sentences.length === 0) return;

  // 3. UI SETUP (Loading State)
  btn.dataset.isPlaying = "loading";
  currentlyPlayingButton = btn;
  btn.classList.add("text-red-400", "hover:text-red-300", "bg-red-500/10");
  btn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> <span class="btn-text">Queueing...</span>`;

  // 4. PRE-FETCH QUEUE LOGIC
  let fetchQueue = new Array(sentences.length).fill(null);

  async function fetchAudioChunk(index) {
    if (ttsSessionToken !== myToken) return null; // Abort if user clicked Stop
    if (fetchQueue[index]) return fetchQueue[index]; // Skip if already downloading

    const token = localStorage.getItem("cognistream_token");
    let promise = fetch(`${API_BASE}/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sentences[index] }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("API Error");
        const data = await res.json();
        return data.candidates[0].content.parts[0].inlineData.data;
      })
      .catch((e) => null); // If a single sentence fails, return null so we can skip it

    fetchQueue[index] = promise;
    return promise;
  }

  // 5. THE PLAYBACK LOOP
  try {
    // Immediately ask backend for Sentence 1
    fetchAudioChunk(0);

    for (let i = 0; i < sentences.length; i++) {
      if (ttsSessionToken !== myToken) break; // Check if user clicked Stop

      // Secretly pre-fetch the NEXT sentence while dealing with current one
      if (i + 1 < sentences.length) {
        fetchAudioChunk(i + 1);
      }

      // Await the backend response for the current sentence
      let base64 = await fetchQueue[i];

      if (ttsSessionToken !== myToken) break;
      if (!base64) continue; // If network hiccup on this specific chunk, skip to next sentence

      // Once the first audio chunk is ready, change UI from "Queueing" to "Stop Audio"
      if (i === 0) {
        btn.dataset.isPlaying = "true";
        btn.innerHTML = `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"></path></svg> <span class="btn-text">Stop Audio</span>`;
      }

      // Play the audio chunk and await its completion before looping
      await new Promise((resolve) => {
        try {
          const binary = atob(base64);
          const buffer = new ArrayBuffer(binary.length);
          const bytes = new Uint8Array(buffer);
          for (let j = 0; j < binary.length; j++)
            bytes[j] = binary.charCodeAt(j);

          const audioCtx = new (
            window.AudioContext || window.webkitAudioContext
          )();
          const dataView = new DataView(buffer);
          const floats = new Float32Array(bytes.length / 2);
          for (let j = 0; j < floats.length; j++)
            floats[j] = dataView.getInt16(j * 2, true) / 32768;

          const audioBuffer = audioCtx.createBuffer(1, floats.length, 24000);
          audioBuffer.getChannelData(0).set(floats);
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);
          currentAudioSource = source;

          // When this sentence finishes playing, resolve the promise to move to the next loop iteration
          source.onended = () => {
            currentAudioSource = null;
            resolve();
          };
          source.start();
        } catch (err) {
          console.log("Chunk playback failed", err);
          resolve(); // Resolve anyway so loop continues to next sentence
        }
      });
    }
  } catch (e) {
    console.log("Streaming TTS Error:", e);
  } finally {
    // When the entire paragraph is done reading naturally, reset the button
    if (ttsSessionToken === myToken) {
      resetButton(btn);
      currentlyPlayingButton = null;
    }
  }
}
