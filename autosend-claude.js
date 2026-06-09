/**
 * autosend-claude.js — Claude.ai autosend content script
 * Injects pending prompt text into Claude's ProseMirror editor and clicks Send.
 *
 * Claude uses a ProseMirror-based contenteditable div, similar to ChatGPT.
 * We use InputEvent + textContent approach for framework compatibility.
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
 * Injects text into Claude's contenteditable editor.
 */
async function sendPrompt(text) {
  try {
    // Claude's input: ProseMirror contenteditable div
    const editor = await waitForEl(
      'div[contenteditable="true"].ProseMirror, ' +
      'div[contenteditable="true"][data-placeholder], ' +
      'fieldset div[contenteditable="true"], ' +
      'div[contenteditable="true"]'
    );
    editor.focus();

    // Clear existing content
    editor.textContent = "";

    // Dispatch InputEvent for ProseMirror state sync
    const inputEvent = new InputEvent("beforeinput", {
      inputType: "insertText",
      data: text,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    editor.dispatchEvent(inputEvent);

    // Fallback: set textContent directly and fire input event
    if (!editor.textContent || editor.textContent.trim() !== text.trim()) {
      editor.textContent = text;
    }
    editor.dispatchEvent(new Event("input", { bubbles: true }));

    // Wait for Claude to process the state update
    await new Promise(r => setTimeout(r, 800));

    // Find Send button — Claude uses aria-label="Send Message" or similar
    const sendBtn = document.querySelector(
      'button[aria-label="Send Message"], ' +
      'button[aria-label="Send message"], ' +
      'button[data-testid="send-button"]'
    );

    if (sendBtn && !sendBtn.disabled) {
      sendBtn.click();
    } else {
      // Fallback: press Enter
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
    console.warn("[Ask AI] Claude autosend failed:", err);
  }
}

function debugAutofill(text) {
  try {
    console.debug("[Ask Claude] tryAutoSend sending length:", String(text).length);
  } catch (e) { }
}


async function debugPendingPrompt() {
  try {
    const { pendingPrompt } = await chrome.storage.local.get("pendingPrompt");
    if (pendingPrompt) {
      console.debug("[Ask Claude] pendingPrompt present (length):", String(pendingPrompt).length);
    } else {
      console.debug("[Ask Claude] pendingPrompt empty");
    }
  } catch (err) {
    console.debug("[Ask Claude] debugPendingPrompt error:", err);
  }
}


/**
 * Debounced, guarded autosend entry point.
 */
let sending = false;

async function tryAutoSend() {
  if (sending) return;
  sending = true;
  try {
    const { pendingPrompt } = await chrome.storage.local.get("pendingPrompt");
    if (!pendingPrompt) return;

    // Wait for editor before consuming prompt
    await waitForEl(
      'div[contenteditable="true"].ProseMirror, ' +
      'div[contenteditable="true"]',
      10000
    );

    await chrome.storage.local.remove("pendingPrompt");
    await sendPrompt(pendingPrompt);
  } catch (err) {
    console.warn("[Ask AI] Claude autosend failed:", err);
  } finally {
    sending = false;
  }
}

// Single debounced trigger
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
window.addEventListener("load", () => scheduleSend(1200));

// Existing tab reactivated via background.js
window.addEventListener("ai-autosend", () => scheduleSend(400));

// New trigger: background service worker sends a runtime message
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "AI_AUTOSEND") {
    scheduleSend(400);
  }
});

// Tab gains focus
window.addEventListener("focus", () => scheduleSend(300));
