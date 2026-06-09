/**
 * popup-bar.js — Floating "Ask AI" button content script
 *
 * Shows a floating button near selected text on any webpage.
 * Dynamically brands itself based on the user's selected AI provider.
 * Excluded from AI platform domains via manifest exclude_matches.
 */

const PROVIDER_STYLES = {
    chatgpt: {
        label: "Ask ChatGPT",
        gradient: "linear-gradient(135deg, #10a37f, #0e8f6e)",
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
    </svg>`
    },
    claude: {
        label: "Ask Claude",
        gradient: "linear-gradient(135deg, #d97757, #c4623f)",
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="10" r="1"/>
    </svg>`
    },
    gemini: {
        label: "Ask Gemini",
        gradient: "linear-gradient(135deg, #4285f4, #356ac3)",
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      <path d="M12 6l1.5 3.5L17 11l-3.5 1.5L12 16l-1.5-3.5L7 11l3.5-1.5z"/>
    </svg>`
    },
    perplexity: {
        label: "Ask Perplexity",
        gradient: "linear-gradient(135deg, #20b8a0, #1a9882)",
        icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
      <line x1="11" y1="8" x2="11" y2="14"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>`
    }
};

function getProviderStyle(provider) {
    return PROVIDER_STYLES[provider] || PROVIDER_STYLES.chatgpt;
}

/**
 * Pure helper for clamping button position (testable).
 * Uses a similar sizing model to existing hard-coded offsets.
 */
function getClampedPosition(x, y, innerWidth, innerHeight, btnWidth = 180, btnHeight = 44) {
    const left = Math.max(0, Math.min(x, innerWidth - btnWidth));
    const top = y;

    // Clamp top so it never goes off-screen
    const clampedTop = Math.max(8, Math.min(top, innerHeight - btnHeight));
    return { left, top: clampedTop };
}

let btn = null;
let toolbar = null;
let currentProvider = "chatgpt";

const PROVIDER_ORDER = ["chatgpt", "gemini", "perplexity"];

/**
 * Load the user's selected AI provider.
 */
function loadProvider() {
    chrome.storage.sync.get({ ai_provider: "chatgpt" }, ({ ai_provider }) => {
        currentProvider = ai_provider;
        applyBranding();
    });
}

/**
 * Listen for provider changes (user updates options page while browsing).
 */
if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" && changes.ai_provider) {
            currentProvider = changes.ai_provider.newValue;
            applyBranding();
        }
    });
}

/**
 * Apply the correct label, color, and icon based on the current provider.
 */
function applyBranding() {
    if (!btn) return;
    const style = getProviderStyle(currentProvider);
    btn.style.background = style.gradient;

    const iconEl = btn.querySelector(".__ask-ai-icon__");
    const labelEl = btn.querySelector(".__ask-ai-label__");
    if (iconEl) iconEl.innerHTML = style.icon;
    if (labelEl) labelEl.textContent = style.label;

    if (toolbar) {
        toolbar.querySelectorAll(".__ask-ai-toolbtn__").forEach(toolBtn => {
            const provider = toolBtn.dataset.provider;
            const pStyle = PROVIDER_STYLES[provider];
            const isSelected = provider === currentProvider;
            toolBtn.style.background = isSelected ? pStyle.gradient : 'rgba(255,255,255,0.08)';
            toolBtn.style.boxShadow = isSelected ? "0 2px 8px rgba(0,0,0,0.3)" : "none";
        });
    }
}

function createToolbar() {
    if (toolbar) return;

    toolbar = document.createElement("div");
    toolbar.id = "__ask-ai-toolbar__";
    toolbar.innerHTML = PROVIDER_ORDER.map((provider, idx) => {
        const style = PROVIDER_STYLES[provider];
        const isSelected = provider === currentProvider;
        return `<button class="__ask-ai-toolbtn__" data-provider="${provider}" style="
            width: 36px;
            height: 36px;
            border: none;
            border-radius: 10px;
            background: ${isSelected ? style.gradient : 'rgba(255,255,255,0.08)'};
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
            ${isSelected ? 'box-shadow: 0 2px 8px rgba(0,0,0,0.3);' : ''}
        " title="${style.label.replace('Ask ', '')}">
            ${style.icon}
        </button>`;
    }).join("");

    Object.assign(toolbar.style, {
        position: "fixed",
        zIndex: "2147483647",
        display: "none",
        flexDirection: "column",
        gap: "6px",
        padding: "8px",
        background: "rgba(15, 23, 36, 0.95)",
        borderRadius: "14px",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        opacity: "0"
    });

    toolbar.querySelectorAll(".__ask-ai-toolbtn__").forEach(toolBtn => {
        toolBtn.addEventListener("click", (e) => {
            const provider = e.currentTarget.dataset.provider;
            currentProvider = provider;
            applyBranding();
            chrome.storage.sync.set({ ai_provider: provider });
            const selText = window.getSelection()?.toString().trim() || "";
            if (selText) {
                try {
                    chrome.runtime.sendMessage({ type: "ASK_AI", text: selText });
                } catch (err) {
                    // ignore
                }
            }
            hide();
        });

        toolBtn.addEventListener("mouseenter", () => {
            if (toolBtn.style.background.includes("rgba(255,255,255,0.08)")) {
                toolBtn.style.background = "rgba(255,255,255,0.12)";
            }
        });
        toolBtn.addEventListener("mouseleave", () => {
            if (toolBtn.style.background.includes("rgba(255,255,255,0.12)")) {
                toolBtn.style.background = "rgba(255,255,255,0.08)";
            }
        });
    });

    document.body.appendChild(toolbar);
}

