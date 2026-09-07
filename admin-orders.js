import { supabase } from "./supabase.js";

const ordersList = document.getElementById("ordersList");
const messageBox = document.getElementById("ordersMessage");
const refreshButton = document.getElementById("refreshOrders");
let activeFilter = "all";

const money = value => `₱${Number(value || 0).toFixed(2)}`;
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;","\"":"&quot;"}[c]));

function message(text, type = "info") {
  messageBox.hidden = false;
  messageBox.className = `admin-orders-message ${type}`;
  messageBox.textContent = text;
}

function filterMatches(order) {
  if (activeFilter === "all") return true;
  if (activeFilter === "pending") return !order.accepted_at;
  if (activeFilter === "accepted") return !!order.accepted_at && order.paymentStatus !== "paid";
  if (activeFilter === "paid") return order.paymentStatus === "paid";
  if (activeFilter === "completed") return order.status === "completed";
  return true;
}

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    location.href = "login.html?return=/Pompkin/admin-orders.html";
    return false;
  }
  const { data, error } = await supabase.rpc("is_pompkin_admin");
  if (error || !data) {
    ordersList.innerHTML = `<div class="admin-orders-empty">Admin access is required.</div>`;
    return false;
  }
  return true;
}

async function loadOrders() {
  ordersList.innerHTML = `<div class="admin-orders-loading">Loading orders...</div>`;
  const allowed = await requireAdmin();
  if (!allowed) return;

  const { data: orders, error } = await supabase
    .from("pompkin_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    ordersList.innerHTML = "";
    message(error.message, "error");
    return;
  }

  if (!orders?.length) {
    ordersList.innerHTML = `<div class="admin-orders-empty">No orders yet.</div>`;
    return;
  }

  const ids = orders.map(order => order.id);
  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase.from("pompkin_order_items").select("*").in("order_id", ids),
    supabase.from("pompkin_payments").select("*").in("order_id", ids).order("created_at", { ascending: false })
  ]);

  const itemMap = new Map();
  (items || []).forEach(item => {
    if (!itemMap.has(item.order_id)) itemMap.set(item.order_id, []);
    itemMap.get(item.order_id).push(item);
  });

  const paymentMap = new Map();
  (payments || []).forEach(payment => {
    if (!paymentMap.has(payment.order_id)) paymentMap.set(payment.order_id, payment);
  });

  orders.forEach(order => {
    order.items = itemMap.get(order.id) || [];
    order.payment = paymentMap.get(order.id) || null;
    order.paymentStatus = order.payment?.status || "not submitted";
  });

  render(orders.filter(filterMatches));
}

function render(orders) {
  if (!orders.length) {
    ordersList.innerHTML = `<div class="admin-orders-empty">No orders match this filter.</div>`;
    return;
  }

  ordersList.innerHTML = orders.map(order => {
    const itemRows = order.items.length
      ? order.items.map(item => `<div class="admin-order-item-row"><span>${esc(item.product_name || item.name || "Product")}</span><span>× ${Number(item.quantity || 1)}</span><strong>${money(item.unit_price || item.price)}</strong></div>`).join("")
      : `<p>No item details found.</p>`;

    const shippingConfirmed = order.shipping_status === "confirmed";
    const address = [order.city, order.province, order.postal_code, order.country].filter(Boolean).join(", ");

    return `
      <article class="admin-order-card">
        <div class="admin-order-head">
          <div>
            <span class="admin-order-number">${esc(order.order_number || order.id)}</span>
            <h2>${esc(order.customer_name || "Customer")}</h2>
            <p>${esc(order.customer_email || "")}</p>
          </div>
          <div class="admin-order-badges">
            <span>${esc(order.status || "pending")}</span>
            <span>${esc(order.paymentStatus)}</span>
            <span>${shippingConfirmed ? "shipping confirmed" : "shipping pending"}</span>
          </div>
        </div>

        <div class="admin-order-details">
          <section><h3>Items</h3><div>${itemRows}</div></section>
          <section><h3>Delivery</h3><p>${esc(order.address_line1 || "")}</p>${order.address_line2 ? `<p>${esc(order.address_line2)}</p>` : ""}<p>${esc(address)}</p><p>Mobile: ${esc(order.mobile_phone || "—")}</p></section>
          <section><h3>Totals</h3><p>Subtotal: ${money(order.subtotal)}</p><p>Shipping: ${shippingConfirmed ? money(order.shipping_fee) : "To be calculated"}</p><p>Coffee: ${money(order.coffee_amount)}</p><p>Voucher: −${money(order.voucher_discount)}</p><strong class="admin-order-total">Total: ${shippingConfirmed ? money(order.total) : "To be confirmed"}</strong></section>
        </div>

        <div class="admin-order-actions">
          ${!order.accepted_at ? `
            <section class="admin-order-control">
              <h3>Accept order</h3>
              <p>Accepted orders 1–5 receive free shipping. After that, enter the actual J&amp;T pouch fee.</p>
              <div class="admin-order-inline"><input class="shipping-input" data-order-id="${order.id}" type="number" min="0" step="0.01" placeholder="J&T fee after first 5"><button class="button button-orange accept-order" data-order-id="${order.id}" type="button">Accept order</button></div>
            </section>` : `
            <section class="admin-order-control">
              <h3>J&amp;T shipping</h3>
              <div class="admin-order-inline"><input class="shipping-input" data-order-id="${order.id}" type="number" min="0" step="0.01" value="${Number(order.shipping_fee || 0)}"><button class="button button-orange save-shipping" data-order-id="${order.id}" type="button">Update fee</button></div>
            </section>`}

          <section class="admin-order-control">
            <h3>J&T tracking</h3>
            <div class="admin-order-inline"><input class="tracking-input" data-order-id="${order.id}" type="text" value="${esc(order.jnt_tracking_number || "")}" placeholder="J&T tracking number"><button class="button button-orange save-tracking" data-order-id="${order.id}" type="button">Save tracking</button></div>
            ${order.jnt_tracking_number ? `<p class="auth-helper">Customer can use this tracking info to open J&T tracking.</p>` : ""}
          </section>

          <section class="admin-order-control">
            <h3>Order status</h3>
            <div class="admin-order-inline"><select class="order-status" data-order-id="${order.id}">${["pending","processing","shipped","completed","cancelled"].map(s => `<option value="${s}" ${order.status === s ? "selected" : ""}>${s}</option>`).join("")}</select><button class="button button-orange save-order-status" data-order-id="${order.id}" type="button">Save</button></div>
          </section>

          <section class="admin-order-control">
            <h3>Payment</h3>
            ${order.payment ? `<p>Method: ${esc(order.payment.payment_method || "—")}</p><p>Reference: ${esc(order.payment.reference_number || "—")}</p><div class="admin-order-inline"><select class="payment-status" data-payment-id="${order.payment.id}">${["pending","submitted","paid","failed","refunded","cancelled"].map(s => `<option value="${s}" ${order.payment.status === s ? "selected" : ""}>${s}</option>`).join("")}</select><button class="button button-orange save-payment" data-payment-id="${order.payment.id}" type="button">Save</button></div>` : `<p>No payment submitted yet.</p>`}
          </section>
        </div>
      </article>`;
  }).join("");

  bindActions();
}

