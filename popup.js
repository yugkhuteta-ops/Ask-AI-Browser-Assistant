(() => {
    const btn = document.getElementById("open-options");
    if (btn) {
        btn.addEventListener("click", () => {
            chrome.runtime.openOptionsPage();
        });
    }

    const providerSelect = document.getElementById("provider-select");
    if (providerSelect) {
        // Load current provider
        chrome.storage.sync.get({ ai_provider: "chatgpt" }, ({ ai_provider }) => {
            providerSelect.value = ai_provider;
        });

        // Persist provider immediately
        providerSelect.addEventListener("change", (e) => {
            chrome.storage.sync.set({ ai_provider: e.target.value });
        });
    }
})();

