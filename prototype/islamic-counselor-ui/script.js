const assistantIconPath = "assets/tuxedo-cat.png";
const chatForm = document.getElementById("chatForm");
const chatBody = document.getElementById("chatBody");
const chatScroll = document.getElementById("chatScroll");
const messageInput = document.getElementById("messageInput");
const newChatButton = document.getElementById("newChatButton");
const promptButtons = document.querySelectorAll(".prompt-chip");

const starterMessages = [
  {
    role: "assistant",
    label: "Islamic Counselor",
    text: "Assalamu alaikum. I am here to listen and support you. What is on your heart today?",
  },
  {
    role: "user",
    label: "You",
    text: "I have been feeling overwhelmed and would like some advice.",
  },
  {
    role: "assistant",
    label: "Islamic Counselor",
    text: "We can take this one step at a time. Start with the part that feels heaviest, and we will reflect on it together with patience and clarity.",
  },
];

function resizeInput() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
}

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

function scrollChatToBottom() {
  window.requestAnimationFrame(() => {
    chatScroll.scrollTop = chatScroll.scrollHeight;
  });
}

function appendMessage(role, text, label) {
  chatBody.appendChild(createMessage(role, text, label));
  scrollChatToBottom();
}

function resetConversation() {
  chatBody.replaceChildren();

  starterMessages.forEach(({ role, text, label }) => {
    chatBody.appendChild(createMessage(role, text, label));
  });

  messageInput.value = "";
  resizeInput();
  chatScroll.scrollTo({ top: 0, behavior: "smooth" });
}

function buildReply(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("overwhelmed") || lowerPrompt.includes("stress")) {
    return "Take a gentle pause and breathe. Let us begin with one worry instead of all of them at once, then focus on what you can respond to today with steadiness.";
  }

  if (lowerPrompt.includes("salah") || lowerPrompt.includes("pray")) {
    return "If salah has been feeling difficult, it may help to return through one prayer at a time, with sincerity rather than pressure. We can also talk about what has been making it feel heavy lately.";
  }

  if (lowerPrompt.includes("family") || lowerPrompt.includes("conflict")) {
    return "In moments of family tension, a calm response is often built before the conversation begins. We can think through what to say, what to avoid, and how to protect your adab while still being honest.";
  }

  return "Thank you for sharing that. I am here with you, and we can talk through it carefully with patience, sincerity, and hope.";
}

function submitPrompt(text) {
  const trimmed = text.trim();

  if (!trimmed) {
    return;
  }

  appendMessage("user", trimmed, "You");
  messageInput.value = "";
  resizeInput();

  const typingIndicator = createTypingIndicator();
  chatBody.appendChild(typingIndicator);
  scrollChatToBottom();

  window.setTimeout(() => {
    typingIndicator.remove();
    appendMessage("assistant", buildReply(trimmed), "Islamic Counselor");
  }, 650);
}

messageInput.addEventListener("input", resizeInput);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitPrompt(messageInput.value);
});

newChatButton.addEventListener("click", resetConversation);

promptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    submitPrompt(button.dataset.prompt || button.textContent || "");
  });
});

resetConversation();
