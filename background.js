/**
 * background.js — Service worker for Ask AI extension
 *
 * Multi-AI routing logic:
 * - Reads ai_provider from chrome.storage.sync (default: "chatgpt")
 * - Routes selected text to the correct AI platform
 * - For Gemini: uses ?prompt= URL parameter (no content script needed)
 * - For others: stores pendingPrompt and uses autosend content scripts
 */

const AI_CONFIG = {
  chatgpt: {
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    urlPattern: "https://chatgpt.com/*"
  },

  gemini: {
    name: "Gemini",
    url: "https://gemini.google.com/app",
    urlPattern: "https://gemini.google.com/*",
    usesUrlParam: false  // use pendingPrompt + autosend-gemini.js content script
  },
  perplexity: {
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    urlPattern: "https://www.perplexity.ai/*"
  }
};

/**
 * Create or update the context menu based on the selected provider.
 */
function updateContextMenu(provider) {
  const config = AI_CONFIG[provider] || AI_CONFIG.chatgpt;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "ask-ai",
      title: `Ask ${config.name}: "%s"`,
      contexts: ["selection"]
    });
  });
}

// On install/update: set up context menu with saved provider
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ ai_provider: "chatgpt" }, ({ ai_provider }) => {
    updateContextMenu(ai_provider);
  });
});

// Update context menu when provider changes in options page
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.ai_provider) {
    updateContextMenu(changes.ai_provider.newValue);
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "ask-ai" && info.selectionText) {
    sendToAI(info.selectionText.trim());
  }
});

// Handle messages from popup-bar.js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "ASK_AI" && msg.text) {
    sendToAI(msg.text.trim());
  }
});

/**
 * Main routing function.
 * Reads the selected AI provider and routes the text accordingly.
 */
function sendToAI(text) {
  chrome.storage.sync.get({ ai_provider: "chatgpt" }, ({ ai_provider }) => {
    const config = AI_CONFIG[ai_provider] || AI_CONFIG.chatgpt;

    if (config.usesUrlParam) {
      // Gemini: use URL parameter — no pendingPrompt or content script needed
      sendViaUrlParam(config, text);
    } else {
      // ChatGPT, Claude, Perplexity: use pendingPrompt + autosend content script
      sendViaPendingPrompt(config, text);
    }
  });
}

/**
 * Route via URL parameter (Gemini).
 * Opens or reuses a Gemini tab with ?prompt=text appended.
 */
function sendViaUrlParam(config, text) {
  const targetUrl = `${config.url}?prompt=${encodeURIComponent(text)}`;

  chrome.tabs.query({ url: config.urlPattern }, (tabs) => {
    if (tabs.length > 0) {
      // Reuse existing tab — navigate it to the prompt URL
      const target = tabs.sort(
        (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
      )[0];
      chrome.tabs.update(target.id, { active: true, url: targetUrl });
      chrome.windows.update(target.windowId, { focused: true });
    } else {
      chrome.tabs.create({ url: targetUrl });
    }
  });
}

/**
 * Route via pendingPrompt storage + autosend content script.
 * Used for ChatGPT, Claude, and Perplexity.
 */
function sendViaPendingPrompt(config, text) {
  chrome.storage.local.set({ pendingPrompt: text }, () => {
    chrome.tabs.query({ url: config.urlPattern }, (tabs) => {
      if (tabs.length > 0) {
        // Pick the most recently accessed tab
        const target = tabs.sort(
          (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
        )[0];

        chrome.tabs.update(target.id, { active: true });
        chrome.windows.update(target.windowId, { focused: true });

        // Notify content script to trigger autosend.
        // Avoid chrome.scripting.executeScript(func) which can violate CSP on
        // some pages by creating inline scripts.
        const notifyContentScript = () => {
          try {
            chrome.tabs.sendMessage(
              target.id,
              { type: "AI_AUTOSEND" },
              () => {
                if (chrome.runtime.lastError) {
                  console.warn(
                    "[Ask AI] sendMessage lastError:",
                    chrome.runtime.lastError.message
                  );
                }
              }
            );
          } catch (err) {
            console.warn("[Ask AI] notifyContentScript failed:", err);
          }
        };

        // Avoid spamming sendMessage while the tab is still navigating,
        // which can trigger "Extension context invalidated" in content scripts.
        //
        // Poll tab status/url for a short window, then notify content script once.
        const pollAndNotify = (attempt = 0) => {
          if (attempt > 10) return; // ~5s (10 * 500ms)
          chrome.tabs.get(target.id, (tab) => {
            if (!tab) return;
            const isComplete = tab.status === "complete";
            const urlOk = tab.url && tab.url.match(new RegExp(config.urlPattern.replace(/\*/g, ".*")));
            if (isComplete && urlOk) {
              notifyContentScript();
              return;
            }
            setTimeout(() => pollAndNotify(attempt + 1), 500);
          });
        };

        pollAndNotify();
      } else {
        chrome.tabs.create({ url: config.url });
      }
    });
  });
}
