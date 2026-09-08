import { supabase } from "./supabase.js";

const bidsGrid = document.getElementById("bidsGrid");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function peso(value) {
  return `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

async function loadAuctions() {
  const { data, error } = await supabase
    .from("pompkin_auctions")
    .select("*")
    .eq("status", "active")
    .order("ends_at", { ascending: true });

  if (error) {
    console.error(error);
    bidsGrid.innerHTML = `
      <div class="empty-bids">
        <h2>We couldn't load the auctions.</h2>
        <p>Please try again later.</p>
      </div>
    `;
    return;
  }

  if (!data?.length) {
    bidsGrid.innerHTML = `
      <div class="empty-bids">
        <h2>No active bids yet 𐙚</h2>
        <p>New Pompkin artworks will appear here when an auction opens.</p>
      </div>
    `;
    return;
  }

  bidsGrid.innerHTML = data.map(renderAuction).join("");

  document.querySelectorAll("[data-bid-form]").forEach((form) => {
    form.addEventListener("submit", handleBid);
  });
}

function renderAuction(auction) {
  const minimumBid = Math.max(
    Number(auction.starting_bid || 0),
    Number(auction.current_bid || 0) +
      Number(auction.minimum_increment || 10)
  );

  return `
    <article class="bid-card">
      <div class="bid-card-image">
        ${
          auction.image_url
            ? `<img src="${escapeHtml(auction.image_url)}" alt="${escapeHtml(auction.title)}">`
            : ""
        }
      </div>

      <div class="bid-card-content">
        <h2>${escapeHtml(auction.title)}</h2>

        <p class="bid-description">
          ${escapeHtml(auction.description || "Original Pompkin artwork.")}
        </p>

        <span class="bid-price-label">Current bid</span>
        <div class="bid-price">${peso(auction.current_bid || auction.starting_bid)}</div>

        <div class="bid-meta">
          <span>Next: ${peso(minimumBid)}</span>
          <span>Ends: ${formatDate(auction.ends_at)}</span>
        </div>

        <form class="bid-form" data-bid-form data-auction-id="${auction.id}">
          <input
            type="number"
            name="amount"
            min="${minimumBid}"
            step="1"
            placeholder="${minimumBid}"
            required
          >
          <button type="submit">BID NOW</button>
        </form>

        <div class="bid-message" data-bid-message></div>
      </div>
    </article>
  `;
}

async function handleBid(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const auctionId = form.dataset.auctionId;
  const amountInput = form.querySelector("[name='amount']");
  const message = form.parentElement.querySelector("[data-bid-message]");
  const button = form.querySelector("button");

  const amount = Number(amountInput.value);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    message.textContent = "Please log in before placing a bid.";
    return;
  }

  if (!amount || amount <= 0) {
    message.textContent = "Please enter a valid bid.";
    return;
  }

  button.disabled = true;
  message.textContent = "Placing your bid...";

  /*
   * The secure bidding function will be connected here.
   * It will verify the minimum bid and update the auction
   * safely inside Supabase.
   */
  const { error } = await supabase.rpc("place_pompkin_bid", {
    p_auction_id: auctionId,
    p_amount: amount
  });

  if (error) {
    console.error(error);
    message.textContent = error.message || "Your bid could not be placed.";
    button.disabled = false;
    return;
  }

  message.textContent = "Your bid has been placed! 𐙚";
  amountInput.value = "";

  await loadAuctions();
}

loadAuctions();
