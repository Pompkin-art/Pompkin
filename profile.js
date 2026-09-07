import { supabase } from "./supabase.js";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
let user = null;
let profile = null;
let addresses = [];

const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));

function setMessage(id, text, type = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `auth-message ${type}`.trim();
  el.hidden = !text;
}

function nextUsernameDate(value) {
  if (!value) return "";
  const next = new Date(value).getTime() + 30 * 86400000;
  return new Date(next).toLocaleDateString("en-PH", {year:"numeric", month:"long", day:"numeric"});
}

async function loadProfile() {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Your profile could not be found. Please contact Pompkin.");
  profile = data;
}

async function loadAddresses() {
  const { data, error } = await supabase.from("pompkin_addresses").select("*").eq("user_id", user.id).order("is_primary", {ascending:false}).order("created_at", {ascending:true});
  if (error) throw error;
  addresses = data || [];
}

function renderAvatar() {
  const el = document.getElementById("profileAvatar");
  const url = profile?.avatar_url || user?.user_metadata?.avatar_url || "";
  const name = profile?.name || user?.user_metadata?.full_name || user?.email || "P";
  if (url) { el.innerHTML = `<img src="${esc(url)}" alt="Profile picture">`; el.classList.add("has-image"); }
  else { el.textContent = name.charAt(0).toUpperCase(); el.classList.remove("has-image"); }
}

function renderProfile() {
  const name = profile.name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Pompkin customer";
  document.getElementById("profileDisplayName").textContent = name;
  document.getElementById("profileEmail").textContent = user.email || "";
  document.getElementById("viewUsername").textContent = profile.username || "Not set";
  document.getElementById("viewName").textContent = name || "Not set";
  document.getElementById("viewBio").textContent = profile.bio || "No bio yet.";
  document.getElementById("viewPhone").textContent = profile.mobile_phone || "Not set";
  document.getElementById("profileUsername").value = profile.username || "";
  document.getElementById("profileBio").value = profile.bio || "";
  document.getElementById("profilePhone").value = profile.mobile_phone || "";
  const cooldown = document.getElementById("usernameCooldown");
  const input = document.getElementById("profileUsername");
  input.disabled = false;
  if (profile.username_changed_at) {
    const next = new Date(profile.username_changed_at).getTime() + 30 * 86400000;
    if (Date.now() < next) { input.disabled = true; cooldown.textContent = `You can change your username again on ${new Date(next).toLocaleDateString("en-PH", {year:"numeric",month:"long",day:"numeric"})}.`; }
    else cooldown.textContent = "You can change your username once every 30 days.";
  } else cooldown.textContent = "You can change your username once every 30 days.";
  renderAvatar();
}

function renderAddresses() {
  const list = document.getElementById("addressList");
  if (!addresses.length) {
    list.innerHTML = `<div class="saved-address-empty">No saved addresses yet. Add one and checkout will use it automatically.</div>`;
    return;
  }
  list.innerHTML = addresses.map(a => `
    <article class="saved-address-card">
      <div class="saved-address-main"><div class="saved-address-title"><strong>${esc(a.label)}</strong>${a.is_primary ? `<span class="primary-address-badge">Primary</span>` : ""}</div><p><strong>Recipient:</strong> ${esc(a.recipient_name || profile.name || "Not set")}</p><p>${esc(a.address_line1)}</p>${a.address_line2 ? `<p>${esc(a.address_line2)}</p>` : ""}<p>${esc(a.barangay)}, ${esc(a.city)}, ${esc(a.province)} ${esc(a.postal_code)}</p><p>${esc(a.country)}</p></div>
      <div class="saved-address-actions"><button class="button button-outline edit-address" data-id="${a.id}" type="button">Edit</button>${!a.is_primary ? `<button class="text-button set-primary-address" data-id="${a.id}" type="button">Make primary</button>` : ""}<button class="text-button delete-address" data-id="${a.id}" type="button">Delete</button></div>
    </article>`).join("");
}

