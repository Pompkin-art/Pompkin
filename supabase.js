import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://fzveisahdgjjzahylkid.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Srn-iAZb3T_XA_lSUrSEIg_ocRZdXBl";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const redirectUrl = "https://pompkin-art.github.io/Pompkin/index.html";
const SAVED_USERNAME_KEY = "pompkin_saved_login_username";
const AUTH_RETURN_KEY = "pompkin_auth_return";

function getDisplayName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.username || user?.email?.split("@")[0] || "Pompkin customer";
}

function getUsername(user) {
  return user?.user_metadata?.username || "";
}

function setAuthMessage(message, type = "") {
  const el = document.getElementById("authMessage");
  if (!el) return;
  el.textContent = message;
  el.className = `auth-message ${type}`.trim();
  el.hidden = !message;
}

function setAuthReturn(path) {
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return;
    localStorage.setItem(AUTH_RETURN_KEY, url.pathname + url.search + url.hash);
  } catch {
    localStorage.removeItem(AUTH_RETURN_KEY);
  }
}

function getAuthReturn() {
  const saved = localStorage.getItem(AUTH_RETURN_KEY);
  if (!saved) return "";
  try {
    const url = new URL(saved, window.location.origin);
    if (url.origin !== window.location.origin) return "";
    return url.pathname + url.search + url.hash;
  } catch {
    return "";
  }
}

function goAfterAuth() {
  const target = getAuthReturn();
  localStorage.removeItem(AUTH_RETURN_KEY);
  window.location.href = target || redirectUrl;
}

function updateAccountLinks(user) {
  document.querySelectorAll("[data-account-links]").forEach((container) => {
    if (user) {
      const avatarUrl = user?.user_metadata?.avatar_url || "";
      const displayName = getDisplayName(user);
      container.innerHTML = `
        <a href="profile.html" class="account-profile-link" aria-label="Open your profile">
          <span class="nav-avatar">${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="">` : escapeHtml(displayName.charAt(0).toUpperCase())}</span>
          <span class="nav-username">${escapeHtml(getUsername(user) || displayName)}</span>
        </a>
        <button type="button" class="signup-link logout-button" data-logout>Log Out</button>
      `;
      container.querySelector("[data-logout]")?.addEventListener("click", async () => {
        const button = container.querySelector("[data-logout]");
        if (button) button.disabled = true;
        await supabase.auth.signOut({ scope: "local" });
        updateAccountLinks(null);
        window.location.href = "index.html";
      });
    } else {
      container.innerHTML = `
        <a href="login.html" class="login-link">Log In</a>
        <a href="signup.html" class="signup-link">Create Account</a>
      `;
    }
  });
}

function updatePasswordChecklist(password = "") {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };

  document.querySelectorAll("[data-password-check]").forEach((item) => {
    const key = item.getAttribute("data-password-check");
    const satisfied = Boolean(checks[key]);
    item.classList.toggle("is-satisfied", satisfied);
    item.setAttribute("aria-checked", String(satisfied));
  });

  return Object.values(checks).every(Boolean);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  }[char]));
}

async function handleGoogle() {
  setAuthMessage("Opening Google sign-in…");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: redirectUrl }
  });
  if (error) setAuthMessage(error.message, "error");
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value;
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  setAuthMessage("Logging you in…");

  const remember = form.elements.namedItem("remember-login")?.checked;
  if (remember) localStorage.setItem(SAVED_USERNAME_KEY, username);
  else localStorage.removeItem(SAVED_USERNAME_KEY);

  const { data, error } = await supabase.functions.invoke("login-with-username", {
    body: { username, password }
  });
  button.disabled = false;

  if (error || !data?.session) {
    setAuthMessage(data?.error || error?.message || "Invalid username or password.", "error");
    return;
  }

  const { error: sessionError } = await supabase.auth.setSession(data.session);
  if (sessionError) {
    setAuthMessage(sessionError.message, "error");
    return;
  }
  goAfterAuth();
}

async function handleSignup(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;
  const confirmPassword = form["confirm-password"].value;
  const button = form.querySelector("button[type=submit]");
  const passwordIsValid = updatePasswordChecklist(password);

  if (password !== confirmPassword) {
    setAuthMessage("Your passwords do not match.", "error");
    return;
  }
  if (!passwordIsValid) {
    setAuthMessage("Password must be at least 8 characters and include 1 uppercase letter, 1 number, and 1 special character.", "error");
    return;
  }
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) {
    setAuthMessage("Username must be 3–24 characters using only letters, numbers, or underscores.", "error");
    return;
  }

  button.disabled = true;
  setAuthMessage("Creating your Pompkin account…");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name: name },
      emailRedirectTo: redirectUrl
    }
  });
  button.disabled = false;

  if (error) {
    setAuthMessage(error.message, "error");
    return;
  }

  if (data.session) {
    goAfterAuth();
  } else {
    setAuthMessage("Account created! Check your email to confirm your account, then log in.", "success");
    form.reset();
  }
}

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  updateAccountLinks(session?.user ?? null);

  const loginForm = document.querySelector("[data-login-form]");
  const savedUsername = localStorage.getItem(SAVED_USERNAME_KEY);
  if (loginForm && savedUsername) {
    const usernameField = loginForm.elements.namedItem("username");
    const rememberField = loginForm.elements.namedItem("remember-login");
    if (usernameField) usernameField.value = savedUsername;
    if (rememberField) rememberField.checked = true;
  }

  const savedSession = document.querySelector("[data-saved-session]");
  if (savedSession && session?.user) {
    const name = getDisplayName(session.user);
    savedSession.innerHTML = `You're already signed in as <strong>${escapeHtml(name)}</strong>.<br><a class="button button-outline auth-continue" href="index.html">Continue to Pompkin</a>`;
    savedSession.hidden = false;
  }

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  const returnTarget = getAuthReturn();
  if (session && (currentPage === "login.html" || currentPage === "signup.html") && returnTarget) {
    goAfterAuth();
    return;
  }
  if (session && currentPage === "index.html" && returnTarget) {
    goAfterAuth();
    return;
  }

  supabase.auth.onAuthStateChange((_event, newSession) => {
    updateAccountLinks(newSession?.user ?? null);
  });

  document.querySelectorAll("[data-google-login]").forEach((button) => {
    button.addEventListener("click", handleGoogle);
  });
  document.querySelector("[data-login-form]")?.addEventListener("submit", handleLogin);
  const signupForm = document.querySelector("[data-signup-form]");
  signupForm?.addEventListener("submit", handleSignup);
  signupForm?.elements.namedItem("password")?.addEventListener("input", (event) => {
    updatePasswordChecklist(event.target.value);
  });
  updatePasswordChecklist(signupForm?.elements.namedItem("password")?.value || "");

  window.pompkinAuth = {
    supabase,
    setAuthReturn,
    getAuthReturn,
    getSession: () => supabase.auth.getSession(),
    getUser: () => supabase.auth.getUser(),
    getDisplayName,
    getUsername,
    goAfterAuth
  };
}

initAuth();
