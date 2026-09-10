import { supabase } from "./supabase.js";

const adminLoading = document.getElementById("adminLoading");
const adminDenied = document.getElementById("adminDenied");
const adminApp = document.getElementById("adminApp");
const adminLogout = document.getElementById("adminLogout");

async function initAdmin() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const { data: isAdmin, error } = await supabase.rpc("is_pompkin_admin");

  if (error || !isAdmin) {
    adminLoading.hidden = true;
    adminDenied.hidden = false;
    return;
  }

  adminLoading.hidden = true;
  adminApp.hidden = false;
}

adminLogout?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "index.html";
});

initAdmin();
