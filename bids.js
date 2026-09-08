import { supabase } from "./supabase.js";

const grid = document.getElementById("bidsGrid");
const previousGrid = document.getElementById("previousGrid");

const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"
}[c]));

const money = v => `₱${Number(v || 0).toLocaleString("en-PH", {
  minimumFractionDigits: 2, maximumFractionDigits: 2
})}`;

const dateText = v => new Date(v).toLocaleString("en-PH", {
  dateStyle:"medium", timeStyle:"short"
});

function nextBid(a) {
  const current = Number(a.current_bid || 0);
  const starting = Number(a.starting_bid || 0);
  const increment = Number(a.minimum_increment || 10);
  return current > 0 ? current + increment : starting;
}

async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

async function getGalleryData() {
  const now = new Date().toISOString();

  const [activeResult, previousResult, likesResult, commentsResult, user] = await Promise.all([
    supabase.from("pompkin_auctions")
      .select("*")
      .eq("status","active")
      .lte("starts_at", now)
      .gt("ends_at", now)
      .order("ends_at",{ascending:true}),

    supabase.from("pompkin_auctions")
      .select("*")
      .eq("status","ended")
      .order("ends_at",{ascending:false}),

    supabase.from("pompkin_auction_likes")
      .select("auction_id,user_id"),

    supabase.from("pompkin_auction_comments_public")
      .select("id,auction_id,username,comment_text,created_at")
      .order("created_at",{ascending:false})
      .limit(500),

    getUser()
  ]);

  if (activeResult.error) throw activeResult.error;
  if (previousResult.error) throw previousResult.error;

  return {
    active: activeResult.data || [],
    previous: previousResult.data || [],
    likes: likesResult.error ? [] : (likesResult.data || []),
    comments: commentsResult.error ? [] : (commentsResult.data || []),
    user
  };
}

function socialMarkup(auctionId, likes, comments, user) {
  const count = likes.filter(x => x.auction_id === auctionId).length;
  const liked = !!user && likes.some(x => x.auction_id === auctionId && x.user_id === user.id);
  const ownCommentNote = user ? "Signed in as you." : "Log in to like or comment.";

  const auctionComments = comments
    .filter(c => c.auction_id === auctionId)
    .slice(0, 20);

  return `
    <div class="auction-social">
      <div class="social-actions">
        <button type="button" class="like-button ${liked ? "liked" : ""}"
          data-like-button data-auction-id="${auctionId}" aria-pressed="${liked}">
          ${liked ? "♥ Liked" : "♡ Like"} <span>(${count})</span>
        </button>
        <span class="social-message">${ownCommentNote}</span>
      </div>

      <form class="comment-form" data-comment-form data-auction-id="${auctionId}">
        <textarea name="comment" maxlength="1000" placeholder="Leave a little note about this artwork..."></textarea>
        <button type="submit" class="button button-small">COMMENT</button>
      </form>
      <p class="social-message" data-comment-message></p>

      <div class="comments-list">
        ${auctionComments.length ? auctionComments.map(c => `
          <div class="comment">
            <strong>— ${esc(c.username || "Pompkin user")}</strong>
            <p>${esc(c.comment_text)}</p>
          </div>
        `).join("") : `<p class="social-message">No comments yet. Be the first to leave one 𐙚</p>`}
      </div>
    </div>
  `;
}

function activeCard(a, likes, comments, user) {
  const n = nextBid(a);
  return `
    <article class="bid-card">
      <div class="bid-artwork">
        ${a.image_url
          ? `<img src="${esc(a.image_url)}" alt="${esc(a.title)}">`
          : `<span>Pompkin artwork 𐙚</span>`}
      </div>
      <div class="bid-card-content">
        <p class="bid-eyebrow">open auction</p>
        <h2>${esc(a.title)}</h2>
        <p class="bid-description">${esc(a.description || "Original Pompkin artwork.")}</p>
        <div class="bid-price-label">Current bid</div>
        <div class="bid-price">${money(a.current_bid || a.starting_bid)}</div>
        <div class="bid-meta">
          <span>Next bid<br><strong>${money(n)}</strong></span>
          <span>Ends<br><strong>${dateText(a.ends_at)}</strong></span>
        </div>
        <form class="bid-form" data-bid-form data-auction-id="${a.id}">
          <label>YOUR BID
            <input name="amount" type="number" min="${n}" step="1" placeholder="${n}" required>
          </label>
          <button class="button button-orange" type="submit">BID NOW</button>
        </form>
        <p class="bid-message" data-bid-message></p>
        ${socialMarkup(a.id, likes, comments, user)}
      </div>
    </article>
  `;
}