function createBtn() {
    if (btn) return;
    createToolbar();
    const style = getProviderStyle(currentProvider);

    btn = document.createElement("div");
    btn.id = "__ask-ai-btn__";
    btn.innerHTML = `
    <span class="__ask-ai-icon__">${style.icon}</span>
    <span class="__ask-ai-label__">${style.label}</span>`;

    Object.assign(btn.style, {
        position: "fixed",
        zIndex: "2147483647",
        isolation: "isolate",
        background: style.gradient,
        color: "#fff",
        padding: "6px 12px",
        borderRadius: "20px",
        fontSize: "13px",
        fontFamily: "'Segoe UI', sans-serif",
        fontWeight: "600",
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        display: "none",
        alignItems: "center",
        gap: "6px",
        userSelect: "none",
        transition: "transform 0.1s, opacity 0.15s",
        opacity: "0",
        pointerEvents: "auto"
    });

    btn.addEventListener("mouseenter", () => {
        btn.style.transform = "scale(1.05)";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.transform = "scale(1)";
    });
    btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        let selected = "";
        try {
            selected = window.getSelection()?.toString().trim() || "";
        } catch (e) {
            selected = "";
        }
        if (selected) {
            try {
                const p = chrome.runtime.sendMessage({ type: "ASK_AI", text: selected });
                if (p && typeof p.catch === "function") {
                    p.catch(() => {
                        try {
                            chrome.runtime.sendMessage({ type: "ASK_AI", text: selected });
                        } catch (e) {
                            // ignore
                        }
                    });
                }
            } catch (e) {
                // ignore
            }
            hide();
        }
    });
    document.body.appendChild(btn);
}

function showGroupAtRect(rect) {
    if (!btn) createBtn();
    if (!toolbar) createToolbar();

    document.body.appendChild(btn);
    document.body.appendChild(toolbar);
    btn.style.display = "flex";
    toolbar.style.display = "flex";

    const btnWidth = 180;
    const btnHeight = 44;
    const toolbarWidth = 52;
    const toolbarHeight = 156;
    const gap = 8;

    // Position toolbar to the right of selection, button below it (grouped)
    const toolbarLeft = rect.right + 10;
    const toolbarTop = rect.top;

    // Position button to the right of selection (aligned with top, or below toolbar if needed)
    const hasRoomForRightAlign = toolbarLeft + toolbarWidth + btnWidth <= window.innerWidth;
    let preferredLeft, preferredTop;

    if (hasRoomForRightAlign) {
        // Both toolbar and button fit on right side
        preferredLeft = toolbarLeft;
        preferredTop = rect.top;
    } else {
        // Not enough room on right - align button below selection
        preferredLeft = rect.left + rect.width / 2 - btnWidth / 2;
        preferredTop = rect.bottom + 20;
    }

    // Clamp positions
    const { left: btnLeft, top: btnTop } = getClampedPosition(
        Math.max(0, Math.min(preferredLeft, window.innerWidth - btnWidth)),
        Math.max(8, Math.min(preferredTop, window.innerHeight - btnHeight)),
        window.innerWidth,
        window.innerHeight,
        btnWidth,
        btnHeight
    );

    const { left: tbLeft, top: tbTop } = getClampedPosition(
        Math.max(0, Math.min(toolbarLeft, window.innerWidth - toolbarWidth)),
        Math.max(8, Math.min(toolbarTop, window.innerHeight - toolbarHeight)),
        window.innerWidth,
        window.innerHeight,
        toolbarWidth,
        toolbarHeight
    );

    btn.style.left = `${btnLeft}px`;
    btn.style.top = `${btnTop}px`;
    toolbar.style.left = `${tbLeft}px`;
    toolbar.style.top = `${tbTop}px`;

    requestAnimationFrame(() => {
        btn.style.opacity = "1";
        toolbar.style.opacity = "1";
    });
}

