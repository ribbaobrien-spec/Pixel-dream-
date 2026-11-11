const promptInput = document.getElementById("prompt");
const styleSelect = document.getElementById("style");
const sizeSelect = document.getElementById("size");
const generateButton = document.getElementById("generate");
const resultImage = document.getElementById("resultImage");
const emptyPreview = document.getElementById("emptyPreview");
const loadingOverlay = document.getElementById("loadingOverlay");
const statusBox = document.getElementById("status");
const downloadButton = document.getElementById("download");
const newTabButton = document.getElementById("newTab");

// Replace this with your deployed Cloudflare Worker URL, ending in /generate.
const IMAGE_API_URL = "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev/generate";

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

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  generateButton.innerHTML = isLoading
    ? '<span>✦</span> Creating your wallpaper…'
    : '<span>✦</span> Generate my wallpaper <span class="arrow">→</span>';
  loadingOverlay.hidden = !isLoading;
}

generateButton.addEventListener("click", async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus("Add a description of the wallpaper you want.", true);
    promptInput.focus();
    return;
  }
  if (IMAGE_API_URL.includes("YOUR-WORKER-NAME")) {
    setStatus("The secure image service is not connected yet. Finish the Cloudflare setup first.", true);
    return;
  }

  const fullPrompt = `${prompt}, ${styleSelect.value}, beautiful wallpaper composition, high quality, no text, no watermark`;
  setLoading(true);
  setStatus("Connecting to the AI image generator…");

  try {
    const response = await fetch(IMAGE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: fullPrompt,
        size: dimensions[sizeSelect.value]
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