function openProfileEditor() { document.getElementById("profileCard").hidden = true; document.getElementById("profileEditor").hidden = false; window.scrollTo({top:0,behavior:"smooth"}); }
function closeProfileEditor() { document.getElementById("profileEditor").hidden = true; document.getElementById("profileCard").hidden = false; setMessage("profileMessage", ""); }

function openAddressEditor(address = null) {
  document.getElementById("addressEditorTitle").textContent = address ? "Edit address" : "Add address";
  document.getElementById("addressId").value = address?.id || "";
  document.getElementById("recipientName").value = address?.recipient_name || profile?.name || "";
  document.getElementById("addressLabel").value = address?.label || "Home";
  document.getElementById("addressLine1").value = address?.address_line1 || "";
  document.getElementById("addressLine2").value = address?.address_line2 || "";
  document.getElementById("barangay").value = address?.barangay || "";
  document.getElementById("city").value = address?.city || "";
  document.getElementById("province").value = address?.province || "";
  document.getElementById("postalCode").value = address?.postal_code || "";
  document.getElementById("country").value = address?.country || "Philippines";
  document.getElementById("isPrimary").checked = Boolean(address?.is_primary || !addresses.length);
  document.getElementById("addressEditor").hidden = false;
  document.getElementById("profileCard").hidden = true;
  window.scrollTo({top:0,behavior:"smooth"});
}
function closeAddressEditor() { document.getElementById("addressEditor").hidden = true; document.getElementById("profileCard").hidden = false; setMessage("addressFormMessage", ""); }

async function saveProfile(event) {
  event.preventDefault();
  setMessage("profileMessage", "Saving changes…");
  const newUsername = document.getElementById("profileUsername").value.trim();
  const currentUsername = profile.username || "";
  if (newUsername !== currentUsername) {
    if (!newUsername) return setMessage("profileMessage", "Please choose a username.", "error");
    const { data, error } = await supabase.rpc("change_pompkin_username", { p_username: newUsername });
    if (error) return setMessage("profileMessage", error.message.replace(/^.*?: /, ""), "error");
    profile.username = data.username;
    await supabase.auth.updateUser({data:{username:data.username}});
  }
  const { data, error } = await supabase.from("profiles").update({bio:document.getElementById("profileBio").value.trim(), mobile_phone:document.getElementById("profilePhone").value.trim()}).eq("id", user.id).select("*").single();
  if (error) return setMessage("profileMessage", error.message, "error");
  profile = data;
  renderProfile();
  setMessage("profileMessage", "Profile updated.", "success");
  setTimeout(closeProfileEditor, 500);
}

async function saveAddress(event) {
  event.preventDefault();
  setMessage("addressFormMessage", "Saving address…");
  const id = document.getElementById("addressId").value;
  const payload = {user_id:user.id,recipient_name:document.getElementById("recipientName").value.trim(),label:document.getElementById("addressLabel").value.trim() || "Home",address_line1:document.getElementById("addressLine1").value.trim(),address_line2:document.getElementById("addressLine2").value.trim(),barangay:document.getElementById("barangay").value.trim(),city:document.getElementById("city").value.trim(),province:document.getElementById("province").value.trim(),postal_code:document.getElementById("postalCode").value.trim(),country:document.getElementById("country").value.trim() || "Philippines",is_primary:document.getElementById("isPrimary").checked};
  const required = [payload.recipient_name,payload.address_line1,payload.barangay,payload.city,payload.province,payload.postal_code,payload.country];
  if (required.some(v => !v)) return setMessage("addressFormMessage", "Please complete the delivery address fields.", "error");
  if (payload.is_primary) await supabase.from("pompkin_addresses").update({is_primary:false}).eq("user_id", user.id);
  let result;
  if (id) result = await supabase.from("pompkin_addresses").update(payload).eq("id",id).eq("user_id",user.id);
  else result = await supabase.from("pompkin_addresses").insert(payload);
  if (result.error) return setMessage("addressFormMessage", result.error.message, "error");
  await loadAddresses(); renderAddresses(); setMessage("addressMessage", "Address saved.", "success"); closeAddressEditor();
}

