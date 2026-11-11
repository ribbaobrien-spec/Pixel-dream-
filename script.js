const promptInput = document.getElementById("prompt");
const styleSelect = document.getElementById("style");
const sizeSelect = document.getElementById("size");
const apiKeyInput = document.getElementById("apiKey");
const generateButton = document.getElementById("generate");
const resultImage = document.getElementById("resultImage");
const emptyPreview = document.getElementById("emptyPreview");
const loadingOverlay = document.getElementById("loadingOverlay");
const statusBox = document.getElementById("status");
const downloadButton = document.getElementById("download");
const newTabButton = document.getElementById("newTab");
let currentImageUrl = null;
let currentObjectUrl = null;

const dimensions = {
  phone: { width: 1024, height: 1792 },
  tablet: { width: 1152, height: 1536 },
  desktop: { width: 1792, height: 1024 },
  square: { width: 1024, height: 1024 }
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

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  generateButton.innerHTML = isLoading
    ? '<span>✦</span> Creating your wallpaper…'
    : '<span>✦</span> Generate my wallpaper <span class="arrow">→</span>';
  loadingOverlay.hidden = !isLoading;
}

generateButton.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  const apiKey = apiKeyInput.value.trim();
  if (!prompt) {
    setStatus("Add a description of the wallpaper you want.", true);
    promptInput.focus();
    return;
  }
  if (!apiKey) {
    setStatus("Add your Pollinations API key first. Use the Get an API key link above.", true);
    apiKeyInput.focus();
    return;
  }

  const { width, height } = dimensions[sizeSelect.value];
  const fullPrompt = `${prompt}, ${styleSelect.value}, beautiful wallpaper composition, high quality, no text, no watermark`;
  const url = new URL("https://gen.pollinations.ai/image/" + encodeURIComponent(fullPrompt));
  url.searchParams.set("model", "black-forest-labs/flux.1-schnell");
  url.searchParams.set("width", width);
  url.searchParams.set("height", height);
  url.searchParams.set("nologo", "true");
  url.searchParams.set("safe", "true");
  url.searchParams.set("seed", Math.floor(Math.random() * 1000000000));

  setLoading(true);
  setStatus("Connecting to the image generator…");
  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: "Bearer " + apiKey }
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      if (response.status === 401 || response.status === 403) {
        throw new Error("Your API key was not accepted. Check it and try again.");
      }
      if (response.status === 429) {
        throw new Error("The image service is busy or your account has reached its limit. Try again later.");
      }
      throw new Error("Image generation failed (" + response.status + "). " + details.slice(0, 140));
    }
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) {
      throw new Error("The image service returned an unexpected response. Please try again.");
    }
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = URL.createObjectURL(blob);
    currentImageUrl = currentObjectUrl;
    resultImage.src = currentObjectUrl;
    resultImage.hidden = false;
    emptyPreview.hidden = true;
    downloadButton.disabled = false;
    newTabButton.disabled = false;
    setStatus("Your wallpaper is ready. Enjoy your new screen! ✨");
  } catch (error) {
    setStatus(error.message || "Something went wrong. Please try again.", true);
  } finally {
    setLoading(false);
  }
});

downloadButton.addEventListener("click", () => {
  if (!currentImageUrl) return;
  const link = document.createElement("a");
  link.href = currentImageUrl;
  link.download = "pixel-dream-wallpaper.png";
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
