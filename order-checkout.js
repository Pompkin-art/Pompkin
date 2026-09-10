import { supabase } from "./supabase.js";

const BASKET_KEY = "pompkin_basket";

const products = {
  "pompkin-pack": {
    name: "Allynieva Pompkin Pack",
    price: 249,
    weight: 100
  },
  "acrylic-cd-keychain": {
    name: "Acrylic CD Album Keychain with NFC",
    price: 170,
    weight: 35
  },
  "sanlias-print": {
    name: "SanLias 4R Mini Art Print",
    price: 70,
    weight: 20
  },
  "allynieva-sticker-sheet": {
    name: "Allynieva Sticker Sheet",
    price: 70,
    weight: 15
  }
};

const money = v =>
  "₱" + Math.max(0, Number(v) || 0).toLocaleString("en-PH");

let subtotal = 0;
let shipping = 0;
let tip = 0;
let profile = null;
let session = null;
let addresses = [];
let selectedAddress = null;

const basket = () => {
  try {
    return JSON.parse(localStorage.getItem(BASKET_KEY) || "{}");
  } catch {
    return {};
  }
};

function msg(text, type = "info") {
  const el = document.getElementById("checkoutMessage");
  el.hidden = !text;
  el.className = `checkout-message ${type}`;
  el.textContent = text;
}

function summary() {
  const subtotalBeforeShipping = Math.max(0, subtotal + tip);

  document.getElementById("checkoutShipping").textContent =
    shipping ? money(shipping) : "To be calculated";

  document.getElementById("checkoutTip").textContent =
    money(tip);

  document.getElementById("checkoutTotal").textContent =
    money(subtotalBeforeShipping);
}

function renderItems() {
  const entries = Object.entries(basket()).filter(
    ([id, q]) => products[id] && Number(q) > 0
  );

  const el = document.getElementById("checkoutItems");

  if (!entries.length) {
    el.innerHTML =
      '<p class="basket-empty">Your basket is empty. <a href="collection.html">Browse the collection</a>.</p>';

    document.getElementById("checkoutButton").disabled = true;
    return;
  }

  subtotal = entries.reduce(
    (s, [id, q]) => s + products[id].price * Number(q),
    0
  );

  el.innerHTML = entries
    .map(
      ([id, q]) => `
        <div class="dedicated-checkout-item">
          <div>
            <strong>${products[id].name}</strong>
            <span>${q} × ${money(products[id].price)}</span>
          </div>

          <strong>
            ${money(products[id].price * Number(q))}
          </strong>
        </div>
      `
    )
    .join("");

  summary();
}

function renderAddresses() {
  const box = document.getElementById("addressChooser");

  if (!addresses.length) {
    box.innerHTML = "";
    document.getElementById("noAddress").hidden = false;
    document.getElementById("checkoutButton").disabled = true;
    return;
  }

  document.getElementById("noAddress").hidden = true;

  const primary =
    addresses.find(a => a.is_primary) || addresses[0];

  selectedAddress =
    selectedAddress &&
    addresses.some(a => a.id === selectedAddress.id)
      ? selectedAddress
      : primary;

  box.innerHTML = `
    <div class="checkout-address-picker">

      <div class="checkout-address-picker-label">
        SAVED ADDRESS
      </div>

      <div class="checkout-address-picker-row">

        <label
          class="checkout-address-select-wrap"
          for="savedAddressSelect"
        >

          <span class="checkout-address-icon">⌂</span>

          <span class="checkout-address-select-text">

            <strong>
              ${selectedAddress.address_label || "Saved address"}
              ${
                selectedAddress.is_primary
                  ? " — Primary"
                  : ""
              }
            </strong>

            <small>
              ${selectedAddress.recipient_name || "Recipient"}
              ·
              ${
                selectedAddress.mobile_number ||
                "Mobile not set"
              }
            </small>

          </span>

          <span class="checkout-address-chevron">
            ⌄
          </span>

          <select
            id="savedAddressSelect"
            aria-label="Choose saved address"
          >
            ${addresses
              .map(
                a => `
                  <option
                    value="${a.id}"
                    ${
                      a.id === selectedAddress.id
                        ? "selected"
                        : ""
                    }
                  >
                    ${a.address_label || "Saved address"}${
                  a.is_primary ? " — Primary" : ""
                }
                  </option>
                `
              )
              .join("")}
          </select>

        </label>

        <a
          class="checkout-manage-addresses"
          href="profile.html"
        >
          Manage addresses
        </a>

      </div>

    </div>
  `;

  document
    .getElementById("savedAddressSelect")
    .addEventListener("change", e => {
      selectedAddress =
        addresses.find(
          a => a.id === e.target.value
        ) || primary;

      renderAddresses();
      renderAddressPreview();
    });

  renderAddressPreview();
}

