import { supabase } from "./supabase.js";

const CUSTOM_DRAFT_KEY = "pompkin_custom_booking_draft_v2";
const modal = document.querySelector("[data-custom-modal]");
const form = document.querySelector("[data-custom-form]");
const draftNote = document.querySelector("[data-draft-note]");
const message = document.getElementById("customFormMessage");
const serviceField = document.getElementById("custom-service");

function getFormData() {
  return form ? Object.fromEntries(new FormData(form).entries()) : {};
}

function saveDraft() {
  if (!form) return;
  localStorage.setItem(CUSTOM_DRAFT_KEY, JSON.stringify({ ...getFormData(), savedAt: Date.now() }));
  if (draftNote) draftNote.textContent = "Draft saved automatically on this device.";
}

function loadDraft() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_DRAFT_KEY) || "null"); }
  catch { return null; }
}

function restoreDraft() {
  const draft = loadDraft();
  if (!draft) return;
  Object.entries(draft).forEach(([name, value]) => {
    if (name === "savedAt") return;
    const field = form?.elements.namedItem(name);
    if (field && typeof value === "string") field.value = value;
  });
  if (draftNote) draftNote.textContent = "Your saved draft has been restored.";
}

async function requireAccount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    localStorage.setItem("pompkin_auth_return", "/Pompkin/custom.html");
    window.location.href = "login.html";
    return null;
  }
  return session.user;
}

async function openModal(service) {
  const user = await requireAccount();
  if (!user || !modal || !form) return;
  restoreDraft();
  if (service) serviceField.value = service;
  modal.hidden = false;
  document.body.classList.add("modal-open");
  serviceField.focus();
}

function closeModal() {
  if (!modal) return;
  saveDraft();
  modal.hidden = true;
  document.body.classList.remove("modal-open");
}

document.querySelectorAll("[data-book-now]").forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.bookNow));
});

document.querySelector("[data-close-custom]")?.addEventListener("click", closeModal);
modal?.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal && !modal.hidden) closeModal();
});
form?.addEventListener("input", saveDraft);
form?.addEventListener("change", saveDraft);

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const user = await requireAccount();
  if (!user) return;
  saveDraft();
  if (!message) return;
  message.hidden = false;
  message.className = "auth-message success";
  message.textContent = "Your commission request is saved to your draft. We can connect final submission to your Pompkin order system next.";
});

document.querySelector("[data-clear-custom]")?.addEventListener("click", () => {
  localStorage.removeItem(CUSTOM_DRAFT_KEY);
  form?.reset();
  if (draftNote) draftNote.textContent = "Saved draft cleared.";
  if (message) message.hidden = true;
});
