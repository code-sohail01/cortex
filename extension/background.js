chrome.tabs.onCreated.addListener((tab) => {
    // Check if the new tab is trying to open the default Chrome new tab page
    if (tab.pendingUrl === "chrome://newtab/" || tab.url === "chrome://newtab/") {
        // Instantly redirect it to your local index.html file
        chrome.tabs.update(tab.id, { 
            url: chrome.runtime.getURL("index.html") 
        });
    }
});