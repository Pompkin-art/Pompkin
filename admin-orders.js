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

  const { data, error } = await supabase.rpc("is_pompkin_admin");

  if (error || !data) {
    ordersList.innerHTML =
      `<div class="admin-orders-empty">Admin access is required.</div>`;
    return false;
  }

  return true;
}

async function loadOrders() {
  ordersList.innerHTML =
    `<div class="admin-orders-loading">Loading orders...</div>`;

  if (!(await requireAdmin())) return;

  const { data: orders, error } = await supabase
    .from("pompkin_orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    ordersList.innerHTML = "";
    message(error.message, "error");
    return;
  }

  allOrders = orders || [];

  if (!allOrders.length) {
    ordersList.innerHTML =
      `<div class="admin-orders-empty">No orders yet.</div>`;
    return;
  }

  const ids = allOrders.map(order => order.id);

  const {
    data: items,
    error: itemsError
  } = await supabase
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
    ordersList.innerHTML =
      `<div class="admin-orders-empty">No orders match this filter.</div>`;
    return;
  }

  ordersList.innerHTML = orders.map(order => {
    const shippingConfirmed =
      order.shipping_fee !== null &&
      order.shipping_fee !== undefined;

    const itemRows = order.items.length
      ? order.items.map(item => `
          <div class="admin-order-item-row">
            <span>${esc(item.product_name || "Product")}</span>
            <span>× ${Number(item.quantity || 1)}</span>
            <strong>${money(item.unit_price)}</strong>
          </div>
        `).join("")
      : `<p>No item details found.</p>`;

    const accepted = isAccepted(order);

    return `
      <article class="admin-order-card">

        <div class="admin-order-head">
          <div>
            <span class="admin-order-number">
              Order ${esc(order.id)}
            </span>

            <h2>
              ${esc(order.recipient_name || "Customer")}
            </h2>

            <p>
              Placed ${
                order.created_at
                  ? new Date(order.created_at).toLocaleString("en-PH")
                  : "—"
              }
            </p>
          </div>

          <div class="admin-order-badges">
            <span>${esc(order.status || "pending")}</span>
            <span>${esc(order.payment_status || "awaiting_payment")}</span>
            <span>
              ${
                shippingConfirmed
                  ? "shipping confirmed"
                  : "shipping pending"
              }
            </span>
          </div>
        </div>

        <div class="admin-order-details">

          <section>
            <h3>Items</h3>
            <div>
              ${itemRows}
            </div>
          </section>

          <section>
            <h3>Delivery</h3>

            <p>
              <strong>
                ${esc(order.recipient_name || "—")}
              </strong>
            </p>

            <p>
              Mobile:
              ${esc(order.customer_mobile || "—")}
            </p>

            <p>
              ${esc(
                order.shipping_address ||
                "No shipping address saved."
              )}
            </p>
          </section>

          <section>
            <h3>Totals</h3>

            <p>
              Items:
              ${money(order.subtotal)}
            </p>

            <p>
              Shipping:
              ${
                shippingConfirmed
                  ? money(order.shipping_fee)
                  : "To be calculated"
              }
            </p>

            <p>
              Extra support:
              ${money(order.coffee_amount)}
            </p>

            <strong class="admin-order-total">
              ${
                shippingConfirmed
                  ? money(order.total)
                  : "To be confirmed"
              }
            </strong>
          </section>

        </div>

        <div class="admin-order-actions">

          ${
            !accepted && order.status !== "cancelled"
              ? `
                <section class="admin-order-control">

                  <h3>Accept order</h3>

                  <p>
                    The first 5 accepted orders get free shipping.
                    From order 6 onward, enter the actual J&amp;T pouch fee.
                  </p>

                  <div class="admin-order-inline">

                    <input
                      class="shipping-input"
                      data-order-id="${order.id}"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="J&T fee"
                    >

                    <button
                      class="button button-orange accept-order"
                      data-order-id="${order.id}"
                      type="button"
                    >
                      Accept order
                    </button>

                  </div>

                </section>
              `
              : `
                <section class="admin-order-control">

                  <h3>J&amp;T shipping</h3>

                  <div class="admin-order-inline">

                    <input
                      class="shipping-input"
                      data-order-id="${order.id}"
                      type="number"
                      min="0"
                      step="0.01"
                      value="${
                        shippingConfirmed
                          ? Number(order.shipping_fee)
                          : 0
                      }"
                    >

                    <button
                      class="button button-orange save-shipping"
                      data-order-id="${order.id}"
                      type="button"
                    >
                      Update fee
                    </button>

                  </div>

                </section>
              `
          }

          <section class="admin-order-control">

            <h3>J&amp;T tracking</h3>

            <div class="admin-order-inline">

              <input
                class="tracking-input"
                data-order-id="${order.id}"
                type="text"
                value="${esc(order.tracking_number || "")}"
                placeholder="J&T tracking number"
              >

              <button
                class="button button-orange save-tracking"
                data-order-id="${order.id}"
                type="button"
              >
                Save tracking
              </button>

            </div>

            ${
              order.tracking_number
                ? `<p class="auth-helper">
                    Tracking link is ready for the customer.
                  </p>`
                : ""
            }

          </section>

          <section class="admin-order-control">

            <h3>Order status</h3>

            <div class="admin-order-inline">

              <select
                class="order-status"
                data-order-id="${order.id}"
              >
                ${
                  [
                    "pending",
                    "processing",
                    "shipped",
                    "completed",
                    "cancelled"
                  ]
                    .map(status => `
                      <option
                        value="${status}"
                        ${
                          order.status === status
                            ? "selected"
                            : ""
                        }
                      >
                        ${status}
                      </option>
                    `)
                    .join("")
                }
              </select>

              <button
                class="button button-orange save-order-status"
                data-order-id="${order.id}"
                type="button"
              >
                Save
              </button>

            </div>

          </section>

          <section class="admin-order-control">

            <h3>Payment</h3>

            <p>
              Current status:
              <strong>
                ${esc(order.payment_status || "awaiting_payment")}
              </strong>
            </p>

            <div class="admin-order-inline">

              <select
                class="payment-status"
                data-order-id="${order.id}"
              >
                ${
                  [
                    "unpaid",
                    "awaiting_payment",
                    "submitted",
                    "paid",
                    "failed",
                    "refunded",
                    "cancelled"
                  ]
                    .map(status => `
                      <option
                        value="${status}"
                        ${
                          order.payment_status === status
                            ? "selected"
                            : ""
                        }
                      >
                        ${status}
                      </option>
                    `)
                    .join("")
                }
              </select>

              <button
                class="button button-orange save-payment"
                data-order-id="${order.id}"
                type="button"
              >
                Save
              </button>

            </div>

          </section>

        </div>

      </article>
    `;
  }).join("");

  bindActions();
}

