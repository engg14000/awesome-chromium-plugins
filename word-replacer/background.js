// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['lifetimeCount', 'findWord', 'replaceWord'], (result) => {
    if (result.lifetimeCount === undefined) {
      chrome.storage.local.set({ lifetimeCount: 0 });
    }
    if (result.findWord === undefined) {
      chrome.storage.local.set({ findWord: '', replaceWord: '' });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'incrementCount') {
    const addedCount = request.count;
    
    // Get current count, update it, and check for milestones
    chrome.storage.local.get(['lifetimeCount'], (result) => {
      const oldCount = result.lifetimeCount || 0;
      const newCount = oldCount + addedCount;
      
      chrome.storage.local.set({ lifetimeCount: newCount }, () => {
        // Check if we crossed a multiple of 100
        const oldHundreds = Math.floor(oldCount / 100);
        const newHundreds = Math.floor(newCount / 100);
        
        if (newHundreds > oldHundreds && newHundreds >= 1) {
          // Milestone crossed! Trigger fireworks in the tab that caused it
          if (sender.tab && sender.tab.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              action: 'triggerFireworks',
              milestone: newHundreds * 100
            });
          }
        }
      });
    });
    
    // Return true to indicate asynchronous response if needed (though we aren't sending one here)
    sendResponse({ success: true });
    return true;
  }
});
