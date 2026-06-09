/**
 * options.js — Ask AI Options Page
 *
 * Loads/saves the selected AI provider from chrome.storage.sync.
 * Updates the button preview in real-time when the user selects a provider.
 */

const PROVIDERS = {
  chatgpt: {
    label: "Ask ChatGPT",
    gradient: "linear-gradient(135deg, #10a37f, #0e8f6e)",
    accent: "#10a37f"
  },

  gemini: {
    label: "Ask Gemini",
    gradient: "linear-gradient(135deg, #4285f4, #356ac3)",
    accent: "#4285f4"
  },
  perplexity: {
    label: "Ask Perplexity",
    gradient: "linear-gradient(135deg, #20b8a0, #1a9882)",
    accent: "#20b8a0"
  }
};

// DOM elements
const radios = document.querySelectorAll('input[name="ai_provider"]');
const previewButton = document.getElementById("preview-button");
const previewLabel = document.getElementById("preview-label");
const statusBar = document.getElementById("status-bar");

/**
 * Update the preview button to match the selected provider.
 */
function updatePreview(provider) {
  const config = PROVIDERS[provider];
  if (!config) return;

  previewLabel.textContent = config.label;
  previewButton.style.background = config.gradient;

  // Update selection highlight color
  const mark = document.getElementById("preview-selection");
  if (mark) {
    mark.style.background = `${config.accent}33`; // 20% opacity
  }
}

/**
 * Show the "Settings saved" status bar briefly.
 */
function showStatus() {
  statusBar.classList.add("visible");
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => {
    statusBar.classList.remove("visible");
  }, 2000);
}

/**
 * Save the selected provider to chrome.storage.sync.
 */
function saveProvider(provider) {
  chrome.storage.sync.set({ ai_provider: provider }, () => {
    updatePreview(provider);
    showStatus();
  });
}

/**
 * Load the saved provider on page open.
 */
function loadProvider() {
  chrome.storage.sync.get({ ai_provider: "chatgpt" }, ({ ai_provider }) => {
    const radio = document.querySelector(
      `input[name="ai_provider"][value="${ai_provider}"]`
    );
    if (radio) {
      radio.checked = true;
    }
    updatePreview(ai_provider);
  });
}

// Event listeners
radios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    saveProvider(e.target.value);
  });
});

// Initialize
document.addEventListener("DOMContentLoaded", loadProvider);
