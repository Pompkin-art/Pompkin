import { supabase } from "./supabase.js";

const BASKET_KEY = "pompkin_basket";
const products = {
  "pompkin-pack": { name: "Allynieva Pompkin Pack", price: 249 },
  "acrylic-cd-keychain": { name: "Acrylic CD Album Keychain with NFC", price: 170 },
  "sanlias-print": { name: "SanLias 4R Mini Art Print", price: 70 },
  "allynieva-sticker-sheet": { name: "Allynieva Sticker Sheet", price: 70 }
};


tipAmount?.addEventListener("input", () => {
  const value = Number(tipAmount.value);
  selectedTip = Number.isFinite(value) && value > 0 ? value : 0;
  renderSummary();
});


function money(value) { return "₱" + Number(value).toLocaleString("en-PH"); }
function loadBasket() { try { return JSON.parse(localStorage.getItem(BASKET_KEY) || "{}"); } catch { return {}; } }

let selectedTip = 0;

function updateTipUI(subtotal) {
  document.querySelectorAll("[data-tip]").forEach((button) => {
    button.classList.toggle("is-selected", Number(button.dataset.tip) === selectedTip);
  });
  const tipEl = document.getElementById("checkoutTip");
const tipAmount = document.getElementById("tipAmount");
  const totalEl = document.getElementById("checkoutTotal");
  if (tipEl) tipEl.textContent = money(selectedTip);
  if (totalEl) totalEl.textContent = money(subtotal + selectedTip);
}

async function initCheckout() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    localStorage.setItem("pompkin_auth_return", "/Pompkin/checkout.html");
    window.location.href = "login.html";
    return;
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  const phoneVerified = Boolean(profile?.mobile_verified && session.user.phone_confirmed_at);
  const addressComplete = Boolean(
    profile?.address_line1 && profile?.barangay && profile?.city &&
    profile?.province && profile?.postal_code && profile?.country
  );

  const gate = document.getElementById("checkoutProfileGate");
  if (!phoneVerified || !addressComplete) {
    gate.hidden = false;
    gate.innerHTML = `
      <p class="section-label">almost ready 𐙚</p>
      <h2>Complete your delivery details</h2>
      <p>Before you continue your order, please add a complete shipping address and verify your mobile number.</p>
      <div class="checkout-requirements">
        <div><strong>${phoneVerified ? "✓" : "○"}</strong><span>Verified mobile number</span></div>
        <div><strong>${addressComplete ? "✓" : "○"}</strong><span>Complete shipping address</span></div>
      </div>
      <a class="button button-orange" href="profile.html">Complete My Profile</a>
    `;
    document.getElementById("checkoutButton")?.setAttribute("disabled", "disabled");
  } else {
    gate.hidden = true;
  }

  const basket = loadBasket();
  const entries = Object.entries(basket).filter(([id, quantity]) => products[id] && quantity > 0);
  const items = document.getElementById("checkoutItems");
  const subtotal = entries.reduce((sum, [id, quantity]) => sum + products[id].price * quantity, 0);

  if (!entries.length) {
    items.innerHTML = '<p class="basket-empty">Your basket is empty. <a href="collection.html">Browse the collection</a>.</p>';
  } else {
    items.innerHTML = entries.map(([id, quantity]) =>
      `<div class="checkout-item"><div><strong>${products[id].name}</strong><span>${quantity} × ${money(products[id].price)}</span></div><strong>${money(products[id].price * quantity)}</strong></div>`
    ).join("");
  }

  document.getElementById("checkoutSubtotal").textContent = money(subtotal);
  updateTipUI(subtotal);
}

initCheckout();

document.querySelectorAll("[data-tip]").forEach((button) => {
  button.addEventListener("click", () => {
    selectedTip = Number(button.dataset.tip) || 0;
    const subtotal = Number((document.getElementById("checkoutSubtotal")?.textContent || "0").replace(/[^0-9.]/g, ""));
    updateTipUI(subtotal);
  });
});
