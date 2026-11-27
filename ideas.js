(() => {
  const API_URL = "https://hello-world-curly-water-4b09.ribbaobrien.workers.dev/ideas";
  const createTab = document.getElementById("createWorkspaceTab");
  const exchangeTab = document.getElementById("exchangeWorkspaceTab");
  const ideasTab = document.getElementById("ideasWorkspaceTab");
  const createWorkspace = document.getElementById("createWorkspace");
  const exchangeWorkspace = document.getElementById("exchangeWorkspace");
  const ideasWorkspace = document.getElementById("ideasWorkspace");
  const form = document.getElementById("ideaForm");
  const feed = document.getElementById("ideaFeed");
  const status = document.getElementById("ideaStatus");
  const boardStatus = document.getElementById("ideaBoardStatus");
  const postButton = document.getElementById("postIdea");
  const displayNameInput = document.getElementById("ideaDisplayName");
  const messageInput = document.getElementById("ideaMessage");
  const replyContext = document.getElementById("replyContext");
  const replyContextText = document.getElementById("replyContextText");
  let messages = [];
  let loading = false;
  let replyTarget = null;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("error", isError);
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
    })[char]);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recently posted";
    return new Intl.DateTimeFormat([], {dateStyle:"medium",timeStyle:"short"}).format(date);
  }

  function ownMessageToken(id) {
    try {
      return localStorage.getItem("pixel-dream-idea-token:"+id);
    } catch {
      return null;
    }
  }

  function renderMessages() {
    if (!messages.length) {
      feed.innerHTML = '<div class="listing-message">No messages yet. Start the conversation and share what you’d like to see next.</div>';
      return;
    }

    feed.innerHTML = messages.map((item) => {
      const id = escapeHtml(item.id);
      const reply = item.inReplyTo
        ? '<p class="idea-reply-label">↳ Replying to <a href="#idea-'+escapeHtml(item.inReplyTo)+'">'+escapeHtml(item.inReplyToName || "Dreamer")+'</a></p>'
        : "";
      const removeButton = ownMessageToken(item.id)
        ? '<button class="idea-action" type="button" data-remove-idea="'+id+'">Remove my message</button>'
        : "";
      const text = escapeHtml(item.message).replace(/\n/g,"<br>");
      return '<article class="idea-card" id="idea-'+id+'">'+
        '<div class="idea-card-top"><strong>'+escapeHtml(item.displayName || "Dreamer")+'</strong><time>'+escapeHtml(formatDate(item.createdAt))+'</time></div>'+
        reply+
        '<p class="idea-card-message">'+text+'</p>'+
        '<div class="idea-actions"><button class="idea-action" type="button" data-reply-idea="'+id+'">Reply</button>'+removeButton+'</div>'+
        '</article>';
    }).join("");
  }

  async function loadMessages(silent = false) {
    if (loading) return;
    loading = true;
    if (!silent && !messages.length) {
      feed.innerHTML = '<div class="listing-message">Loading the conversation…</div>';
    }
    try {
      const response = await fetch(API_URL,{headers:{"Accept":"application/json"},cache:"no-store"});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The conversation is unavailable right now.");
      messages = Array.isArray(result.messages) ? result.messages : [];
      renderMessages();
      boardStatus.textContent = messages.length ? messages.length+" message"+(messages.length===1?"":"s")+" · refreshes while you’re here." : "No messages yet.";
      boardStatus.classList.remove("error");
    } catch (error) {
      boardStatus.textContent = error.message || "Could not load the conversation. Please refresh.";
      boardStatus.classList.add("error");
      if (!silent && !messages.length) {
        feed.innerHTML = '<div class="listing-message">The conversation could not load. Please try again.</div>';
      }
    } finally {
      loading = false;
    }
  }

  function activateWorkspace(active) {
    const selected = {create:active==="create",exchange:active==="exchange",ideas:active==="ideas"};
    createTab.setAttribute("aria-selected",String(selected.create));
    exchangeTab.setAttribute("aria-selected",String(selected.exchange));
    ideasTab.setAttribute("aria-selected",String(selected.ideas));
    createWorkspace.hidden = !selected.create;
    exchangeWorkspace.hidden = !selected.exchange;
    ideasWorkspace.hidden = !selected.ideas;
    if (selected.ideas) loadMessages();
  }

  createTab.addEventListener("click",() => activateWorkspace("create"));
  exchangeTab.addEventListener("click",() => activateWorkspace("exchange"));
  ideasTab.addEventListener("click",() => activateWorkspace("ideas"));
  document.getElementById("refreshIdeas").addEventListener("click",() => loadMessages());
  document.getElementById("cancelIdeaReply").addEventListener("click",() => {
    replyTarget = null;
    replyContext.hidden = true;
    replyContextText.textContent = "";
  });

  feed.addEventListener("click",async (event) => {
    const replyButton = event.target.closest("[data-reply-idea]");
    if (replyButton) {
      const selected = messages.find((item) => item.id === replyButton.dataset.replyIdea);
      if (!selected) return;
      replyTarget = selected.id;
      replyContextText.textContent = "Replying to "+(selected.displayName || "Dreamer");
      replyContext.hidden = false;
      messageInput.focus();
      form.scrollIntoView({behavior:"smooth",block:"center"});
      return;
    }

    const removeButton = event.target.closest("[data-remove-idea]");
    if (!removeButton) return;
    const id = removeButton.dataset.removeIdea;
    const deleteToken = ownMessageToken(id);
    if (!deleteToken) return;
    removeButton.disabled = true;
    try {
      const response = await fetch(API_URL,{
        method:"DELETE",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify({id,deleteToken})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not remove that message.");
      try { localStorage.removeItem("pixel-dream-idea-token:"+id); } catch {}
      messages = messages.filter((item) => item.id !== id);
      renderMessages();
      boardStatus.textContent = "Your message was removed.";
    } catch (error) {
      removeButton.disabled = false;
      boardStatus.textContent = error.message || "Could not remove that message.";
      boardStatus.classList.add("error");
    }
  });

  form.addEventListener("submit",async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const turnstileToken = window.pixelDreamTurnstile?.getToken("ideaChallenge");
    if (!turnstileToken) {
      setStatus("Complete the security check above before sharing your message.",true);
      return;
    }

    postButton.disabled = true;
    setStatus("Sharing your message…");
    const body = {
      displayName:displayNameInput.value.trim(),
      message:messageInput.value.trim(),
      inReplyTo:replyTarget || "",
      website:document.getElementById("ideaWebsite").value.trim(),
      turnstileToken
    };

    try {
      const response = await fetch(API_URL,{
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body:JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not post your message.");
      if (result.deleteToken && result.message?.id) {
        try { localStorage.setItem("pixel-dream-idea-token:"+result.message.id,result.deleteToken); } catch {}
      }
      form.reset();
      replyTarget = null;
      replyContext.hidden = true;
      replyContextText.textContent = "";
      setStatus("Your message is on the board. Thanks for joining in.");
      await loadMessages();
    } catch (error) {
      setStatus(error.message || "Could not post your message. Please try again.",true);
    } finally {
      window.pixelDreamTurnstile?.reset("ideaChallenge");
      postButton.disabled = false;
    }
  });

  window.setInterval(() => {
    if (!ideasWorkspace.hidden && document.visibilityState === "visible") loadMessages(true);
  },20000);
})();