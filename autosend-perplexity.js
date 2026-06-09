/**
 * autosend-perplexity.js — Perplexity.ai autosend content script
 * Injects pending prompt text into Perplexity's textarea and submits.
 *
 * Perplexity uses a standard <textarea> element, so we use the
 * native value setter + input event approach.
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
 * Injects text into Perplexity's textarea using native value setter.
 * This is the standard approach for React-controlled textarea elements.
 */
async function sendPrompt(text) {
  try {
    // Perplexity input can be either a textarea or a contenteditable textbox.
    // Prefer textarea if present, else fall back to common contenteditable containers.
    let editor = null;
    try {
      editor = await waitForEl(
        'textarea[placeholder*="Ask"], ' +
        'textarea[placeholder*="ask"], ' +
        'textarea[aria-label*="Ask"], ' +
        'textarea',
        5000
      );
    } catch (_) {
      // ignore; try contenteditable
    }

    if (editor && editor.tagName === "TEXTAREA") {
      editor.focus();

      // Use React's native setter to bypass synthetic event system
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      ).set;
      nativeInputValueSetter.call(editor, text);

      // Fire input + change events to notify React
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      editor = await waitForEl(
        "[role='textbox'][contenteditable='true'], div[contenteditable='true']",
        8000
      );
      editor.focus();
      editor.textContent = "";

      // Prose/contenteditable sync
      const inputEvent = new InputEvent("beforeinput", {
        inputType: "insertText",
        data: text,
        bubbles: true,
        cancelable: true,
        composed: true
      });
      editor.dispatchEvent(inputEvent);

      if (!editor.textContent || editor.textContent.trim() !== text.trim()) {
        editor.textContent = text;
      }
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    }


    // Wait for Perplexity to process and enable the submit button
    await new Promise(r => setTimeout(r, 600));

    // Find Submit button
    const submitBtn = document.querySelector(
      'button[aria-label="Submit"], ' +
      'button[aria-label="Ask"], ' +
      'button[type="submit"]'
    );

    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
    } else {
      // Fallback: try submitting by Enter on any found textbox
      const fallbackTarget =
        document.querySelector("textarea") ||
        document.querySelector("[role='textbox'][contenteditable='true']") ||
        document.querySelector("div[contenteditable='true']");

      if (fallbackTarget) {
        fallbackTarget.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true,
            composed: true
          })
        );
      } else {
        console.warn("[Ask Perplexity] No submit button and no fallback textbox found");
      }
    }
  } catch (err) {
    console.warn("[Ask AI] Perplexity autosend failed:", err);
  }
}

async function debugPendingPrompt() {
  try {
    const { pendingPrompt } = await chrome.storage.local.get("pendingPrompt");
    if (pendingPrompt) {
      console.debug("[Ask Perplexity] pendingPrompt present (length):", String(pendingPrompt).length);
    } else {
      console.debug("[Ask Perplexity] pendingPrompt empty");
    }
  } catch (err) {
    console.debug("[Ask Perplexity] debugPendingPrompt error:", err);
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

    console.debug("[Ask Perplexity] tryAutoSend pendingPrompt length:", String(pendingPrompt).length);

    // Wait for composer before consuming prompt.
    // Perplexity may not use a plain <textarea> (could be a contenteditable div).
    // Try both textarea and common contenteditable composer containers.
    await Promise.race([
      waitForEl("textarea", 10000).catch(() => null),
      waitForEl("div[contenteditable='true']", 10000).catch(() => null),
      waitForEl("[role='textbox'][contenteditable='true']", 10000).catch(() => null)
    ]);

    await chrome.storage.local.remove("pendingPrompt");
    await sendPrompt(pendingPrompt);

  } catch (err) {
    console.warn("[Ask AI] Perplexity autosend failed:", err);
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