async function uploadAvatar(file) {
  if (!file) return;
  if (!["image/jpeg","image/png","image/webp"].includes(file.type)) return setMessage("profileMessage", "Please choose a JPG, PNG, or WebP image.", "error");
  if (file.size > AVATAR_MAX_BYTES) return setMessage("profileMessage", "That image is too large. Please choose an image under 5 MB.", "error");
  setMessage("profileMessage", "Uploading your profile picture…");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
  if (error) return setMessage("profileMessage", `Could not upload the picture: ${error.message}`, "error");
  const {data} = supabase.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?v=${Date.now()}`;
  const {error: profileError} = await supabase.from("profiles").update({avatar_url:url}).eq("id",user.id);
  if (profileError) return setMessage("profileMessage",profileError.message,"error");
  profile.avatar_url = url; await supabase.auth.updateUser({data:{avatar_url:url}}); renderAvatar(); setMessage("profileMessage","Profile picture updated.","success");
}

async function removeAvatar() { const {error}=await supabase.from("profiles").update({avatar_url:null}).eq("id",user.id); if(error)return setMessage("profileMessage",error.message,"error"); profile.avatar_url=null; await supabase.auth.updateUser({data:{avatar_url:null}}); renderAvatar(); setMessage("profileMessage","Profile picture removed.","success"); }

async function init() {
  const {data:{session}} = await supabase.auth.getSession();
  if (!session?.user) { localStorage.setItem("pompkin_auth_return","/Pompkin/profile.html"); location.href="login.html"; return; }
  user=session.user;
  try {
    await loadProfile();
    await loadAddresses();
    renderProfile(); renderAddresses();
    document.getElementById("profileCard").hidden=false;
    document.getElementById("editProfileButton").addEventListener("click",openProfileEditor);
    document.getElementById("cancelProfileEdit").addEventListener("click",closeProfileEditor);
    document.getElementById("profileForm").addEventListener("submit",saveProfile);
    document.getElementById("addAddressButton").addEventListener("click",()=>openAddressEditor());
    document.getElementById("cancelAddressEdit").addEventListener("click",closeAddressEditor);
    document.getElementById("addressForm").addEventListener("submit",saveAddress);
    document.getElementById("addressList").addEventListener("click",async e=>{
      const id=e.target.dataset.id; if(!id)return; const address=addresses.find(a=>a.id===id);
      if(e.target.classList.contains("edit-address")) openAddressEditor(address);
      if(e.target.classList.contains("set-primary-address")){const {error}=await supabase.from("pompkin_addresses").update({is_primary:false}).eq("user_id",user.id); if(!error) await supabase.from("pompkin_addresses").update({is_primary:true}).eq("id",id).eq("user_id",user.id); await loadAddresses(); renderAddresses();}
      if(e.target.classList.contains("delete-address")){if(!confirm("Delete this saved address?"))return; const {error}=await supabase.from("pompkin_addresses").delete().eq("id",id).eq("user_id",user.id); if(error)setMessage("addressMessage",error.message,"error"); else {await loadAddresses();renderAddresses();setMessage("addressMessage","Address deleted.","success");}}
    });
    document.getElementById("avatarInput").addEventListener("change",e=>uploadAvatar(e.target.files?.[0]));
    document.getElementById("removeAvatar").addEventListener("click",removeAvatar);
    document.getElementById("profileLogout").addEventListener("click",async()=>{await supabase.auth.signOut({scope:"local"});location.href="index.html";});
  } catch(error) { const note=document.getElementById("profileNote"); note.textContent=`We couldn't load your profile: ${error.message}`; note.hidden=false; }
}
init();
