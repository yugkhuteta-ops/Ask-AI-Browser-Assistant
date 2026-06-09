# TODO - Fix bugs + add requested UX

## Critical bug fixes (current)
- [x] Fix MV3 autosend triggering race by retrying `CustomEvent("ai-autosend")` in `background.js`.
- [x] Make autosend scripts self-start deterministically (`scheduleSend(0)`) and add debug logs.
- [x] Strengthen background tab activation/focus before dispatching autosend.

## Provider support
- [ ] Fix Gemini + Perplexity auto-send (Claude removed).
- [x] Remove Claude UI/option.
- [ ] Adjust AI_CONFIG routing accordingly (Gemini/Perplexity + default behavior).

## Quality / Test coverage
- [x] Add Jest+jsdom unit tests for popup-bar helper logic
- [x] Refactor popup-bar.js to export testable pure helpers + guard chrome access in tests


## UX feature: “Tell in short” popup
- [ ] Implement a popup/modal UI that can:
  - accept a prompt (selected text + “tell in short” instruction)
  - show the response after provider returns
- [ ] Implement response capture flow (requires switching away from click-send-only approach).

## Validation
- [ ] Reload extension and verify:
  - Floating button sends and auto-submits for ChatGPT + Gemini + Perplexity
  - “Tell in short” popup shows response

