const promptInput = document.getElementById("prompt");
const styleSelect = document.getElementById("style");
const sizeSelect = document.getElementById("size");
const generateButton = document.getElementById("generate");
const resultImage = document.getElementById("resultImage");
const emptyPreview = document.getElementById("emptyPreview");
const emptyTitle = document.getElementById("emptyTitle");
const emptyHint = document.getElementById("emptyHint");
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const statusBox = document.getElementById("status");
const downloadButton = document.getElementById("download");
const newTabButton = document.getElementById("newTab");
const studioGrid = document.getElementById("studioGrid");
const wallpaperTab = document.getElementById("wallpaperTab");
const logoTab = document.getElementById("logoTab");
const wallpaperOptions = document.getElementById("wallpaperOptions");
const logoOptions = document.getElementById("logoOptions");
const panelTitle = document.getElementById("panelTitle");
const modeTabs = [wallpaperTab, logoTab];

// The API key stays in the Cloudflare Worker secret; the browser calls only this endpoint.
const IMAGE_API_URL = "https://hello-world-curly-water-4b09.ribbaobrien.workers.dev/generate";

let activeMode = "wallpaper";
let currentImageUrl = null;
let currentObjectUrl = null;

const dimensions = {
  phone: "1024x1536",
  tablet: "1024x1536",
  desktop: "1536x1024",
  square: "1024x1024"
};

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    promptInput.value = chip.dataset.prompt;
    promptInput.focus();
  });
});

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function clearPreview() {
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = null;
  currentImageUrl = null;
  resultImage.removeAttribute("src");
  resultImage.hidden = true;
  emptyPreview.hidden = false;
  downloadButton.disabled = true;
  newTabButton.disabled = true;
}

function setMode(mode) {
  activeMode = mode;
  const isLogo = mode === "logo";
  wallpaperTab.setAttribute("aria-selected", String(!isLogo));
  logoTab.setAttribute("aria-selected", String(isLogo));
  wallpaperOptions.hidden = isLogo;
  logoOptions.hidden = !isLogo;
  studioGrid.classList.toggle("logo-mode", isLogo);
  panelTitle.textContent = isLogo ? "Design your business logo" : "Describe your dream";
  generateButton.innerHTML = isLogo
    ? '<span>✦</span> Generate my logo <span class="arrow">→</span>'
    : '<span>✦</span> Generate my wallpaper <span class="arrow">→</span>';
  emptyTitle.innerHTML = isLogo ? "Your new brand<br>starts here." : "Your next favourite<br>wallpaper starts here.";
  emptyHint.textContent = isLogo ? "Add your details and create a logo idea" : "Write a prompt and hit generate";
  resultImage.alt = isLogo ? "Your generated business logo" : "Your generated AI wallpaper";
  loadingText.textContent = isLogo ? "Designing your logo…" : "Dreaming up your wallpaper…";
  downloadButton.textContent = isLogo ? "↓ Download logo" : "↓ Download wallpaper";
  setStatus(isLogo ? "Choose your business details, then create a logo." : "");
  clearPreview();
}

modeTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (generateButton.disabled) return;
    setMode(tab === logoTab ? "logo" : "wallpaper");
  });
});

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  modeTabs.forEach((tab) => { tab.disabled = isLoading; });
  generateButton.innerHTML = isLoading
    ? `<span>✦</span> Creating your ${activeMode === "logo" ? "logo" : "wallpaper"}…`
    : activeMode === "logo"
      ? '<span>✦</span> Generate my logo <span class="arrow">→</span>'
      : '<span>✦</span> Generate my wallpaper <span class="arrow">→</span>';
  loadingText.textContent = activeMode === "logo" ? "Designing your logo…" : "Dreaming up your wallpaper…";
  loadingOverlay.hidden = !isLoading;
}

function buildLogoPrompt() {
  const name = document.getElementById("businessName").value.trim();
  const tagline = document.getElementById("tagline").value.trim();
  const industry = document.getElementById("industry").value;
  const logoStyle = document.getElementById("logoStyle").value;
  const colors = document.getElementById("logoColors").value;
  const taglineText = tagline ? `Include the tagline exactly as “${tagline}”.` : "Do not add a tagline.";
  return `Design a polished, original business logo for “${name}” in the ${industry} industry. Show the business name exactly as “${name}”. ${taglineText} Use a ${logoStyle} design style and ${colors}. Create a simple memorable symbol paired with the name, with clear readable lettering and a balanced layout. Flat graphic design, centered on a plain white background. Logo only: no mockup, no extra words, no watermark.`;
}

generateButton.addEventListener("click", async () => {
  let fullPrompt;
  let imageSize;

  if (activeMode === "logo") {
    const name = document.getElementById("businessName").value.trim();
    if (!name) {
      setStatus("Enter your business name to create a logo.", true);
      document.getElementById("businessName").focus();
      return;
    }
    fullPrompt = buildLogoPrompt();
    imageSize = "1024x1024";
  } else {
    const prompt = promptInput.value.trim();
    if (!prompt) {
      setStatus("Add a description of the wallpaper you want.", true);
      promptInput.focus();
      return;
    }
    fullPrompt = `${prompt}, ${styleSelect.value}, beautiful wallpaper composition, high quality, no text, no watermark`;
    imageSize = dimensions[sizeSelect.value];
  }

  const turnstileToken = window.pixelDreamTurnstile?.getToken("imageChallenge");
  if (!turnstileToken) {
    setStatus("Complete the security check above before creating an image.", true);
    return;
  }

  setLoading(true);
  setStatus("Connecting to the AI image generator…");

  try {
    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: fullPrompt,
        size: imageSize,
        turnstileToken
      })
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      throw new Error(details || `Image generation failed (${response.status}).`);
    }

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      throw new Error("The image service returned an unexpected response.");
    }
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(blob);
    currentImageUrl = currentObjectUrl;
    resultImage.src = currentObjectUrl;
    resultImage.hidden = false;
    emptyPreview.hidden = true;
    downloadButton.disabled = false;
    newTabButton.disabled = false;
    setStatus(activeMode === "logo" ? "Your logo idea is ready. Download it to keep it! ✨" : "Your wallpaper is ready. Enjoy your new screen! ✨");
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", true);
  } finally {
    window.pixelDreamTurnstile?.reset("imageChallenge");
    setLoading(false);
  }
});

downloadButton.addEventListener("click", () => {
  if (!currentImageUrl) return;
  const link = document.createElement("a");
  link.href = currentImageUrl;
  link.download = activeMode === "logo" ? "pixel-dream-business-logo.png" : "pixel-dream-wallpaper.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
});

newTabButton.addEventListener("click", () => {
  if (currentImageUrl) window.open(currentImageUrl, "_blank", "noopener");
});

document.getElementById("phoneClock").textContent = new Intl.DateTimeFormat([], {
  hour: "2-digit", minute: "2-digit", hour12: false
}).format(new Date());
document.querySelector(".phone-date").textContent = new Intl.DateTimeFormat([], {
  weekday: "long", month: "long", day: "numeric"
}).format(new Date());