async function acceptOrUpdateShipping(orderId) {
  const input = document.querySelector(`.shipping-input[data-order-id="${orderId}"]`);
  const raw = input?.value ?? "";
  const fee = raw === "" ? null : Number(raw);
  const button = document.querySelector(`[data-order-id="${orderId}"][class*="shipping"]`) || document.querySelector(`.accept-order[data-order-id="${orderId}"]`);
  if (fee !== null && (!Number.isFinite(fee) || fee < 0)) return message("Enter a valid J&T shipping fee.", "error");
  if (button) button.disabled = true;

  const { error } = await supabase.rpc("accept_pompkin_order", { p_order_id: orderId, p_shipping_fee: fee });
  if (error) message(error.message, "error"); else message("Shipping and final total updated.", "success");
  await loadOrders();
}

function bindActions() {
  document.querySelectorAll(".accept-order, .save-shipping").forEach(button => button.addEventListener("click", () => acceptOrUpdateShipping(button.dataset.orderId)));

  document.querySelectorAll(".save-tracking").forEach(button => button.addEventListener("click", async () => {
    const input = document.querySelector(`.tracking-input[data-order-id="${button.dataset.orderId}"]`);
    const tracking = input?.value.trim() || null;
    const url = tracking ? `https://www.jtexpress.ph/track-and-trace?waybillNo=${encodeURIComponent(tracking)}` : null;
    const { error } = await supabase.from("pompkin_orders").update({ jnt_tracking_number: tracking, jnt_tracking_url: url, shipping_notified_at: tracking ? new Date().toISOString() : null }).eq("id", button.dataset.orderId);
    if (error) message(error.message, "error"); else message("J&T tracking information saved.", "success");
    await loadOrders();
  }));

  document.querySelectorAll(".save-order-status").forEach(button => button.addEventListener("click", async () => {
    const select = document.querySelector(`.order-status[data-order-id="${button.dataset.orderId}"]`);
    const { error } = await supabase.rpc("admin_update_pompkin_order_status", { p_order_id: button.dataset.orderId, p_status: select.value });
    if (error) message(error.message, "error"); else message("Order status updated.", "success");
    await loadOrders();
  }));

  document.querySelectorAll(".save-payment").forEach(button => button.addEventListener("click", async () => {
    const select = document.querySelector(`.payment-status[data-payment-id="${button.dataset.paymentId}"]`);
    const { error } = await supabase.rpc("admin_update_pompkin_payment", { p_payment_id: button.dataset.paymentId, p_status: select.value, p_admin_note: null });
    if (error) message(error.message, "error"); else message("Payment status updated.", "success");
    await loadOrders();
  }));
}

document.querySelectorAll(".admin-order-filter").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".admin-order-filter").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  activeFilter = button.dataset.filter;
  loadOrders();
}));

refreshButton.addEventListener("click", loadOrders);
loadOrders();
