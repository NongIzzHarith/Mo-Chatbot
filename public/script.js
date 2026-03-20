// ─── Constants & DOM refs ────────────────────────────────────────────────────

const API_BASE = "";
const assistantIconPath = "assets/tuxedo-cat.png";

const chatForm = document.getElementById("chatForm");
const chatBody = document.getElementById("chatBody");
const chatScroll = document.getElementById("chatScroll");
const messageInput = document.getElementById("messageInput");
const newChatButton = document.getElementById("newChatButton");
const promptButtons = document.querySelectorAll(".prompt-chip");

// ─── App state ────────────────────────────────────────────────────────────────

let currentUserId = null;
let currentDisplayName = null;
let currentConversationId = null;
let isSending = false;

// ─── Identity ─────────────────────────────────────────────────────────────────

function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function loadIdentity() {
  currentUserId = localStorage.getItem("mo_user_id");
  currentDisplayName = localStorage.getItem("mo_display_name");
  return currentUserId !== null && currentDisplayName !== null;
}

function saveIdentity(userId, displayName) {
  currentUserId = userId;
  currentDisplayName = displayName;
  localStorage.setItem("mo_user_id", userId);
  localStorage.setItem("mo_display_name", displayName);
}

// ─── API layer ────────────────────────────────────────────────────────────────

async function apiPost(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw { message: error.error || "Request failed", status: response.status };
  }
  return response.json();
}

async function apiGet(path) {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw { message: error.error || "Request failed", status: response.status };
  }
  return response.json();
}

async function sendChatMessage({ text, conversationId }) {
  return apiPost("/v1/chat/message", {
    conversationId: conversationId || undefined,
    userId: currentUserId,
    displayName: currentDisplayName,
    locale: (navigator.language || "en").slice(0, 2),
    text,
  });
}

async function fetchConversationMessages(conversationId) {
  return apiGet(`/v1/chat/${conversationId}/messages`);
}

async function fetchUserConversations() {
  return apiGet(`/v1/users/${currentUserId}/conversations`);
}

async function forgetConversation(conversationId) {
  return apiPost(`/v1/chat/${conversationId}/forget`, { deleteMemory: true });
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
}

function scrollChatToBottom() {
  window.requestAnimationFrame(() => {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  });
}

function setComposerDisabled(disabled) {
  messageInput.disabled = disabled;
  const sendBtn = chatForm.querySelector("button[type='submit']");
  if (sendBtn) sendBtn.disabled = disabled;
}

function showWelcomeState() {
  const welcomeBanner = chatScroll.querySelector(".welcome-banner");
  const promptRow = chatScroll.querySelector(".prompt-row");
  const divider = chatScroll.querySelector(".thread-divider");
  if (welcomeBanner) welcomeBanner.hidden = false;
  if (promptRow) promptRow.hidden = false;
  if (divider) divider.hidden = false;
}

function hideWelcomeState() {
  const welcomeBanner = chatScroll.querySelector(".welcome-banner");
  const promptRow = chatScroll.querySelector(".prompt-row");
  const divider = chatScroll.querySelector(".thread-divider");
  if (welcomeBanner) welcomeBanner.hidden = true;
  if (promptRow) promptRow.hidden = true;
  if (divider) divider.hidden = true;
}

function showReferralBanner() {
  const banner = document.getElementById("referralBanner");
  if (banner) banner.hidden = false;
}

function hideReferralBanner() {
  const banner = document.getElementById("referralBanner");
  if (banner) banner.hidden = true;
}

// ─── Message rendering ────────────────────────────────────────────────────────

function createAvatar(role) {
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";

  if (role === "assistant") {
    const image = document.createElement("img");
    image.src = assistantIconPath;
    image.alt = "";
    avatar.appendChild(image);
    return avatar;
  }

  avatar.textContent = "You";
  return avatar;
}

function createMessage(role, text, label) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const name = document.createElement("span");
  name.className = "message-name";
  name.textContent = label;

  const content = document.createElement("p");
  content.textContent = text;

  bubble.append(name, content);
  article.append(createAvatar(role), bubble);

  return article;
}

