import { supabase } from "./supabase.js";

const ordersList = document.getElementById("ordersList");
const messageBox = document.getElementById("ordersMessage");
const refreshButton = document.getElementById("refreshOrders");

let activeFilter = "all";
let allOrders = [];

const money = value =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const esc = value =>
  String(value ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  }[c]));

function message(text, type = "info") {
  messageBox.hidden = false;
  messageBox.className = `admin-orders-message ${type}`;
  messageBox.textContent = text;
}

function isAccepted(order) {
  return ["processing", "shipped", "completed"].includes(order.status);
}

function filterMatches(order) {
  if (activeFilter === "all") return true;
  if (activeFilter === "pending") return order.status === "pending";
  if (activeFilter === "accepted") return isAccepted(order);
  if (activeFilter === "paid") return order.payment_status === "paid";
  if (activeFilter === "completed") return order.status === "completed";
  return true;
}

async function requireAdmin() {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    location.href = "login.html?return=/Pompkin/admin-orders.html";
    return false;
  }

  const { data, error } =
    await supabase.rpc("is_pompkin_admin");

  if (error || !data) {
    ordersList.innerHTML = `
      <tr>
        <td colspan="10" class="admin-orders-empty">
          Admin access is required.
        </td>
      </tr>
    `;
    return false;
  }

  return true;
}

async function loadOrders() {
  ordersList.innerHTML = `
    <tr>
      <td colspan="10" class="admin-orders-loading">
        Loading orders...
      </td>
    </tr>
  `;

  if (!(await requireAdmin())) return;

  const { data: orders, error } = await supabase
    .from("pompkin_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    message(error.message, "error");
    return;
  }

  allOrders = orders || [];

  if (!allOrders.length) {
    ordersList.innerHTML = `
      <tr>
        <td colspan="10" class="admin-orders-empty">
          No orders yet.
        </td>
      </tr>
    `;
    return;
  }

  const ids = allOrders.map(order => order.id);

  const { data: items, error: itemsError } =
    await supabase
      .from("pompkin_order_items")
      .select("*")
      .in("order_id", ids);

  if (itemsError) {
    message(itemsError.message, "error");
  }

  const itemMap = new Map();

  (items || []).forEach(item => {
    if (!itemMap.has(item.order_id)) {
      itemMap.set(item.order_id, []);
    }

    itemMap.get(item.order_id).push(item);
  });

  allOrders.forEach(order => {
    order.items = itemMap.get(order.id) || [];
  });

  render(allOrders.filter(filterMatches));
}

