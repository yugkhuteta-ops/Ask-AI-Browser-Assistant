# Ask ChatGPT Extension

A productivity-focused browser extension that lets users instantly send selected text from any webpage to ChatGPT with a single click.

Instead of manually copying text, opening ChatGPT, pasting content, and writing a prompt, the extension reduces the workflow to:

Select Text → Click "Ask ChatGPT" → Get AI Assistance

## Demo

### Selecting Text and Ask Button

![Selection](assets-selection.png)


### Prompt Auto Send

![Autosend](assets-autosend.png)

---

# Why I Built This

While studying and researching online, I found myself constantly switching between webpages and ChatGPT.

The workflow looked like this:

1. Select text
2. Copy
3. Open ChatGPT
4. Paste
5. Write prompt
6. Send

Repeating this dozens of times a day became frustrating.

I wanted a way to ask ChatGPT about any piece of content directly from the page I was reading.

This project was built to eliminate that friction.

---

# Features

* Floating "Ask ChatGPT" button near selected text
* One-click AI workflow
* Automatic prompt transfer
* ChatGPT tab reuse
* Context menu integration
* Manifest V3 architecture
* Lightweight and fast

---

# How It Works

```text
User Selects Text
        ↓
Floating Ask ChatGPT Button Appears
        ↓
Extension Captures Selection
        ↓
Background Service Worker Receives Request
        ↓
Prompt Stored Temporarily
        ↓
ChatGPT Tab Opened / Reused
        ↓
Prompt Injected Automatically
        ↓
Message Sent
```

---

# Tech Stack

## Frontend

* HTML
* CSS
* JavaScript

## Browser APIs

* Chrome Extension Manifest V3
* Content Scripts
* Runtime Messaging
* Context Menus API
* Storage API
* Scripting API

---

# Project Architecture

## popup-bar.js

Responsible for:

* Detecting selected text
* Displaying the floating action button
* Sending user requests to the extension backend

## background.js

Acts as the extension coordinator.

Responsibilities:

* Receive messages
* Store prompts
* Locate existing ChatGPT tabs
* Open new tabs when required
* Trigger autosend workflows

## autosend-chatgpt.js

Responsible for:

* Detecting ChatGPT's input box
* Injecting text
* Triggering automatic submission

---

# Engineering Challenges

This project became much more complex than initially expected.

---

## Challenge 1: Service Worker Lifecycle

Manifest V3 extensions use service workers that automatically sleep when inactive.

Problem:

Messages occasionally failed because the service worker was not immediately available.

Solution:

Implemented retry logic and message recovery strategies.

---

## Challenge 2: Timing & Race Conditions

Sometimes ChatGPT loaded after the extension tried to inject text.

Result:

The prompt was consumed but never actually submitted.

Solution:

Added delayed execution, retries, and event synchronization mechanisms.

---

## Challenge 3: Dynamic AI Interfaces

Modern AI websites frequently update their DOM structures.

Problems included:

* Missing send buttons
* Changing selectors
* Different editor implementations

Solution:

Created provider-specific autosend logic and fallback selectors.

---

## Challenge 4: Browser Security Restrictions

Encountered:

* Content Security Policy (CSP) restrictions
* Inline script execution failures
* Extension context invalidation errors

Solution:

Refactored scripts into compliant external files and improved error handling.

---

# Bugs Fixed During Development

Some notable issues solved during development:

### Extension Context Invalidated

Issue:

```text
Uncaught Error: Extension context invalidated
```

Cause:

Content scripts were executing during page navigation.

Fix:

Added safer selection handling and defensive error recovery.

---

### Service Worker Communication Failures

Issue:

Messages occasionally failed to reach the extension backend.

Fix:

Implemented retry mechanisms and more reliable event triggering.

---

### Autosend Timing Failures

Issue:

Prompts arrived but were not automatically submitted.

Fix:

Improved synchronization between page load events and autosend execution.

---

### CSP Violations

Issue:

Inline scripts were blocked by browser security policies.

Fix:

Migrated all logic to dedicated JavaScript files.

---

# What I Learned

This project taught me:

* Browser Extension Development
* Manifest V3 Architecture
* Event-Driven Systems
* Browser Security Models
* Content Script Injection
* Runtime Messaging
* Debugging Production Issues
* UX-Oriented Product Design

More importantly, it showed me that seemingly simple ideas often require solving a surprising number of engineering problems.

---

# Future Roadmap

Planned improvements:

* Quick Summary Popup
* Explain Like I'm 15 Mode
* Notes Generation
* Keyboard Shortcuts
* Prompt Templates
* Multi-Model Support
* Research Assistant Workflows

---

# Project Status

Current Version: MVP

The extension successfully transforms a repetitive multi-step workflow into a single action, helping users access AI assistance faster while browsing, studying, or researching.

---

# Author

Yug Khunteta

BITS Pilani Goa Campus (ECE)

Building productivity tools, AI workflows, and automation projects.