function createTypingIndicator() {
  const article = document.createElement("article");
  article.className = "message assistant";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";

  const name = document.createElement("span");
  name.className = "message-name";
  name.textContent = "Islamic Counselor";

  const dots = document.createElement("div");
  dots.className = "typing-bubble";

  for (let index = 0; index < 3; index += 1) {
    dots.appendChild(document.createElement("span"));
  }

  bubble.append(name, dots);
  article.append(createAvatar("assistant"), bubble);

  return article;
}

function createCitationsBlock(citations) {
  const details = document.createElement("details");
  details.className = "citations-block";

  const summary = document.createElement("summary");
  summary.textContent = `${citations.length} source${citations.length !== 1 ? "s" : ""}`;

  const list = document.createElement("ul");
  list.className = "citations-list";

  citations.forEach((citation) => {
    const item = document.createElement("li");

    if (citation.sourceUrl) {
      const link = document.createElement("a");
      link.href = citation.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = citation.sourceTitle;
      item.appendChild(link);
    } else {
      item.textContent = citation.sourceTitle;
    }

    if (citation.excerpt) {
      const excerpt = document.createElement("p");
      excerpt.className = "citation-excerpt";
      excerpt.textContent = citation.excerpt;
      item.appendChild(excerpt);
    }

    list.appendChild(item);
  });

  details.append(summary, list);
  return details;
}

function appendMessage(role, text, label) {
  chatBody.appendChild(createMessage(role, text, label));
  scrollChatToBottom();
}

function appendAssistantResponse(data) {
  const article = createMessage("assistant", data.reply, "Islamic Counselor");
  const bubble = article.querySelector(".message-bubble");

  if (data.nextStep) {
    const hint = document.createElement("div");
    hint.className = "next-step-hint";
    hint.textContent = data.nextStep;
    bubble.appendChild(hint);
  }

  if (data.citations && data.citations.length > 0) {
    bubble.appendChild(createCitationsBlock(data.citations));
  }

  chatBody.appendChild(article);
  scrollChatToBottom();

  if (data.requiresScholarReferral) {
    showReferralBanner();
  }
}

function appendErrorMessage(error) {
  const text =
    !error.status || error.status === 0
      ? "Connection lost. Please check your internet and try again."
      : "Something went wrong. Please try again in a moment.";
  appendMessage("assistant", text, "Islamic Counselor");
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
}

function createThreadCard(conversation) {
  const article = document.createElement("article");
  article.className = "thread-card";
  article.dataset.conversationId = conversation.id;

  const title = document.createElement("span");
  title.className = "thread-title";
  title.textContent = conversation.title || "Untitled conversation";

  const time = document.createElement("span");
  time.className = "thread-time";
  time.textContent = formatRelativeTime(conversation.lastMessageAt);

  const forgetBtn = document.createElement("button");
  forgetBtn.type = "button";
  forgetBtn.className = "thread-forget-btn";
  forgetBtn.textContent = "Forget";
  forgetBtn.setAttribute("aria-label", `Forget: ${title.textContent}`);
  forgetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleForgetConversation(conversation.id);
  });

  article.append(title, time, forgetBtn);

  article.addEventListener("click", () => {
    handleLoadConversation(conversation.id);
  });

  return article;
}

function setActiveSidebarThread(conversationId) {
  document.querySelectorAll(".thread-card").forEach((card) => {
    card.classList.toggle(
      "active-thread",
      card.dataset.conversationId === conversationId
    );
  });
}

async function loadSidebar() {
  const sidebarSection = document.querySelector(".sidebar-section");
  if (!sidebarSection) return;

  sidebarSection
    .querySelectorAll(".thread-card, .sidebar-empty")
    .forEach((el) => el.remove());

  try {
    const data = await fetchUserConversations();
    const conversations = data.conversations || [];

    if (conversations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "sidebar-empty";
      empty.textContent = "No past conversations yet.";
      sidebarSection.appendChild(empty);
      return;
    }

    conversations.forEach((conv) => {
      const card = createThreadCard(conv);
      if (conv.id === currentConversationId) {
        card.classList.add("active-thread");
      }
      sidebarSection.appendChild(card);
    });
  } catch (error) {
    console.error("Failed to load sidebar:", error.message);
  }
}

// ─── Action handlers ──────────────────────────────────────────────────────────

