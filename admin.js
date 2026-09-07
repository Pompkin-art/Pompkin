import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const productFormWrap = $("productFormWrap");
const productForm = $("productForm");
const productMessage = $("productFormMessage");
const productImagePreview = $("productImagePreview");

let products = [];
let editingProduct = null;

function money(value) {
  return "₱" + Number(value || 0).toLocaleString("en-PH");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[char]));
}

async function isAdmin() {
  const { data, error } = await supabase.rpc("is_pompkin_admin");
  return !error && data === true;
}

async function boot() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !(await isAdmin())) {
    $("adminLoading").hidden = true;
    $("adminDenied").hidden = false;
    return;
  }

  $("adminLoading").hidden = true;
  $("adminApp").hidden = false;
  await Promise.all([loadProducts(), loadReviews()]);
}

async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("productsTable").innerHTML = `<div class="admin-error">${escapeHtml(error.message)}</div>`;
    return;
  }

  products = data || [];
  renderProducts();
}

function renderProducts() {
  if (!products.length) {
    $("productsTable").innerHTML = `
      <div class="admin-empty">
        <h3>No products yet</h3>
        <p>Add your first product above. It will be stored in Supabase instead of being hard-coded into the site.</p>
      </div>`;
    return;
  }

  $("productsTable").innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>Product</th><th>Category</th><th>Price</th><th>Weight</th><th>Stock</th><th>Status</th><th></th>
      </tr></thead>
      <tbody>
        ${products.map(product => `
          <tr>
            <td>
              <div class="admin-product-cell">
                ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="">` : `<div class="admin-product-placeholder"></div>`}
                <div><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.author || "")}</small></div>
              </div>
            </td>
            <td>${escapeHtml(product.category)}</td>
            <td>${money(product.price)}</td>
            <td>${Number(product.weight_grams || 0)}g</td>
            <td>${Number(product.stock || 0)}</td>
            <td><span class="admin-status admin-status-${escapeHtml(product.status)}">${escapeHtml(product.status.replace("_"," "))}</span></td>
            <td><button class="admin-edit-product" data-id="${product.id}" type="button">Edit</button></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  document.querySelectorAll(".admin-edit-product").forEach(button => {
    button.addEventListener("click", () => openProductEditor(button.dataset.id));
  });
}

function openProductEditor(id = null) {
  editingProduct = id ? products.find(p => p.id === id) : null;
  $("productFormTitle").textContent = editingProduct ? "Edit product" : "Add product";
  $("productId").value = editingProduct?.id || "";
  $("productName").value = editingProduct?.name || "";
  $("productAuthor").value = editingProduct?.author || "";
  $("productCategory").value = editingProduct?.category || "";
  $("productPrice").value = editingProduct?.price ?? "";
  $("productWeight").value = editingProduct?.weight_grams ?? "";
  $("productStock").value = editingProduct?.stock ?? 0;
  $("productSold").value = editingProduct?.sold_count ?? 0;
  $("productStatus").value = editingProduct?.status || "available";
  $("productKeywords").value = editingProduct?.keywords || "";
  $("productDescription").value = editingProduct?.description || "";
  $("productImage").value = "";
  productMessage.textContent = "";

  if (editingProduct?.image_url) {
    productImagePreview.hidden = false;
    productImagePreview.innerHTML = `<img src="${escapeHtml(editingProduct.image_url)}" alt="Current product picture">`;
  } else {
    productImagePreview.hidden = true;
    productImagePreview.innerHTML = "";
  }

  productFormWrap.hidden = false;
  productFormWrap.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeProductEditor() {
  productForm.reset();
  editingProduct = null;
  productFormWrap.hidden = true;
  productImagePreview.hidden = true;
  productMessage.textContent = "";
}

async function uploadProductImage(file) {
  const extension = file.name.split(".").pop().toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from("product-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type
  });

  if (error) throw error;

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl;
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  productMessage.textContent = "Saving…";
  $("saveProductButton").disabled = true;

  try {
    const file = $("productImage").files[0];
    let imageUrl = editingProduct?.image_url || null;

    if (file) imageUrl = await uploadProductImage(file);

    const payload = {
      name: $("productName").value.trim(),
      author: $("productAuthor").value.trim(),
      category: $("productCategory").value.trim(),
      price: Number($("productPrice").value),
      weight_grams: Number($("productWeight").value),
      stock: Number($("productStock").value),
      sold_count: Number($("productSold").value),
      status: $("productStatus").value,
      keywords: $("productKeywords").value.trim(),
      description: $("productDescription").value.trim(),
      image_url: imageUrl
    };

    if (editingProduct) {
      const { error } = await supabase.from("products").update(payload).eq("id", editingProduct.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
    }

    closeProductEditor();
    await loadProducts();
  } catch (error) {
    productMessage.textContent = error.message || "Something went wrong.";
  } finally {
    $("saveProductButton").disabled = false;
  }
});

