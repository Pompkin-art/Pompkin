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

  clearTimeout(message.timer);

  message.timer = setTimeout(() => {
    messageBox.hidden = true;
  }, 3000);
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
        <td colspan="9" class="admin-orders-empty">
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
      <td colspan="9" class="admin-orders-loading">
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
        <td colspan="9" class="admin-orders-empty">
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
        <td colspan="9" class="admin-orders-empty">
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
      : "—";

    const orderShort =
      String(order.id).slice(0, 8).toUpperCase();

    return `
      <tr class="admin-order-row">

        <td class="order-id-cell">
          <strong>#${orderShort}</strong>
          <small>
            ${order.created_at
              ? new Date(order.created_at).toLocaleDateString("en-PH")
              : "—"}
          </small>
        </td>

        <td class="customer-cell">
          <strong>${esc(order.recipient_name || "—")}</strong>
          <small>${esc(order.customer_mobile || "—")}</small>
        </td>

        <td class="items-cell">
          ${itemText}
        </td>

        <td class="money-cell">
          ${money(order.subtotal)}
        </td>

        <td>
          <input
            class="sheet-input shipping-input"
            data-order-id="${order.id}"
            data-original="${shippingConfirmed ? Number(order.shipping_fee) : ""}"
            type="number"
            min="0"
            step="0.01"
            value="${shippingConfirmed ? Number(order.shipping_fee) : ""}"
            placeholder="—"
            title="Press Enter to save"
          >
        </td>

        <td class="money-cell total-cell">
          ${shippingConfirmed
            ? money(order.total)
            : "—"}
        </td>

        <td>
          <select
            class="sheet-select order-status"
            data-order-id="${order.id}"
            data-original="${esc(order.status || "pending")}"
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
        </td>

        <td>
          <select
            class="sheet-select payment-status"
            data-order-id="${order.id}"
            data-original="${esc(order.payment_status || "awaiting_payment")}"
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
        </td>

        <td>
          <input
            class="sheet-input tracking-input"
            data-order-id="${order.id}"
            type="text"
            value="${esc(order.tracking_number || "")}"
            placeholder="Waybill"
            title="Press Enter to save"
          >
        </td>

      </tr>
    `;
  }).join("");

  bindSheetActions();
}

function bindSheetActions() {

  document.querySelectorAll(".shipping-input")
    .forEach(input => {

      input.addEventListener("input", () => {
        updateDisplayedTotal(input);
      });

      input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          updateShipping(input.dataset.orderId);
          input.blur();
        }
      });
    });

  document.querySelectorAll(".tracking-input")
    .forEach(input => {

      input.addEventListener("keydown", event => {

        if (event.key === "Enter") {
          event.preventDefault();
          saveTracking(input.dataset.orderId);
          input.blur();
        }

      });
    });

  document.querySelectorAll(".order-status")
    .forEach(select => {

      select.addEventListener("change", () => {
        saveOrderStatus(
          select.dataset.orderId,
          select
        );
      });

    });

  document.querySelectorAll(".payment-status")
    .forEach(select => {

      select.addEventListener("change", () => {
        savePaymentStatus(
          select.dataset.orderId
        );
      });

    });
}

function updateDisplayedTotal(input) {

  const row = input.closest("tr");

  if (!row) return;

  const orderId = input.dataset.orderId;

  const order = allOrders.find(
    item => item.id === orderId
  );

  if (!order) return;

  const fee = Number(input.value);

  const totalCell =
    row.querySelector(".total-cell");

  if (
    !Number.isFinite(fee) ||
    input.value === ""
  ) {
    totalCell.textContent = "—";
    return;
  }

  const total =
    Number(order.subtotal || 0) +
    fee +
    Number(order.coffee_amount || 0);

  totalCell.textContent = money(total);
}

async function updateShipping(orderId) {

  const input = document.querySelector(
    `.shipping-input[data-order-id="${orderId}"]`
  );

  if (!input) return;

  const raw = input.value.trim();

  if (raw === "") {
    message(
      "Enter a shipping fee first.",
      "error"
    );
    return;
  }

  const fee = Number(raw);

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

  input.dataset.original = fee;

  message(
    "Shipping updated.",
    "success"
  );

  updateDisplayedTotal(input);
}

async function saveTracking(orderId) {

  const input = document.querySelector(
    `.tracking-input[data-order-id="${orderId}"]`
  );

  if (!input) return;

  const tracking =
    input.value.trim() || null;

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
    "Tracking updated.",
    "success"
  );
}

async function saveOrderStatus(orderId, select) {

  const newStatus = select.value;

  const order = allOrders.find(
    item => item.id === orderId
  );

  if (!order) return;

  /*
   * Moving into an accepted status.
   * First 5 accepted orders receive free shipping
   * if no shipping fee has been entered.
   */
  if (
    ["processing", "shipped", "completed"].includes(newStatus) &&
    !isAccepted(order)
  ) {

    const acceptedCount = allOrders.filter(
      item =>
        item.id !== orderId &&
        isAccepted(item)
    ).length;

    const shippingInput = document.querySelector(
      `.shipping-input[data-order-id="${orderId}"]`
    );

    const shippingValue =
      shippingInput?.value.trim() || "";

    if (
      acceptedCount < 5 &&
      shippingValue === ""
    ) {
      if (shippingInput) {
        shippingInput.value = "0";
        updateDisplayedTotal(shippingInput);
      }
    }

    if (
      acceptedCount >= 5 &&
      shippingValue === ""
    ) {
      message(
        "Enter the J&T shipping fee before accepting this order.",
        "error"
      );

      select.value =
        select.dataset.original || "pending";

      return;
    }

    const fee = Number(
      shippingInput?.value || 0
    );

    const total =
      Number(order.subtotal || 0) +
      fee +
      Number(order.coffee_amount || 0);

    const { error } = await supabase
      .from("pompkin_orders")
      .update({
        status: newStatus,
        shipping_fee: fee,
        total
      })
      .eq("id", orderId);

    if (error) {
      message(error.message, "error");
      select.value =
        select.dataset.original || "pending";
      return;
    }

    select.dataset.original = newStatus;

    message(
      "Order accepted and updated.",
      "success"
    );

    await loadOrders();
    return;
  }

  const { error } = await supabase
    .from("pompkin_orders")
    .update({
      status: newStatus
    })
    .eq("id", orderId);

  if (error) {
    message(error.message, "error");

    select.value =
      select.dataset.original ||
      order.status ||
      "pending";

    return;
  }

  select.dataset.original = newStatus;

  message(
    "Order status updated.",
    "success"
  );
}

async function savePaymentStatus(orderId) {

  const select = document.querySelector(
    `.payment-status[data-order-id="${orderId}"]`
  );

  if (!select) return;

  const payment_status = select.value;

  const { error } = await supabase
    .from("pompkin_orders")
    .update({
      payment_status
    })
    .eq("id", orderId);

  if (error) {
    message(error.message, "error");
    return;
  }

  select.dataset.original = payment_status;

  message(
    "Payment status updated.",
    "success"
  );
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

      activeFilter =
        button.dataset.filter;

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