function renderAddressPreview() {
  if (!selectedAddress) return;

  const a = selectedAddress;

  const preview =
    document.getElementById("checkoutProfilePreview");

  preview.hidden = false;

  preview.innerHTML = `
    <article class="checkout-selected-address">

      <div class="checkout-selected-address-header">

        <div class="checkout-selected-address-name">

          <span class="checkout-address-circle">
            ⌂
          </span>

          <strong>
            ${a.address_label || "Saved address"}
          </strong>

          ${
            a.is_primary
              ? `<span class="primary-address-badge">Primary</span>`
              : ""
          }

        </div>

        <a
          href="profile.html"
          class="checkout-change-address"
        >
          Change address
        </a>

      </div>

      <div class="checkout-address-info">

        <div>
          <span class="checkout-info-icon">♙</span>
          <span class="checkout-info-label">
            Recipient
          </span>
          <strong>
            ${a.recipient_name || "Not set"}
          </strong>
        </div>

        <div>
          <span class="checkout-info-icon">⌕</span>
          <span class="checkout-info-label">
            Mobile
          </span>
          <strong>
            ${a.mobile_number || "Not set"}
          </strong>
        </div>

        <div class="checkout-address-full">
          <span class="checkout-info-icon">⌖</span>
          <span class="checkout-info-label">
            Delivery address
          </span>
          <strong>
            ${
              a.full_address ||
              "No delivery address saved."
            }
          </strong>
        </div>

      </div>

    </article>
  `;
}

async function loadData() {
  const [
    { data: p, error: pe },
    { data: a, error: ae }
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle(),

    supabase
      .from("pompkin_addresses")
      .select("*")
      .eq("user_id", session.user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true })
  ]);

  if (pe) throw pe;
  if (ae) throw ae;

  profile = p || {};
  addresses = a || [];
}

async function submitOrder() {
  if (!selectedAddress) {
    msg(
      "Please add a complete delivery address in your profile first.",
      "error"
    );
    return;
  }

  const name = selectedAddress.recipient_name || "";
  const phone = selectedAddress.mobile_number || "";

  if (!name) {
    msg(
      "Please add a recipient name to the selected delivery address first.",
      "error"
    );
    return;
  }

  if (!selectedAddress.full_address) {
    msg(
      "Please add a complete delivery address to the selected address first.",
      "error"
    );
    return;
  }

  const entries = Object.entries(basket()).filter(
    ([id, q]) => products[id] && Number(q) > 0
  );

  if (!entries.length) {
    msg("Your basket is empty.", "error");
    return;
  }

  const button =
    document.getElementById("checkoutButton");

  button.disabled = true;

  msg("Submitting your order…");

  const orderPayload = {
    user_id: session.user.id,
    recipient_name: name,
    customer_mobile: phone,
    shipping_address: selectedAddress.full_address,
    subtotal,
    shipping_fee: null,
    coffee_amount: tip,
    total: null,
    status: "pending",
    payment_status: "pending",
    tracking_number: null
  };

  const {
    data: order,
    error: orderError
  } = await supabase
    .from("pompkin_orders")
    .insert(orderPayload)
    .select("*")
    .single();

  if (orderError) {
    button.disabled = false;

    msg(
      `We couldn't submit the order yet: ${orderError.message}`,
      "error"
    );

    return;
  }

  const itemRows = entries.map(([id, q]) => ({
    order_id: order.id,
    product_name: products[id].name,
    unit_price: products[id].price,
    quantity: Number(q),
    subtotal:
      products[id].price * Number(q)
  }));

  const { error: itemError } = await supabase
    .from("pompkin_order_items")
    .insert(itemRows);

  if (itemError) {
    await supabase
      .from("pompkin_orders")
      .delete()
      .eq("id", order.id);

    button.disabled = false;

    msg(
      `We couldn't save the order items: ${itemError.message}`,
      "error"
    );

    return;
  }

  localStorage.removeItem(BASKET_KEY);

  localStorage.setItem(
    "pompkin_last_order_id",
    order.id
  );

  location.href =
    `order-confirmation.html?order=${encodeURIComponent(
      order.id
    )}`;
}

document
  .getElementById("tipAmount")
  .addEventListener("input", e => {
    const n = Number(e.target.value);

    tip =
      Number.isFinite(n) && n > 0
        ? n
        : 0;

    summary();
  });

document
  .getElementById("checkoutButton")
  .addEventListener("click", submitOrder);

async function init() {
  const {
    data: { session: s }
  } = await supabase.auth.getSession();

  session = s;

  if (!session) {
    localStorage.setItem(
      "pompkin_auth_return",
      "/Pompkin/order-checkout.html"
    );

    location.href = "login.html";
    return;
  }

  try {
    await loadData();
    renderItems();
    renderAddresses();
  } catch (e) {
    msg(
      `We couldn't load your saved checkout information: ${e.message}`,
      "error"
    );
  }
}

init();