function previousCard(a, likes, comments, user) {
  return `
    <article class="previous-card bid-card">
      <div class="bid-artwork">
        ${a.image_url
          ? `<img src="${esc(a.image_url)}" alt="${esc(a.title)}">`
          : `<span>Pompkin artwork 𐙚</span>`}
      </div>
      <div class="bid-card-content">
        <span class="ended-stamp">auction closed</span>
        <h2>${esc(a.title)}</h2>
        <p class="bid-description">${esc(a.description || "Original Pompkin artwork.")}</p>
        <div class="bid-price-label">Final bid</div>
        <div class="bid-price">${money(a.current_bid || a.starting_bid)}</div>
        <p class="winner-line">Closed ${dateText(a.ends_at)}</p>
        ${socialMarkup(a.id, likes, comments, user)}
      </div>
    </article>
  `;
}

async function render() {
  try {
    const { active, previous, likes, comments, user } = await getGalleryData();

    grid.innerHTML = active.length
      ? active.map(a => activeCard(a, likes, comments, user)).join("")
      : `<div class="empty-bids"><h2>No open auctions right now 𐙚</h2><p>Check the gallery archive below for previous Pompkin artworks.</p></div>`;

    previousGrid.innerHTML = previous.length
      ? previous.map(a => previousCard(a, likes, comments, user)).join("")
      : `<div class="empty-bids"><h2>No previous auctions yet.</h2><p>Once an auction closes, its artwork will stay here as part of the gallery.</p></div>`;

    document.querySelectorAll("[data-bid-form]").forEach(f =>
      f.addEventListener("submit", placeBid)
    );
    document.querySelectorAll("[data-like-button]").forEach(b =>
      b.addEventListener("click", toggleLike)
    );
    document.querySelectorAll("[data-comment-form]").forEach(f =>
      f.addEventListener("submit", submitComment)
    );
  } catch (error) {
    console.error(error);
    grid.innerHTML = `<div class="empty-bids"><h2>We couldn't load the gallery.</h2><p>${esc(error.message)}</p></div>`;
    previousGrid.innerHTML = "";
  }
}

async function placeBid(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const button = form.querySelector("button");
  const message = form.parentElement.querySelector("[data-bid-message]");
  const amount = Number(form.amount.value);

  const user = await getUser();
  if (!user) {
    localStorage.setItem("pompkin_auth_return", "/Pompkin/bids.html");
    location.href = "login.html";
    return;
  }

  button.disabled = true;
  message.textContent = "Placing your bid…";

  const { data, error } = await supabase.rpc("place_pompkin_bid", {
    p_auction_id: form.dataset.auctionId,
    p_amount: amount
  });

  if (error) {
    message.textContent = error.message;
    button.disabled = false;
    return;
  }

  message.textContent = `Bid placed at ${money(data?.amount || amount)} 𐙚`;
  form.amount.value = "";
  await render();
}

async function toggleLike(e) {
  const button = e.currentTarget;
  const user = await getUser();

  if (!user) {
    localStorage.setItem("pompkin_auth_return", "/Pompkin/bids.html");
    location.href = "login.html";
    return;
  }

  button.disabled = true;

  const { data, error } = await supabase.rpc("toggle_pompkin_auction_like", {
    p_auction_id: button.dataset.auctionId
  });

  if (error) {
    console.error(error);
    button.disabled = false;
    return;
  }

  button.classList.toggle("liked", !!data?.liked);
  button.setAttribute("aria-pressed", String(!!data?.liked));
  button.innerHTML = `${data?.liked ? "♥ Liked" : "♡ Like"} <span>(${data?.count || 0})</span>`;
  button.disabled = false;
}

async function submitComment(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const message = form.parentElement.querySelector("[data-comment-message]");
  const text = form.comment.value.trim();

  const user = await getUser();
  if (!user) {
    localStorage.setItem("pompkin_auth_return", "/Pompkin/bids.html");
    location.href = "login.html";
    return;
  }

  if (!text) {
    message.textContent = "Write something first 𐙚";
    return;
  }

  const { error } = await supabase
    .from("pompkin_auction_comments")
    .insert({
      auction_id: form.dataset.auctionId,
      user_id: user.id,
      comment_text: text
    });

  if (error) {
    message.textContent = error.message;
    return;
  }

  form.comment.value = "";
  message.textContent = "Comment added 𐙚";
  await render();
}

render();
