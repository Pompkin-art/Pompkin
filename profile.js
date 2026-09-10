import { supabase } from "./supabase.js";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

let user = null;
let profile = null;
let addresses = [];

/* -----------------------------
   Helpers
----------------------------- */

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;"
      })[char]
  );

function msg(id, text, type = "") {
  const element = document.getElementById(id);

  if (!element) return;

  element.textContent = text;
  element.className = `auth-message ${type}`.trim();
  element.hidden = !text;
}

function fullName() {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Pompkin customer"
  );
}

function candidate() {
  let username = (
    user?.user_metadata?.username ||
    user?.email?.split("@")[0] ||
    "pompkin_user"
  )
    .replace(/[^A-Za-z0-9_]/g, "_")
    .slice(0, 24);

  return username.length >= 3 ? username : "pompkin_user";
}

/* -----------------------------
   Profile
----------------------------- */

async function ensureProfile() {
  let result = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  if (result.data) {
    profile = result.data;
    return;
  }

  let username = candidate();

  const existing = await supabase
    .from("profiles")
    .select("username")
    .eq("username", username)
    .maybeSingle();

  if (existing.data) {
    username =
      `${username.slice(0, 18)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  result = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      username,
      full_name: fullName(),
      email: user.email || null,
      bio: "",
      mobile_number: ""
    })
    .select("*")
    .single();

  if (result.error) {
    const retry = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (retry.error || !retry.data) {
      throw result.error;
    }

    profile = retry.data;
  } else {
    profile = result.data;
  }
}

/* -----------------------------
   Addresses
----------------------------- */

async function loadAddresses() {
  const result = await supabase
    .from("pompkin_addresses")
    .select("*")
    .eq("user_id", user.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  addresses = result.data || [];
}

/* -----------------------------
   Rendering
----------------------------- */

function renderAvatar() {
  const element = document.getElementById("profileAvatar");

  if (!element) return;

  const url =
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    "";

  const name = profile?.full_name || fullName();

  if (url) {
    element.innerHTML = `
      <img
        src="${esc(url)}"
        alt="Profile picture"
      >
    `;

    element.classList.add("has-image");
  } else {
    element.textContent = name.charAt(0).toUpperCase();
    element.classList.remove("has-image");
  }
}

function renderProfile() {
  const name = profile?.full_name || fullName();

  document.getElementById("profileDisplayName").textContent = name;

  document.getElementById("profileEmail").textContent =
    profile?.email ||
    user?.email ||
    "";

  document.getElementById("viewUsername").textContent =
    profile?.username ||
    "Not set";

  document.getElementById("viewName").textContent = name;

  document.getElementById("viewBio").textContent =
    profile?.bio ||
    "No bio yet.";

  document.getElementById("viewPhone").textContent =
    profile?.mobile_number ||
    "Not set";

  document.getElementById("profileUsername").value =
    profile?.username ||
    "";

  document.getElementById("profileBio").value =
    profile?.bio ||
    "";

  document.getElementById("profilePhone").value =
    profile?.mobile_number ||
    "";

  const usernameInput =
    document.getElementById("profileUsername");

  const cooldown =
    document.getElementById("usernameCooldown");

  usernameInput.disabled = false;

  if (profile?.username_changed_at) {
    const nextChange =
      new Date(profile.username_changed_at).getTime() +
      30 * 86400000;

    if (Date.now() < nextChange) {
      usernameInput.disabled = true;

      cooldown.textContent =
        `You can change your username again on ${
          new Date(nextChange).toLocaleDateString(
            "en-PH",
            {
              year: "numeric",
              month: "long",
              day: "numeric"
            }
          )
        }.`;
    } else {
      cooldown.textContent =
        "You can change your username once every 30 days.";
    }
  } else {
    cooldown.textContent =
      "You can change your username once every 30 days.";
  }

  renderAvatar();
}

function renderAddresses() {
  const list = document.getElementById("addressList");

  if (!list) return;

  if (!addresses.length) {
    list.innerHTML = `
      <div class="saved-address-empty">
        No saved addresses yet.
        Add one and checkout will use it automatically.
      </div>
    `;

    return;
  }

  list.innerHTML = addresses
    .map(
      (address) => `
        <article class="saved-address-card">

          <div class="saved-address-main">

            <div class="saved-address-title">
              <strong>
                ${esc(address.address_label || "Address")}
              </strong>

              ${
                address.is_primary
                  ? `
                    <span class="primary-address-badge">
                      Primary
                    </span>
                  `
                  : ""
              }
            </div>

            <p>
              <strong>Recipient:</strong>
              ${esc(
                address.recipient_name ||
                profile?.full_name ||
                "Not set"
              )}
            </p>

            <p>
              <strong>Mobile:</strong>
              ${esc(address.mobile || "Not set")}
            </p>

            <p>
              ${esc(address.full_address || "")}
            </p>

          </div>

          <div class="saved-address-actions">

            <button
              class="button button-outline edit-address"
              data-id="${address.id}"
              type="button"
            >
              Edit
            </button>

            ${
              !address.is_primary
                ? `
                  <button
                    class="text-button set-primary-address"
                    data-id="${address.id}"
                    type="button"
                  >
                    Make primary
                  </button>
                `
                : ""
            }

            <button
              class="text-button delete-address"
              data-id="${address.id}"
              type="button"
            >
              Delete
            </button>

          </div>

        </article>
      `
    )
    .join("");
}

/* -----------------------------
   Profile editor
----------------------------- */

function openProfileEditor() {
  document.getElementById("profileCard").hidden = true;
  document.getElementById("profileEditor").hidden = false;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function closeProfileEditor() {
  document.getElementById("profileEditor").hidden = true;
  document.getElementById("profileCard").hidden = false;

  msg("profileMessage", "");
}

/* -----------------------------
   Address editor
----------------------------- */

function openAddressEditor(address = null) {
  document.getElementById("addressEditorTitle").textContent =
    address ? "Edit address" : "Add address";

  document.getElementById("addressId").value =
    address?.id || "";

  document.getElementById("recipientName").value =
    address?.recipient_name ||
    profile?.full_name ||
    "";

  document.getElementById("addressLabel").value =
    address?.address_label ||
    "Home";

  document.getElementById("addressMobile").value =
    address?.mobile ||
    profile?.mobile_number ||
    "";

  document.getElementById("fullAddress").value =
    address?.full_address ||
    "";

  document.getElementById("isPrimary").checked =
    Boolean(address?.is_primary || !addresses.length);

  document.getElementById("addressEditor").hidden = false;
  document.getElementById("profileCard").hidden = true;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function closeAddressEditor() {
  document.getElementById("addressEditor").hidden = true;
  document.getElementById("profileCard").hidden = false;

  msg("addressFormMessage", "");
}

/* -----------------------------
   Save profile
----------------------------- */

async function saveProfile(event) {
  event.preventDefault();

  msg("profileMessage", "Saving changes…");

  const newUsername =
    document
      .getElementById("profileUsername")
      .value
      .trim();

  if (newUsername !== profile.username) {
    if (!newUsername) {
      msg(
        "profileMessage",
        "Please choose a username.",
        "error"
      );

      return;
    }

    const result = await supabase.rpc(
      "change_pompkin_username",
      {
        p_username: newUsername
      }
    );

    if (result.error) {
      msg(
        "profileMessage",
        result.error.message.replace(/^.*?: /, ""),
        "error"
      );

      return;
    }

    profile.username = result.data.username;

    await supabase.auth.updateUser({
      data: {
        username: result.data.username
      }
    });
  }

  const result = await supabase
    .from("profiles")
    .update({
      bio: document
        .getElementById("profileBio")
        .value
        .trim(),

      mobile_number: document
        .getElementById("profilePhone")
        .value
        .trim(),

      email: user.email || profile.email || null
    })
    .eq("id", user.id)
    .select("*")
    .single();

  if (result.error) {
    msg(
      "profileMessage",
      result.error.message,
      "error"
    );

    return;
  }

  profile = result.data;

  renderProfile();

  msg(
    "profileMessage",
    "Profile updated.",
    "success"
  );

  setTimeout(closeProfileEditor, 500);
}

/* -----------------------------
   Save address
----------------------------- */

async function saveAddress(event) {
  event.preventDefault();

  msg(
    "addressFormMessage",
    "Saving address…"
  );

  const id =
    document.getElementById("addressId").value;

  const address = {
    user_id: user.id,

    recipient_name:
      document
        .getElementById("recipientName")
        .value
        .trim(),

    address_label:
      document
        .getElementById("addressLabel")
        .value
        .trim() || "Home",

    mobile:
      document
        .getElementById("addressMobile")
        .value
        .trim(),

    full_address:
      document
        .getElementById("fullAddress")
        .value
        .trim(),

    is_primary:
      document.getElementById("isPrimary").checked
  };

  if (
    !address.recipient_name ||
    !address.mobile ||
    !address.full_address
  ) {
    msg(
      "addressFormMessage",
      "Please complete the delivery address fields.",
      "error"
    );

    return;
  }

  if (address.is_primary) {
    const result = await supabase
      .from("pompkin_addresses")
      .update({
        is_primary: false
      })
      .eq("user_id", user.id);

    if (result.error) {
      msg(
        "addressFormMessage",
        result.error.message,
        "error"
      );

      return;
    }
  }

  let result;

  if (id) {
    result = await supabase
      .from("pompkin_addresses")
      .update(address)
      .eq("id", id)
      .eq("user_id", user.id);
  } else {
    result = await supabase
      .from("pompkin_addresses")
      .insert(address);
  }

  if (result.error) {
    msg(
      "addressFormMessage",
      result.error.message,
      "error"
    );

    return;
  }

  await loadAddresses();
  renderAddresses();

  msg(
    "addressMessage",
    "Address saved.",
    "success"
  );

  closeAddressEditor();
}

/* -----------------------------
   Avatar
----------------------------- */

async function uploadAvatar(file) {
  if (!file) return;

  if (
    ![
      "image/jpeg",
      "image/png",
      "image/webp"
    ].includes(file.type)
  ) {
    msg(
      "profileMessage",
      "Please choose a JPG, PNG, or WebP image.",
      "error"
    );

    return;
  }

  if (file.size > AVATAR_MAX_BYTES) {
    msg(
      "profileMessage",
      "That image is too large. Please choose an image under 5 MB.",
      "error"
    );

    return;
  }

  msg(
    "profileMessage",
    "Uploading your profile picture…"
  );

  const extension =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : "jpg";

  const path =
    `${user.id}/avatar.${extension}`;

  const result = await supabase.storage
    .from("avatars")
    .upload(
      path,
      file,
      {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600"
      }
    );

  if (result.error) {
    msg(
      "profileMessage",
      `Could not upload the picture: ${result.error.message}`,
      "error"
    );

    return;
  }

  const { data } =
    supabase.storage
      .from("avatars")
      .getPublicUrl(path);

  const url =
    `${data.publicUrl}?v=${Date.now()}`;

  const profileResult = await supabase
    .from("profiles")
    .update({
      avatar_url: url
    })
    .eq("id", user.id);

  if (profileResult.error) {
    msg(
      "profileMessage",
      profileResult.error.message,
      "error"
    );

    return;
  }

  profile.avatar_url = url;

  await supabase.auth.updateUser({
    data: {
      avatar_url: url
    }
  });

  renderAvatar();

  msg(
    "profileMessage",
    "Profile picture updated.",
    "success"
  );
}

async function removeAvatar() {
  const result = await supabase
    .from("profiles")
    .update({
      avatar_url: null
    })
    .eq("id", user.id);

  if (result.error) {
    msg(
      "profileMessage",
      result.error.message,
      "error"
    );

    return;
  }

  profile.avatar_url = null;

  await supabase.auth.updateUser({
    data: {
      avatar_url: null
    }
  });

  renderAvatar();

  msg(
    "profileMessage",
    "Profile picture removed.",
    "success"
  );
}

/* -----------------------------
   Event listeners
----------------------------- */

function setupEventListeners() {
  document
    .getElementById("editProfileButton")
    .addEventListener(
      "click",
      openProfileEditor
    );

  document
    .getElementById("cancelProfileEdit")
    .addEventListener(
      "click",
      closeProfileEditor
    );

  document
    .getElementById("profileForm")
    .addEventListener(
      "submit",
      saveProfile
    );

  document
    .getElementById("addAddressButton")
    .addEventListener(
      "click",
      () => openAddressEditor()
    );

  document
    .getElementById("cancelAddressEdit")
    .addEventListener(
      "click",
      closeAddressEditor
    );

  document
    .getElementById("addressForm")
    .addEventListener(
      "submit",
      saveAddress
    );

  document
    .getElementById("addressList")
    .addEventListener(
      "click",
      handleAddressActions
    );

  document
    .getElementById("avatarInput")
    .addEventListener(
      "change",
      (event) => {
        uploadAvatar(
          event.target.files?.[0]
        );
      }
    );

  document
    .getElementById("removeAvatar")
    .addEventListener(
      "click",
      removeAvatar
    );

  document
    .getElementById("profileLogout")
    .addEventListener(
      "click",
      async () => {
        await supabase.auth.signOut({
          scope: "local"
        });

        location.href = "index.html";
      }
    );
}

/* -----------------------------
   Address actions
----------------------------- */

async function handleAddressActions(event) {
  const id = event.target.dataset.id;

  if (!id) return;

  const address =
    addresses.find(
      (item) => item.id === id
    );

  if (
    event.target.classList.contains(
      "edit-address"
    )
  ) {
    openAddressEditor(address);
    return;
  }

  if (
    event.target.classList.contains(
      "set-primary-address"
    )
  ) {
    const resetResult = await supabase
      .from("pompkin_addresses")
      .update({
        is_primary: false
      })
      .eq("user_id", user.id);

    if (resetResult.error) {
      msg(
        "addressMessage",
        resetResult.error.message,
        "error"
      );

      return;
    }

    const result = await supabase
      .from("pompkin_addresses")
      .update({
        is_primary: true
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (result.error) {
      msg(
        "addressMessage",
        result.error.message,
        "error"
      );

      return;
    }

    await loadAddresses();
    renderAddresses();

    return;
  }

  if (
    event.target.classList.contains(
      "delete-address"
    )
  ) {
    if (
      !confirm(
        "Delete this saved address?"
      )
    ) {
      return;
    }

    const result = await supabase
      .from("pompkin_addresses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (result.error) {
      msg(
        "addressMessage",
        result.error.message,
        "error"
      );

      return;
    }

    await loadAddresses();
    renderAddresses();

    msg(
      "addressMessage",
      "Address deleted.",
      "success"
    );
  }
}

/* -----------------------------
   Start page
----------------------------- */

async function init() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.user) {
    localStorage.setItem(
      "pompkin_auth_return",
      "/Pompkin/profile.html"
    );

    location.href = "login.html";

    return;
  }

  user = session.user;

  try {
    await ensureProfile();
    await loadAddresses();

    renderProfile();
    renderAddresses();

    document.getElementById(
      "profileCard"
    ).hidden = false;

    setupEventListeners();

  } catch (error) {
    console.error(
      "Pompkin profile error:",
      error
    );

    const note =
      document.getElementById(
        "profileNote"
      );

    note.textContent =
      `We couldn't load your profile: ${error.message}`;

    note.hidden = false;
  }
}

init();