/**
 * Returns a bounding rect for the current selection (works for normal pages and
 * most embedded/zoomed layouts). Returns null if no usable selection rect exists.
 */
function getSelectionRect() {
    try {
        const sel = window.getSelection?.();
        if (!sel || sel.rangeCount === 0) return null;

        // Guard: avoid showing for collapsed/empty selections
        const text = sel.toString?.() || "";
        // PDFs can yield very short/fragmented selections; only block empty.
        if (!text.trim() || text.trim().length === 0) return null;

        const range = sel.getRangeAt(0);

        // Many selection types produce 0-sized rects; try multiple strategies.
        let rect = range.getBoundingClientRect?.();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            // Fallback for edge/pdf selections: use client rects (often more reliable)
            const clientRects = range.getClientRects?.();
            if (clientRects && clientRects.length > 0) {
                // Pick the first non-zero rect
                for (let i = 0; i < clientRects.length; i++) {
                    const r = clientRects[i];
                    if (r && r.width > 0 && r.height > 0) {
                        rect = r;
                        break;
                    }
                }
            }
        }

        if (!rect) return null;
        if (rect.width === 0 && rect.height === 0) return null;

        return rect;
    } catch {
        return null;
    }
}

function showGroupFallback(e) {
    if (!btn) createBtn();
    if (!toolbar) createToolbar();

    if (!btn || !toolbar) return;
    if (e && typeof e.clientX === "number" && typeof e.clientY === "number") {
        const btnWidth = 180;
        const btnHeight = 44;
        const toolbarWidth = 52;

        document.body.appendChild(btn);
        document.body.appendChild(toolbar);

        // Try above mouse position, fallback below
        const aboveTop = e.clientY - btnHeight - 8;
        const hasRoomAbove = aboveTop >= 8;

        const preferredTop = hasRoomAbove ? e.clientY - btnHeight - 8 : e.clientY + 20;
        const hasRoomForRightAlign = e.clientX + toolbarWidth + btnWidth <= window.innerWidth;

        let preferredLeft;
        if (hasRoomForRightAlign) {
            preferredLeft = Math.max(0, e.clientX + toolbarWidth + 8);
            toolbar.style.left = `${Math.max(0, e.clientX)}px`;
            toolbar.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - 156))}px`;
        } else {
            preferredLeft = e.clientX - btnWidth / 2;
            toolbar.style.left = `${Math.max(0, e.clientX)}px`;
            toolbar.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - 156))}px`;
        }

        const { left, top } = getClampedPosition(
            preferredLeft,
            preferredTop,
            window.innerWidth,
            window.innerHeight,
            btnWidth,
            btnHeight
        );

        btn.style.left = `${left}px`;
        btn.style.top = `${top}px`;
        btn.style.display = "flex";
        toolbar.style.display = "flex";
        requestAnimationFrame(() => {
            btn.style.opacity = "1";
            toolbar.style.opacity = "1";
        });
    }
}

function hide() {
    if (btn) {
        btn.style.opacity = "0";
        btn.style.display = "none";
    }
    if (toolbar) {
        toolbar.style.opacity = "0";
        toolbar.style.display = "none";
    }
}

const SELECTION_DEBOUNCE_MS = 50;
let selectionTimer = null;

function scheduleSelectionUpdate(e) {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(() => {
        const rect = getSelectionRect();
        const selText = window.getSelection?.()?.toString?.()?.trim?.() || "";

        if (rect) {
            showGroupAtRect(rect);
            return;
        }

        if (selText.length > 0 && e) {
            showGroupFallback(e);
            return;
        }

        hide();
    }, SELECTION_DEBOUNCE_MS);
}

document.addEventListener(
    "selectionchange",
    (e) => {
        if (btn && e && (btn.contains(e.target) || (toolbar && toolbar.contains(e.target)))) return;
        scheduleSelectionUpdate(e);
    },
    true
);

document.addEventListener("mouseup", (e) => {
    if (btn && (btn.contains(e.target) || (toolbar && toolbar.contains(e.target)))) return;

    if (e && typeof e.clientX === "number" && typeof e.clientY === "number") {
        showGroupFallback(e);
    }

    scheduleSelectionUpdate(e);
});

document.addEventListener("mousedown", (e) => {
    if (btn && !btn.contains(e.target) && (!toolbar || !toolbar.contains(e.target))) hide();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
});

/* istanbul ignore next */
if (typeof module !== "undefined") {
    module.exports = {
        PROVIDER_STYLES,
        getProviderStyle,
        getClampedPosition
    };
}

/* istanbul ignore next */
if (typeof chrome !== "undefined" && chrome.storage?.sync && typeof document !== "undefined") {
    // Initialize
    loadProvider();
    createBtn();
}