async function loadReviews() {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, product_id, user_id, rating, review_text, photo_url, status, created_at, products(name), profiles(username, display_name)")
    .order("created_at", { ascending: false });

  if (error) {
    $("reviewsList").innerHTML = `<div class="admin-error">${escapeHtml(error.message)}</div>`;
    return;
  }

  const reviews = data || [];
  const pending = reviews.filter(review => review.status === "pending");
  $("pendingReviewCount").textContent = pending.length;

  if (!reviews.length) {
    $("reviewsList").innerHTML = `<div class="admin-card admin-empty"><h3>No reviews yet</h3><p>Customer reviews will appear here for moderation.</p></div>`;
    return;
  }

  $("reviewsList").innerHTML = reviews.map(review => `
    <article class="admin-review-card">
      <div class="admin-review-main">
        <div class="admin-review-top">
          <div>
            <strong>${escapeHtml(review.products?.name || "Unknown product")}</strong>
            <span>${escapeHtml(review.profiles?.display_name || review.profiles?.username || "Customer")}</span>
          </div>
          <span class="admin-status admin-status-${escapeHtml(review.status)}">${escapeHtml(review.status)}</span>
        </div>
        <div class="admin-stars">${"★".repeat(Number(review.rating || 0))}${"☆".repeat(5 - Number(review.rating || 0))}</div>
        <p>${escapeHtml(review.review_text || "")}</p>
        ${review.photo_url ? `<img class="admin-review-photo" src="${escapeHtml(review.photo_url)}" alt="Customer review photo">` : ""}
        <small>${new Date(review.created_at).toLocaleString()}</small>
      </div>
      <div class="admin-review-actions">
        ${review.status === "pending" ? `
          <button class="button button-orange review-action" data-id="${review.id}" data-status="approved" type="button">Approve</button>
          <button class="button button-outline review-action" data-id="${review.id}" data-status="rejected" type="button">Reject</button>
        ` : ""}
        <button class="admin-delete-review review-action" data-id="${review.id}" data-status="deleted" type="button">Delete</button>
      </div>
    </article>
  `).join("");

  document.querySelectorAll(".review-action").forEach(button => {
    button.addEventListener("click", () => moderateReview(button.dataset.id, button.dataset.status));
  });
}

async function moderateReview(id, status) {
  if (status === "deleted" && !confirm("Delete this review permanently?")) return;

  const { error } = status === "deleted"
    ? await supabase.from("reviews").delete().eq("id", id)
    : await supabase.from("reviews").update({
        status,
        reviewed_at: new Date().toISOString()
      }).eq("id", id);

  if (error) {
    alert(error.message);
    return;
  }

  await loadReviews();
}

document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab").forEach(item => item.classList.remove("active"));
    tab.classList.add("active");

    $("adminProductsTab").hidden = tab.dataset.tab !== "products";
    $("adminReviewsTab").hidden = tab.dataset.tab !== "reviews";
  });
});

$("newProductButton").addEventListener("click", () => openProductEditor());
$("cancelProductButton").addEventListener("click", closeProductEditor);
$("cancelProductButton2").addEventListener("click", closeProductEditor);

$("adminLogout").addEventListener("click", async () => {
  await supabase.auth.signOut({ scope: "local" });
  window.location.href = "index.html";
});

boot();


// Voucher management
const voucherForm = document.getElementById("voucherForm");
const voucherList = document.getElementById("voucherList");

async function loadVouchers() {
  if (!voucherList) return;
  const { data, error } = await supabase
    .from("pompkin_vouchers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    voucherList.innerHTML = "<p>Run the updated admin SQL setup to enable vouchers.</p>";
    return;
  }

  voucherList.innerHTML = data.map(v => `
    <div class="admin-list-row">
      <div>
        <strong>${v.code}</strong>
        <span>${v.discount_type === "percent" ? v.discount_value + "%" : "₱" + v.discount_value} off</span>
        <span>${v.active ? "Active" : "Inactive"}</span>
      </div>
      <button type="button" class="button button-small voucher-delete" data-id="${v.id}">Delete</button>
    </div>
  `).join("") || "<p>No vouchers yet.</p>";

  voucherList.querySelectorAll(".voucher-delete").forEach(button => {
    button.addEventListener("click", async () => {
      await supabase.from("pompkin_vouchers").delete().eq("id", button.dataset.id);
      loadVouchers();
    });
  });
}

voucherForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    code: document.getElementById("voucherCode").value.trim().toUpperCase(),
    discount_type: document.getElementById("voucherType").value,
    discount_value: Number(document.getElementById("voucherValue").value),
    minimum_subtotal: Number(document.getElementById("voucherMinimum").value || 0),
    usage_limit: document.getElementById("voucherLimit").value
      ? Number(document.getElementById("voucherLimit").value)
      : null,
    expires_at: document.getElementById("voucherExpires").value
      ? new Date(document.getElementById("voucherExpires").value).toISOString()
      : null,
    active: document.getElementById("voucherActive").checked
  };

  const { error } = await supabase.from("pompkin_vouchers").insert(payload);

  if (error) {
    alert("Could not save voucher: " + error.message);
    return;
  }

  voucherForm.reset();
  document.getElementById("voucherActive").checked = true;
  loadVouchers();
});

loadVouchers();
