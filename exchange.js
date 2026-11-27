(() => {
  const API_URL = "https://hello-world-curly-water-4b09.ribbaobrien.workers.dev/trades";
  const createTab = document.getElementById("createWorkspaceTab");
  const exchangeTab = document.getElementById("exchangeWorkspaceTab");
  const createWorkspace = document.getElementById("createWorkspace");
  const exchangeWorkspace = document.getElementById("exchangeWorkspace");
  const form = document.getElementById("listingForm");
  const feed = document.getElementById("listingFeed");
  const status = document.getElementById("exchangeStatus");
  const search = document.getElementById("listingSearch");
  const postButton = document.getElementById("postListing");
  let listings = [];
  let loading = false;

  function setExchangeStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function ownListingToken(id) {
    try {
      return localStorage.getItem(`pixel-dream-swap-token:${id}`);
    } catch {
      return null;
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently posted";
    return new Intl.DateTimeFormat([], {dateStyle:"medium"}).format(date);
  }

  const swapStopWords = new Set(["the", "and", "for", "with", "from", "into", "that", "this", "your", "our", "you", "are", "was", "were", "have", "has", "need", "want", "wanted", "offer", "offered", "trade", "swap", "item", "items", "product", "products", "service", "services", "some", "any", "other"]);

  function itemTerms(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g)?.filter((term) => term.length >= 3 && !swapStopWords.has(term)) || [];
  }

  function itemMatchScore(wantedItem, offeredItem) {
    const wanted = itemTerms(wantedItem);
    const offered = new Set(itemTerms(offeredItem));
    const shared = new Set(wanted.filter((term) => offered.has(term)));
    if (!shared.size) return 0;
    const normalizePhrase = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return shared.size + (normalizePhrase(wantedItem) === normalizePhrase(offeredItem) ? 2 : 0);
  }

  function renderSwapChains() {
    const swapFeed = document.getElementById("swapChainFeed");
    if (!swapFeed) return;
    const chains = [];
    const seen = new Set();

    for (let i = 0; i < listings.length - 2; i++) {
      for (let j = i + 1; j < listings.length - 1; j++) {
        for (let k = j + 1; k < listings.length; k++) {
          const group = [listings[i], listings[j], listings[k]];
          const companyNames = group.map((listing) => String(listing.company || "").trim().toLowerCase());
          if (new Set(companyNames).size !== 3) continue;

          for (const order of [[group[0], group[1], group[2]], [group[0], group[2], group[1]]]) {
            const scores = [
              itemMatchScore(order[0].wantedItem, order[1].offeredItem),
              itemMatchScore(order[1].wantedItem, order[2].offeredItem),
              itemMatchScore(order[2].wantedItem, order[0].offeredItem)
            ];
            if (scores.some((score) => score === 0)) continue;

            const keys = order.map((listing) => String(listing.id || `${listing.company}:${listing.offeredItem}`));
            const rotations = [
              keys.join("|"),
              [keys[1], keys[2], keys[0]].join("|"),
              [keys[2], keys[0], keys[1]].join("|")
            ];
            const key = rotations.sort()[0];
            if (seen.has(key)) continue;
            seen.add(key);
            chains.push({order, score:scores.reduce((sum, score) => sum + score, 0)});
          }
        }
      }
    }

    chains.sort((a, b) => b.score - a.score);
    if (!chains.length) {
      swapFeed.innerHTML = '<div class="listing-message">No complete three-company swap loops yet. Add offers that match what other companies want.</div>';
      return;
    }

    swapFeed.innerHTML = chains.slice(0, 3).map(({order}) => {
      const steps = order.map((receiver, index) => {
        const provider = order[(index + 1) % order.length];
        return `<div class="swap-chain-step"><span class="swap-chain-step-company">${escapeHtml(receiver.company)}</span><span class="swap-chain-step-arrow">gets</span><strong>${escapeHtml(provider.offeredItem)}</strong><span class="swap-chain-step-provider">from ${escapeHtml(provider.company)}</span></div>`;
      }).join("");
      const contacts = order.map((listing) => {
        const address = encodeURIComponent(listing.contactEmail || "");
        return `<a href="mailto:${address}?subject=${encodeURIComponent("Possible three-company swap")}" aria-label="Email ${escapeHtml(listing.company)}">${escapeHtml(listing.company)}</a>`;
      }).join(" · ");
      return `<article class="swap-chain-card">
        <div class="swap-chain-card-top"><strong>THREE-WAY MATCH</strong><span>Each company gets a wanted item</span></div>
        <div class="swap-chain-steps">${steps}</div>
        <p class="swap-chain-contacts">Contact all three: ${contacts}</p>
      </article>`;
    }).join("");
  }

  function renderListings() {
    renderSwapChains();
    const query = search.value.trim().toLowerCase();
    const matches = listings.filter((listing) =>
      [listing.company, listing.offeredItem, listing.wantedItem, listing.location, listing.details]
        .join(" ").toLowerCase().includes(query)
    );

    if (!matches.length) {
      feed.innerHTML = `<div class="listing-message">${query ? "No swap offers match that search." : "No swap offers yet. Post the first one for your company."}</div>`;
      return;
    }

    feed.innerHTML = matches.map((listing) => {
      const contact = encodeURIComponent(listing.contactEmail || "");
      const location = listing.location ? `<span>⌖ ${escapeHtml(listing.location)}</span>` : "";
      const details = listing.details ? `<p class="listing-details">${escapeHtml(listing.details)}</p>` : "";
      const removeButton = ownListingToken(listing.id)
        ? `<button class="remove-listing" type="button" data-remove-listing="${escapeHtml(listing.id)}">Remove my offer</button>`
        : "";
      return `<article class="listing-card">
        <div class="listing-card-top"><span class="listing-badge">SWAP OFFER</span><span>${escapeHtml(formatDate(listing.createdAt))}</span></div>
        <h3>${escapeHtml(listing.offeredItem)}</h3>
        <p class="listing-wanted"><strong>Wants in return:</strong> ${escapeHtml(listing.wantedItem)}</p>
        ${details}
        <div class="listing-company"><strong>${escapeHtml(listing.company)}</strong>${location}</div>
        <div class="listing-actions"><a class="contact-link" href="mailto:${contact}?subject=${encodeURIComponent("Pixel Dream swap offer")}">Contact company ↗</a>${removeButton}</div>
      </article>`;
    }).join("");
  }

  async function loadListings() {
    if (loading) return;
    loading = true;
    feed.innerHTML = '<div class="listing-message">Loading swap offers…</div>';
    document.getElementById("swapChainFeed").innerHTML = '<div class="listing-message">Checking for three-company matches…</div>';
    try {
      const response = await fetch(API_URL, {headers:{"Accept":"application/json"}});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || result.message || "Swap offers are unavailable right now.");
      listings = Array.isArray(result.listings) ? result.listings : [];
      renderListings();
    } catch (error) {
      feed.innerHTML = `<div class="listing-message">${escapeHtml(error.message || "Could not load swap offers. Please refresh.")}</div>`;
      document.getElementById("swapChainFeed").innerHTML = '<div class="listing-message">Swap chain matches will appear when offers are available.</div>';
    } finally {
      loading = false;
    }
  }

  createTab.addEventListener("click", () => {
    createTab.setAttribute("aria-selected", "true");
    exchangeTab.setAttribute("aria-selected", "false");
    createWorkspace.hidden = false;
    exchangeWorkspace.hidden = true;
  });

  exchangeTab.addEventListener("click", () => {
    createTab.setAttribute("aria-selected", "false");
    exchangeTab.setAttribute("aria-selected", "true");
    createWorkspace.hidden = true;
    exchangeWorkspace.hidden = false;
    loadListings();
  });

  document.getElementById("refreshListings").addEventListener("click", loadListings);
  search.addEventListener("input", renderListings);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    postButton.disabled = true;
    setExchangeStatus("Posting your swap offer…");

    const body = {
      company: document.getElementById("companyName").value.trim(),
      offeredItem: document.getElementById("offeredItem").value.trim(),
      wantedItem: document.getElementById("wantedItem").value.trim(),
      location: document.getElementById("tradeLocation").value.trim(),
      contactEmail: document.getElementById("businessEmail").value.trim(),
      details: document.getElementById("tradeDetails").value.trim(),
      publicContactConsent: document.getElementById("publicContactConsent").checked,
      website: document.getElementById("tradeWebsite").value.trim()
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {"Content-Type":"application/json", "Accept":"application/json"},
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || result.message || "Could not post your swap offer.");
      if (result.deleteToken && result.listing?.id) {
        try {
          localStorage.setItem(`pixel-dream-swap-token:${result.listing.id}`, result.deleteToken);
        } catch {}
      }
      form.reset();
      setExchangeStatus("Your offer is posted. Companies can now contact you.");
      await loadListings();
    } catch (error) {
      setExchangeStatus(error.message || "Could not post your swap offer. Please try again.", true);
    } finally {
      postButton.disabled = false;
    }
  });

  feed.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-listing]");
    if (!button) return;
    const id = button.dataset.removeListing;
    const token = ownListingToken(id);
    if (!token) return;
    button.disabled = true;
    try {
      const response = await fetch(API_URL, {
        method:"DELETE",
        headers:{"Content-Type":"application/json", "Accept":"application/json"},
        body:JSON.stringify({id, deleteToken:token})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || result.message || "Could not remove that offer.");
      try { localStorage.removeItem(`pixel-dream-swap-token:${id}`); } catch {}
      listings = listings.filter((listing) => listing.id !== id);
      renderListings();
    } catch (error) {
      button.disabled = false;
      setExchangeStatus(error.message || "Could not remove that offer.", true);
    }
  });
})();