async function handleSendMessage(text) {
  if (isSending) return;

  const trimmed = text.trim();
  if (!trimmed) return;

  isSending = true;
  hideWelcomeState();
  appendMessage("user", trimmed, currentDisplayName || "You");
  messageInput.value = "";
  resizeInput();
  setComposerDisabled(true);

  const typingIndicator = createTypingIndicator();
  chatBody.appendChild(typingIndicator);
  scrollChatToBottom();

  try {
    const data = await sendChatMessage({
      text: trimmed,
      conversationId: currentConversationId,
    });

    currentConversationId = data.conversationId;
    typingIndicator.remove();
    appendAssistantResponse(data);

    await loadSidebar();
    setActiveSidebarThread(currentConversationId);
  } catch (error) {
    typingIndicator.remove();
    appendErrorMessage(error);
  } finally {
    isSending = false;
    setComposerDisabled(false);
    messageInput.focus();
  }
}

async function handleNewConversation() {
  currentConversationId = null;
  chatBody.replaceChildren();
  hideReferralBanner();
  setActiveSidebarThread(null);
  showWelcomeState();
  messageInput.value = "";
  resizeInput();
  messageInput.focus();
}

async function handleLoadConversation(conversationId) {
  if (conversationId === currentConversationId) return;

  currentConversationId = conversationId;
  setActiveSidebarThread(conversationId);
  chatBody.replaceChildren();
  hideReferralBanner();
  hideWelcomeState();

  try {
    const data = await fetchConversationMessages(conversationId);
    const messages = data.messages || [];

    if (messages.length === 0) {
      showWelcomeState();
      return;
    }

    messages.forEach((msg) => {
      if (msg.role === "user") {
        appendMessage("user", msg.body, currentDisplayName || "You");
      } else if (msg.role === "assistant") {
        appendAssistantResponse({
          reply: msg.body,
          nextStep: null,
          citations: msg.citations || [],
          riskLevel: msg.riskLevel,
          requiresScholarReferral: false,
        });
      }
    });

    scrollChatToBottom();
  } catch (error) {
    appendErrorMessage(error);
  }
}

async function handleForgetConversation(conversationId) {
  const confirmed = window.confirm(
    "Remove this conversation and its memory? This cannot be undone."
  );
  if (!confirmed) return;

  try {
    await forgetConversation(conversationId);

    if (conversationId === currentConversationId) {
      await handleNewConversation();
    }

    await loadSidebar();
  } catch (error) {
    console.error("Failed to forget conversation:", error.message);
  }
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

function showOnboarding() {
  const overlay = document.getElementById("onboardingOverlay");
  if (overlay) {
    overlay.hidden = false;
    const nameInput = document.getElementById("nameInput");
    if (nameInput) nameInput.focus();
  }
}

function hideOnboarding() {
  const overlay = document.getElementById("onboardingOverlay");
  if (overlay) overlay.hidden = true;
}

const onboardingForm = document.getElementById("onboardingForm");
if (onboardingForm) {
  onboardingForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameInput = document.getElementById("nameInput");
    const name = nameInput ? nameInput.value.trim() : "";
    if (!name) return;

    const newUserId = generateUUID();
    saveIdentity(newUserId, name);
    hideOnboarding();
    initApp();
  });
}

// ─── App init ─────────────────────────────────────────────────────────────────

async function initApp() {
  hideReferralBanner();

  const hasIdentity = loadIdentity();
  if (!hasIdentity) {
    showOnboarding();
    return;
  }

  showWelcomeState();
  await loadSidebar();

  if (!chatForm.dataset.initialized) {
    chatForm.dataset.initialized = "true";

    chatForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleSendMessage(messageInput.value);
    });

    messageInput.addEventListener("input", resizeInput);
    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
      }
    });

    newChatButton.addEventListener("click", handleNewConversation);

    promptButtons.forEach((button) => {
      button.addEventListener("click", () => {
        handleSendMessage(button.dataset.prompt || button.textContent || "");
      });
    });

    const referralDismiss = document.getElementById("referralDismiss");
    if (referralDismiss) {
      referralDismiss.addEventListener("click", hideReferralBanner);
    }
  }
}

initApp();