function render(orders) {
  if (!orders.length) {
    ordersList.innerHTML = `
      <tr>
        <td colspan="10" class="admin-orders-empty">
          No orders match this filter.
        </td>
      </tr>
    `;
    return;
  }

  ordersList.innerHTML = orders.map(order => {
    const shippingConfirmed =
      order.shipping_fee !== null &&
      order.shipping_fee !== undefined;

    const itemText = order.items.length
      ? order.items.map(item =>
          `${esc(item.product_name || "Product")} ×${Number(item.quantity || 1)}`
        ).join("<br>")
      : "No items";

    const orderShort =
      String(order.id).slice(0, 8).toUpperCase();

    const total = shippingConfirmed
      ? money(order.total)
      : "—";

    return `
      <tr class="admin-order-row">

        <td>
          <strong class="admin-order-number">
            #${orderShort}
          </strong>
          <small>
            ${order.created_at
              ? new Date(order.created_at).toLocaleDateString("en-PH")
              : "—"}
          </small>
        </td>

        <td>
          <strong>${esc(order.recipient_name || "—")}</strong>
          <small>${esc(order.customer_mobile || "—")}</small>
        </td>

        <td class="admin-order-items-cell">
          ${itemText}
        </td>

        <td>
          ${money(order.subtotal)}
        </td>

        <td>
          ${shippingConfirmed
            ? money(order.shipping_fee)
            : "—"}
        </td>

        <td>
          <strong>${total}</strong>
        </td>

        <td>
          <span class="admin-order-status-badge">
            ${esc(order.status || "pending")}
          </span>
        </td>

        <td>
          <span class="admin-order-payment-badge">
            ${esc(order.payment_status || "awaiting_payment")}
          </span>
        </td>

        <td>
          ${order.tracking_number
            ? esc(order.tracking_number)
            : "—"}
        </td>

        <td>
          <button
            class="button button-orange open-order"
            data-order-id="${order.id}"
            type="button"
          >
            Open
          </button>
        </td>

      </tr>

      <tr
        id="order-details-${order.id}"
        class="admin-order-detail-row"
        hidden
      >
        <td colspan="10">

          <div class="admin-order-detail">

            <div class="admin-order-detail-top">

              <div>
                <p class="section-label">order details 𐙚</p>
                <h2>Order #${orderShort}</h2>
              </div>

              <button
                class="button button-outline close-order"
                data-order-id="${order.id}"
                type="button"
              >
                Close
              </button>

            </div>

            <div class="admin-order-detail-grid">

              <section>
                <h3>Customer</h3>

                <p>
                  <strong>
                    ${esc(order.recipient_name || "—")}
                  </strong>
                </p>

                <p>
                  ${esc(order.customer_mobile || "—")}
                </p>

                <p>
                  ${esc(order.shipping_address || "—")}
                </p>
              </section>

              <section>
                <h3>Items</h3>

                ${order.items.length
                  ? order.items.map(item => `
                    <div class="admin-detail-item">
                      <span>
                        ${esc(item.product_name || "Product")}
                        ×${Number(item.quantity || 1)}
                      </span>
                      <strong>
                        ${money(item.subtotal)}
                      </strong>
                    </div>
                  `).join("")
                  : "<p>No item details.</p>"
                }

                <div class="admin-detail-total">
                  <span>Items</span>
                  <strong>${money(order.subtotal)}</strong>
                </div>

                <div class="admin-detail-total">
                  <span>Extra support</span>
                  <strong>${money(order.coffee_amount)}</strong>
                </div>

                <div class="admin-detail-total">
                  <span>Shipping</span>
                  <strong>
                    ${shippingConfirmed
                      ? money(order.shipping_fee)
                      : "To be calculated"}
                  </strong>
                </div>

                <div class="admin-detail-grand-total">
                  <span>Total</span>
                  <strong>
                    ${shippingConfirmed
                      ? money(order.total)
                      : "To be confirmed"}
                  </strong>
                </div>
              </section>

              <section>
                <h3>Shipping</h3>

                <label>
                  J&amp;T shipping fee
                  <input
                    class="shipping-input"
                    data-order-id="${order.id}"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${shippingConfirmed
                      ? Number(order.shipping_fee)
                      : ""}"
                  >
                </label>

                <button
                  class="button button-orange save-shipping"
                  data-order-id="${order.id}"
                  type="button"
                >
                  Update fee
                </button>

                <label>
                  Tracking number
                  <input
                    class="tracking-input"
                    data-order-id="${order.id}"
                    type="text"
                    value="${esc(order.tracking_number || "")}"
                    placeholder="J&T waybill number"
                  >
                </label>

                <button
                  class="button button-orange save-tracking"
                  data-order-id="${order.id}"
                  type="button"
                >
                  Save tracking
                </button>
              </section>

              <section>
                <h3>Status</h3>

                <label>
                  Order status
                  <select
                    class="order-status"
                    data-order-id="${order.id}"
                  >
                    ${[
                      "pending",
                      "processing",
                      "shipped",
                      "completed",
                      "cancelled"
                    ].map(status => `
                      <option
                        value="${status}"
                        ${order.status === status ? "selected" : ""}
                      >
                        ${status}
                      </option>
                    `).join("")}
                  </select>
                </label>

                <button
                  class="button button-orange save-order-status"
                  data-order-id="${order.id}"
                  type="button"
                >
                  Save status
                </button>

                <label>
                  Payment status
                  <select
                    class="payment-status"
                    data-order-id="${order.id}"
                  >
                    ${[
                      "awaiting_payment",
                      "submitted",
                      "paid",
                      "failed",
                      "refunded"
                    ].map(status => `
                      <option
                        value="${status}"
                        ${order.payment_status === status ? "selected" : ""}
                      >
                        ${status}
                      </option>
                    `).join("")}
                  </select>
                </label>

                <button
                  class="button button-orange save-payment"
                  data-order-id="${order.id}"
                  type="button"
                >
                  Save payment
                </button>
              </section>

            </div>

            ${
              order.status === "pending"
                ? `
                  <div class="admin-order-accept-bar">

                    <div>
                      <strong>Accept this order</strong>
                      <p>
                        The first 5 accepted orders receive free shipping.
                        After that, enter the actual J&amp;T pouch fee.
                      </p>
                    </div>

                    <button
                      class="button button-orange accept-order"
                      data-order-id="${order.id}"
                      type="button"
                    >
                      Accept Order
                    </button>

                  </div>
                `
                : ""
            }

          </div>

        </td>
      </tr>
    `;
  }).join("");

  bindActions();
}