function getShippingFeeForAcceptance(orderId) {
  const acceptedCount = allOrders.filter(order =>
    order.id !== orderId &&
    isAccepted(order)
  ).length;

  const input = document.querySelector(
    `.shipping-input[data-order-id="${orderId}"]`
  );

  const raw = input?.value.trim() || "";

  if (acceptedCount < 5) {
    return 0;
  }

  if (raw === "") {
    message(
      "Enter the actual J&T pouch fee for this order.",
      "error"
    );
    return null;
  }

  const fee = Number(raw);

  if (!Number.isFinite(fee) || fee < 0) {
    message(
      "Enter a valid J&T shipping fee.",
      "error"
    );
    return null;
  }

  return fee;
}

async function acceptOrder(orderId) {
  const fee = getShippingFeeForAcceptance(orderId);

  if (fee === null) return;

  const order = allOrders.find(item => item.id === orderId);

  if (!order) return;

  const total =
    Number(order.subtotal || 0) +
    fee +
    Number(order.coffee_amount || 0);

  const button = document.querySelector(
    `.accept-order[data-order-id="${orderId}"]`
  );

  if (button) button.disabled = true;

  const { error } = await supabase
    .from("pompkin_orders")
    .update({
      shipping_fee: fee,
      total,
      status: "processing"
    })
    .eq("id", orderId);

  if (error) {
    if (button) button.disabled = false;
    message(error.message, "error");
    return;
  }

  message(
    fee === 0
      ? "Order accepted with free shipping."
      : "Order accepted and shipping fee saved.",
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

  const order = allOrders.find(item => item.id === orderId);

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
    "Shipping fee and final total updated.",
    "success"
  );

  await loadOrders();
}

async function saveTracking(orderId) {
  const input = document.querySelector(
    `.tracking-input[data-order-id="${orderId}"]`
  );

  const tracking = input?.value.trim() || null;

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
    "J&T tracking information saved.",
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

function bindActions() {

  document
    .querySelectorAll(".accept-order")
    .forEach(button => {
      button.addEventListener("click", () =>
        acceptOrder(button.dataset.orderId)
      );
    });

  document
    .querySelectorAll(".save-shipping")
    .forEach(button => {
      button.addEventListener("click", () =>
        updateShipping(button.dataset.orderId)
      );
    });

  document
    .querySelectorAll(".save-tracking")
    .forEach(button => {
      button.addEventListener("click", () =>
        saveTracking(button.dataset.orderId)
      );
    });

  document
    .querySelectorAll(".save-order-status")
    .forEach(button => {
      button.addEventListener("click", () =>
        saveOrderStatus(button.dataset.orderId)
      );
    });

  document
    .querySelectorAll(".save-payment")
    .forEach(button => {
      button.addEventListener("click", () =>
        savePaymentStatus(button.dataset.orderId)
      );
    });
}

document
  .querySelectorAll(".admin-order-filter")
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

refreshButton.addEventListener(
  "click",
  loadOrders
);

loadOrders();
