import { supabase } from "./supabase.js";

const BASKET_KEY = "pompkin_basket";
const productGrid = document.getElementById("productGrid");
const products = Array.from(productGrid.querySelectorAll(".product-card"));
const searchFilter = document.getElementById("searchFilter");
const authorFilter = document.getElementById("authorFilter");
const categoryFilter = document.getElementById("categoryFilter");
const sortFilter = document.getElementById("sortFilter");
const resetFilters = document.getElementById("resetFilters");
const noResults = document.getElementById("noResults");
const productModal = document.getElementById("productModal");
const closeProductModal = document.getElementById("closeProductModal");
const modalImage = document.getElementById("modalImage");
const modalPlaceholder = document.getElementById("modalPlaceholder");
const modalTitle = document.getElementById("modalTitle");
const modalCategory = document.getElementById("modalCategory");
const modalPrice = document.getElementById("modalPrice");
const modalStatus = document.getElementById("modalStatus");
const modalRating = document.getElementById("modalRating");
const modalDescription = document.getElementById("modalDescription");
const addToBasket = document.getElementById("addToBasket");
const modalQuantity = document.getElementById("modalQuantity");
const modalQuantityMinus = document.getElementById("modalQuantityMinus");
const modalQuantityPlus = document.getElementById("modalQuantityPlus");
const basketDrawer = document.getElementById("basketDrawer");
const openBasket = document.getElementById("openBasket");
const closeBasket = document.getElementById("closeBasket");
const addMore = document.getElementById("addMore");
const basketItems = document.getElementById("basketItems");
const basketCount = document.getElementById("basketCount");
const basketSubtotal = document.getElementById("basketSubtotal");
const shippingEstimate = document.getElementById("shippingEstimate");
const basketTotal = document.getElementById("basketTotal");
const checkoutButton = document.getElementById("checkoutButton");

let selectedProduct = null;
let modalQty = 1;
let basket = loadBasket();

function money(value) { return "₱" + Number(value).toLocaleString("en-PH"); }

function loadBasket() {
  try { return JSON.parse(localStorage.getItem(BASKET_KEY) || "{}"); }
  catch { return {}; }
}

function saveBasket() { localStorage.setItem(BASKET_KEY, JSON.stringify(basket)); }

function filterProducts() {
  const search = searchFilter.value.trim().toLowerCase();
  const author = authorFilter.value;
  const category = categoryFilter.value;
  const sort = sortFilter.value;
  const visible = [];

  products.forEach(product => {
    const searchable = [product.dataset.name, product.dataset.author, product.dataset.category, product.dataset.keywords].join(" ").toLowerCase();
    const matches = searchable.includes(search) && (author === "all" || product.dataset.author === author) && (category === "all" || product.dataset.category === category);
    product.hidden = !matches;
    if (matches) visible.push(product);
  });

  visible.sort((a, b) => {
    if (sort === "best") return Number(b.dataset.sold) - Number(a.dataset.sold);
    if (sort === "latest") return Number(b.dataset.latest) - Number(a.dataset.latest);
    if (sort === "high") return Number(b.dataset.price) - Number(a.dataset.price);
    if (sort === "low") return Number(a.dataset.price) - Number(b.dataset.price);
    return products.indexOf(a) - products.indexOf(b);
  });
  visible.forEach(product => productGrid.appendChild(product));
  noResults.style.display = visible.length ? "none" : "block";
}

function openProduct(product) {
  selectedProduct = product;
  modalQty = 1;
  if (modalQuantity) modalQuantity.textContent = String(modalQty);
  modalTitle.textContent = product.dataset.name;
  modalCategory.textContent = product.dataset.author + " · " + product.dataset.category;
  modalPrice.textContent = money(product.dataset.price);
  modalStatus.textContent = product.dataset.status;
  modalRating.textContent = product.dataset.rating;
  modalDescription.textContent = product.dataset.name + " is part of the current Pompkin collection. Product details, availability, shipping information, and final order options can be updated here without creating a separate page for every item.";
  const image = product.querySelector("img");
  if (image) {
    modalImage.src = image.src;
    modalImage.alt = image.alt;
    modalImage.hidden = false;
    modalPlaceholder.hidden = true;
  } else {
    modalImage.hidden = true;
    modalPlaceholder.hidden = false;
  }
  productModal.classList.add("is-open");
  productModal.setAttribute("aria-hidden", "false");
}

