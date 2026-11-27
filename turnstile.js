(() => {
  const SITE_KEY = "0x4AAAAAAGVnhybMYBNUectZ";
  const configs = [
    ["imageChallenge", "image-generation"],
    ["swapChallenge", "swap-post"]
  ];
  const tokens = new Map();
  const widgetIds = new Map();

  window.pixelDreamTurnstile = {
    getToken(containerId) {
      return tokens.get(containerId) || "";
    },
    reset(containerId) {
      tokens.delete(containerId);
      const widgetId = widgetIds.get(containerId);
      if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
    }
  };

  window.pixelDreamTurnstileLoaded = () => {
    if (!window.turnstile) return;
    for (const [containerId, action] of configs) {
      const container = document.getElementById(containerId);
      if (!container || widgetIds.has(containerId)) continue;
      const widgetId = window.turnstile.render(container, {
        sitekey: SITE_KEY,
        theme: "dark",
        action,
        callback(token) {
          tokens.set(containerId, token);
        },
        "expired-callback"() {
          tokens.delete(containerId);
        },
        "error-callback"() {
          tokens.delete(containerId);
        }
      });
      widgetIds.set(containerId, widgetId);
    }
  };

  if (window.turnstile) window.pixelDreamTurnstileLoaded();
})();
