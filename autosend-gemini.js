/**
 * autosend-gemini.js — Gemini.ai autosend content script
 *
 * Reads `pendingPrompt` from chrome.storage.local, fills Gemini's prompt box,
 * and clicks the Send button.
 *
 * Note: Gemini's DOM can vary; this script tries a few common selectors.
 */

async function waitForEl(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const t0 = Date.now();
        const check = () => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            if (Date.now() - t0 > timeout) return reject("Timeout: " + selector);
            setTimeout(check, 250);
        };
        check();
    });
}

function findComposer() {
    // Common patterns: textarea, contenteditable div, role textbox.
    return (
        document.querySelector('textarea[aria-label*="Message"], textarea') ||
        document.querySelector('[role="textbox"][aria-label*="Message"]') ||
        document.querySelector('[role="textbox"][contenteditable="true"]') ||
        document.querySelector('div[contenteditable="true"][role="textbox"]') ||
        document.querySelector('div[contenteditable="true"]')
    );
}

function findSendButton() {
    return (
        document.querySelector('button[aria-label*="Send"]') ||
        document.querySelector('button[aria-label*="submit"]') ||
        document.querySelector('button[type="submit"]')
    );
}

async function sendPrompt(text) {
    const composer = findComposer();
    if (!composer) throw new Error("Gemini composer not found");

    composer.focus();

    // textarea
    if (composer.tagName === "TEXTAREA" || composer instanceof HTMLTextAreaElement) {
        composer.value = "";
        composer.value = text;

        composer.dispatchEvent(new Event("input", { bubbles: true }));
        composer.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
        // contenteditable
        composer.textContent = "";
        composer.textContent = text;

        composer.dispatchEvent(
            new InputEvent("beforeinput", {
                inputType: "insertText",
                data: text,
                bubbles: true,
                cancelable: true,
                composed: true,
            })
        );
        composer.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // Wait a tick for UI to enable send
    await new Promise((r) => setTimeout(r, 600));

    const sendBtn = findSendButton();
    if (sendBtn && !sendBtn.disabled) {
        sendBtn.click();
        return;
    }

    // Fallback: press Enter
    composer.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            bubbles: true,
            cancelable: true,
            composed: true,
        })
    );
}

let sending = false;
async function tryAutoSend() {
    if (sending) return;
    sending = true;
    try {
        const { pendingPrompt } = await chrome.storage.local.get("pendingPrompt");
        if (!pendingPrompt) return;

        // Wait for composer to appear
        await Promise.race([
            waitForEl('[role="textbox"][contenteditable="true"], div[contenteditable="true"]', 10000).catch(() => null),
            waitForEl('textarea', 10000).catch(() => null),
        ]);

        await chrome.storage.local.remove("pendingPrompt");
        await sendPrompt(pendingPrompt);
    } catch (err) {
        console.warn("[Ask Gemini] autosend failed:", err);
    } finally {
        sending = false;
    }
}

let debounceTimer = null;
function scheduleSend(delay = 500) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tryAutoSend, delay);
}

// Start immediately
scheduleSend(0);

// Additional triggers
window.addEventListener("load", () => scheduleSend(1200));
window.addEventListener("focus", () => scheduleSend(400));

// Trigger from background via message
chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "AI_AUTOSEND") {
        scheduleSend(350);
    }
});

// debug pending prompt length
(async () => {
    try {
        const { pendingPrompt } = await chrome.storage.local.get("pendingPrompt");
        if (pendingPrompt) console.debug("[Ask Gemini] pendingPrompt length:", String(pendingPrompt).length);
    } catch { }
})();