function bindActions() {

  document.querySelectorAll(".open-order")
    .forEach(button => {
      button.addEventListener("click", () => {

        const id = button.dataset.orderId;
        const row = document.getElementById(
          `order-details-${id}`
        );

        if (row) row.hidden = false;

        button.textContent = "Opened";
        button.disabled = true;
      });
    });

  document.querySelectorAll(".close-order")
    .forEach(button => {
      button.addEventListener("click", () => {

        const id = button.dataset.orderId;
        const row = document.getElementById(
          `order-details-${id}`
        );

        if (row) row.hidden = true;

        const openButton = document.querySelector(
          `.open-order[data-order-id="${id}"]`
        );

        if (openButton) {
          openButton.textContent = "Open";
          openButton.disabled = false;
        }
      });
    });

  document.querySelectorAll(".accept-order")
    .forEach(button => {
      button.addEventListener("click", () =>
        acceptOrder(button.dataset.orderId)
      );
    });

  document.querySelectorAll(".save-shipping")
    .forEach(button => {
      button.addEventListener("click", () =>
        updateShipping(button.dataset.orderId)
      );
    });

  document.querySelectorAll(".save-tracking")
    .forEach(button => {
      button.addEventListener("click", () =>
        saveTracking(button.dataset.orderId)
      );
    });

  document.querySelectorAll(".save-order-status")
    .forEach(button => {
      button.addEventListener("click", () =>
        saveOrderStatus(button.dataset.orderId)
      );
    });

  document.querySelectorAll(".save-payment")
    .forEach(button => {
      button.addEventListener("click", () =>
        savePaymentStatus(button.dataset.orderId)
      );
    });
}

function getAcceptanceShipping(orderId) {

  const acceptedCount = allOrders.filter(order =>
    order.id !== orderId &&
    isAccepted(order)
  ).length;

  if (acceptedCount < 5) {
    return 0;
  }

  const input = document.querySelector(
    `.shipping-input[data-order-id="${orderId}"]`
  );

  const value = Number(input?.value);

  if (!Number.isFinite(value) || value < 0) {
    message(
      "Enter the actual J&T shipping fee.",
      "error"
    );
    return null;
  }

  return value;
}

async function acceptOrder(orderId) {

  const fee = getAcceptanceShipping(orderId);

  if (fee === null) return;

  const order = allOrders.find(
    item => item.id === orderId
  );

  if (!order) return;

  const total =
    Number(order.subtotal || 0) +
    fee +
    Number(order.coffee_amount || 0);

  const { error } = await supabase
    .from("pompkin_orders")
    .update({
      shipping_fee: fee,
      total,
      status: "processing"
    })
    .eq("id", orderId);

  if (error) {
    message(error.message, "error");
    return;
  }

  message(
    fee === 0
      ? "Order accepted with free shipping."
      : "Order accepted and shipping saved.",
    "success"
  );

  await loadOrders();
}

async function updateShipping(orderId) {

  const input = document.querySelector(
    `.shipping-input[data-order-id="${orderId}"]`
  );

  const fee = Number(input?.value);

  if (!Number.isFinite(fee) || fee < 0) {
    message(
      "Enter a valid J&T shipping fee.",
      "error"
    );
    return;
  }

  const order = allOrders.find(
    item => item.id === orderId
  );

  if (!order) return;

  const total =
    Number(order.subtotal || 0) +
    fee +
    Number(order.coffee_amount || 0);

  const { error } = await supabase
    .from("pompkin_orders")
    .update({
      shipping_fee: fee,
      total
    })
    .eq("id", orderId);

  if (error) {
    message(error.message, "error");
    return;
  }

  message(
    "Shipping fee and total updated.",
    "success"
  );

  await loadOrders();
}

async function saveTracking(orderId) {

  const input = document.querySelector(
    `.tracking-input[data-order-id="${orderId}"]`
  );

  const tracking =
    input?.value.trim() || null;

  const { error } = await supabase
    .from("pompkin_orders")
    .update({
      tracking_number: tracking
    })
    .eq("id", orderId);

  if (error) {
    message(error.message, "error");
    return;
  }

  message(
    "Tracking number saved.",
    "success"
  );

  await loadOrders();
}

async function saveOrderStatus(orderId) {

  const select = document.querySelector(
    `.order-status[data-order-id="${orderId}"]`
  );

  const status = select?.value;

  if (!status) return;

  const { error } = await supabase
    .from("pompkin_orders")
    .update({ status })
    .eq("id", orderId);

  if (error) {
    message(error.message, "error");
    return;
  }

  message(
    "Order status updated.",
    "success"
  );

  await loadOrders();
}

async function savePaymentStatus(orderId) {

  const select = document.querySelector(
    `.payment-status[data-order-id="${orderId}"]`
  );

  const payment_status = select?.value;

  if (!payment_status) return;

  const { error } = await supabase
    .from("pompkin_orders")
    .update({ payment_status })
    .eq("id", orderId);

  if (error) {
    message(error.message, "error");
    return;
  }

  message(
    "Payment status updated.",
    "success"
  );

  await loadOrders();
}

document.querySelectorAll(".admin-order-filter")
  .forEach(button => {
    button.addEventListener("click", () => {

      document
        .querySelectorAll(".admin-order-filter")
        .forEach(item =>
          item.classList.remove("active")
        );

      button.classList.add("active");

      activeFilter = button.dataset.filter;

      render(
        allOrders.filter(filterMatches)
      );
    });
  });

refreshButton?.addEventListener(
  "click",
  loadOrders
);

loadOrders();
