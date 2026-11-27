(() => {
  const installButton = document.getElementById("installApp");
  let installPrompt = null;

  if ("serviceWorker" in navigator) {
    const register = () => {
      navigator.serviceWorker.register("./service-worker.js")
        .catch((error) => console.error("Pixel Dream offline setup failed:", error));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }

  if (installButton) {
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      installButton.hidden = false;
    });

    installButton.addEventListener("click", async () => {
      if (!installPrompt) return;
      const prompt = installPrompt;
      installPrompt = null;
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } finally {
        installButton.hidden = true;
      }
    });

    window.addEventListener("appinstalled", () => {
      installPrompt = null;
      installButton.hidden = true;
    });
  }

  const status = document.getElementById("status");
  window.addEventListener("offline", () => {
    if (!status) return;
    status.textContent = "You're offline. The studio opens, but image generation needs internet.";
    status.classList.add("error");
  });

  window.addEventListener("online", () => {
    if (!status || !status.textContent.startsWith("You're offline.")) return;
    status.textContent = "Back online.";
    status.classList.remove("error");
  });
})();