function closeProduct() {
  productModal.classList.remove("is-open");
  productModal.setAttribute("aria-hidden", "true");
}

function addSelectedToBasket() {
  if (!selectedProduct) return;
  const id = selectedProduct.dataset.id;
  basket[id] = (basket[id] || 0) + modalQty;
  saveBasket();
  renderBasket();
  closeProduct();
  openBasketDrawer();
}

function renderBasket() {
  const entries = Object.entries(basket).filter(([id, quantity]) => quantity > 0 && products.some(item => item.dataset.id === id));
  if (!entries.length) {
    basketItems.innerHTML = '<p class="basket-empty">Your basket is empty.</p>';
  } else {
    basketItems.innerHTML = entries.map(([id, quantity]) => {
      const product = products.find(item => item.dataset.id === id);
      return `<div class="basket-item">
        <div class="basket-item-info">
          <strong>${product.dataset.name}</strong>
          <span>${money(product.dataset.price)} each</span>
        </div>
        <div class="basket-item-controls">
          <div class="quantity-control" aria-label="Quantity for ${product.dataset.name}">
            <button type="button" data-quantity-minus="${id}" aria-label="Decrease quantity">−</button>
            <span>${quantity}</span>
            <button type="button" data-quantity-plus="${id}" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="basket-remove-all" data-remove="${id}">Remove</button>
        </div>
      </div>`;
    }).join("");
  }
  const count = entries.reduce((sum, [, qty]) => sum + qty, 0);
  const subtotal = entries.reduce((sum, [id, qty]) => sum + Number(products.find(item => item.dataset.id === id).dataset.price) * qty, 0);
  basketCount.textContent = count;
  basketSubtotal.textContent = money(subtotal);
  shippingEstimate.textContent = "Calculated at checkout";
  basketTotal.textContent = money(subtotal);
}

function openBasketDrawer() { basketDrawer.classList.add("is-open"); basketDrawer.setAttribute("aria-hidden", "false"); }
function closeBasketDrawer() { basketDrawer.classList.remove("is-open"); basketDrawer.setAttribute("aria-hidden", "true"); }

async function goToCheckout() {
  const entries = Object.entries(basket).filter(([, quantity]) => quantity > 0);
  if (!entries.length) {
    openBasketDrawer();
    return;
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = "order-checkout.html";
    return;
  }
  window.pompkinAuth?.setAuthReturn("/Pompkin/order-checkout.html");
  window.location.href = "login.html";
}

products.forEach(product => product.querySelector(".product-click-area").addEventListener("click", () => openProduct(product)));
[searchFilter, authorFilter, categoryFilter, sortFilter].forEach(control => control.addEventListener("input", filterProducts));
resetFilters.addEventListener("click", () => { searchFilter.value = ""; authorFilter.value = "all"; categoryFilter.value = "all"; sortFilter.value = "default"; filterProducts(); });
closeProductModal.addEventListener("click", closeProduct);
productModal.addEventListener("click", event => { if (event.target === productModal) closeProduct(); });
addToBasket.addEventListener("click", addSelectedToBasket);
modalQuantityMinus?.addEventListener("click", () => {
  modalQty = Math.max(1, modalQty - 1);
  if (modalQuantity) modalQuantity.textContent = String(modalQty);
});
modalQuantityPlus?.addEventListener("click", () => {
  modalQty += 1;
  if (modalQuantity) modalQuantity.textContent = String(modalQty);
});
openBasket.addEventListener("click", openBasketDrawer);
closeBasket.addEventListener("click", closeBasketDrawer);
addMore.addEventListener("click", closeBasketDrawer);
checkoutButton.addEventListener("click", goToCheckout);
basketItems.addEventListener("click", event => {
  const plusId = event.target.dataset.quantityPlus;
  const minusId = event.target.dataset.quantityMinus;
  const removeId = event.target.dataset.remove;

  if (plusId) {
    basket[plusId] = (basket[plusId] || 0) + 1;
    saveBasket();
    renderBasket();
    return;
  }

  if (minusId) {
    basket[minusId] = Math.max((basket[minusId] || 0) - 1, 0);
    if (basket[minusId] === 0) delete basket[minusId];
    saveBasket();
    renderBasket();
    return;
  }

  if (removeId) {
    delete basket[removeId];
    saveBasket();
    renderBasket();
  }
});
document.addEventListener("keydown", event => { if (event.key === "Escape") { closeProduct(); closeBasketDrawer(); } });
filterProducts();
renderBasket();
