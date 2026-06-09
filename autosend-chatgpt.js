/**
 * autosend.js — ChatGPT autosend content script
 * Injects pending prompt text into ChatGPT's editor and clicks Send.
 *
 * Fixes applied:
 * - Replaced deprecated execCommand with InputEvent + textContent approach
 * - Debounced send guard prevents race conditions between load/focus/custom events
 * - Send button selector scoped to composer area to avoid matching sidebar buttons
 */

async function waitForEl(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const check = () => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - t0 > timeout) return reject("Timeout: " + selector);
      setTimeout(check, 300);
    };
    check();
  });
}

/**
 * Injects text into ChatGPT's contenteditable editor using modern APIs.
 * Works with React/ProseMirror by dispatching proper InputEvents.
 */
async function sendPrompt(text) {
  try {
    // Wait for ChatGPT's input area
    const editor = await waitForEl(
      "#prompt-textarea, [contenteditable='true']"
    );
    editor.focus();

    // Clear existing content
    editor.textContent = "";

    // Use InputEvent (modern replacement for execCommand)
    // This properly notifies React/ProseMirror of the change
    const inputEvent = new InputEvent("beforeinput", {
      inputType: "insertText",
      data: text,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    editor.dispatchEvent(inputEvent);

    // Also set textContent as a fallback and fire input event
    // This ensures the editor visually shows the text even if
    // beforeinput wasn't fully handled by the framework
    if (!editor.textContent || editor.textContent.trim() !== text.trim()) {
      editor.textContent = text;
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    // Wait for React to process the state update and enable the Send button
    await new Promise(r => setTimeout(r, 600));

    // Find Send button scoped to the composer area (avoids matching sidebar buttons)
    const composer =
      document.querySelector('[id="composer-background"]') ||
      document.querySelector("form") ||
      document;

    const sendBtn = composer.querySelector(
      'button[data-testid="send-button"], button[aria-label="Send prompt"]'
    );

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      // Fallback: press Enter in the editor
      editor.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
          cancelable: true,
          composed: true
        })
      );
    }
  } catch (err) {
    console.warn("[Ask ChatGPT] autosend failed:", err);
  }
}

async function debugPendingPrompt() {
  try {
    const { pendingPrompt } = await chrome.storage.local.get("pendingPrompt");
    if (pendingPrompt) {
      console.debug("[Ask ChatGPT] pendingPrompt present (length):", String(pendingPrompt).length);
    } else {
      console.debug("[Ask ChatGPT] pendingPrompt empty");
    }
  } catch (err) {
    console.debug("[Ask ChatGPT] debugPendingPrompt error:", err);
  }
}


/**
 * Debounced, guarded autosend entry point.
 * Prevents double-sends from load + focus + custom event all firing.
 * Does NOT remove pendingPrompt until the editor is confirmed present.
 */
let sending = false;

async function tryAutoSend() {
  if (sending) return;
  sending = true;
  try {
    const { pendingPrompt } = await chrome.storage.local.get("pendingPrompt");
    if (!pendingPrompt) return;

    // Wait for the editor to be ready BEFORE removing the prompt
    // This prevents the race where the prompt is consumed but the editor isn't ready
    await waitForEl("#prompt-textarea, [contenteditable='true']", 10000);

    // Now it's safe to consume the prompt
    await chrome.storage.local.remove("pendingPrompt");
    await sendPrompt(pendingPrompt);
  } catch (err) {
    console.warn("[Ask ChatGPT] autosend failed:", err);
  } finally {
    sending = false;
  }
}

// Single debounced trigger — all event sources go through this
let debounceTimer = null;
function scheduleSend(delay = 500) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(tryAutoSend, delay);
}

// Self-start: if a prompt is already present when the content script loads,
// handle it deterministically (fixes “event fired too early” scenarios).
scheduleSend(0);
debugPendingPrompt();

// Page load (new tab)
window.addEventListener("load", () => scheduleSend(1000));

// Existing tab reactivated via background.js (legacy CustomEvent)
window.addEventListener("ai-autosend", () => scheduleSend(400));

// New trigger: background service worker sends a runtime message
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "AI_AUTOSEND") {
    scheduleSend(400);
  }
});

// Tab gains focus (user switches back)
window.addEventListener("focus", () => scheduleSend(300));
