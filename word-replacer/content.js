// Replace text recursively in text nodes
function replaceTextOnPage(findWordsString, replaceWord) {
  if (!findWordsString) return 0;
  
  let matchCount = 0;
  
  // Split by comma, trim whitespace, filter empty, escape regex chars
  const words = findWordsString.split(',')
    .map(w => w.trim())
    .filter(w => w.length > 0)
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    
  if (words.length === 0) return 0;
  
  // Join words with '|' for OR matching
  const regexPattern = `\\b(?:${words.join('|')})\\b`;
  const regex = new RegExp(regexPattern, 'gi');

  const walk = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        // Skip script, style, and noscript tags
        if (node.parentNode && 
           (node.parentNode.nodeName === 'SCRIPT' || 
            node.parentNode.nodeName === 'STYLE' || 
            node.parentNode.nodeName === 'NOSCRIPT' ||
            node.parentNode.nodeName === 'TEXTAREA' ||
            node.parentNode.isContentEditable)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    },
    false
  );

  let node;
  const nodesToReplace = [];

  while (node = walk.nextNode()) {
    if (regex.test(node.nodeValue)) {
      nodesToReplace.push(node);
    }
    regex.lastIndex = 0; // reset regex state
  }

  nodesToReplace.forEach(n => {
    const originalValue = n.nodeValue;
    const matches = originalValue.match(regex);
    if (matches) {
      matchCount += matches.length;
      n.nodeValue = originalValue.replace(regex, replaceWord);
    }
  });

  return matchCount;
}

// Check local storage and run replacement
chrome.storage.local.get(['findWord', 'replaceWord'], (result) => {
  const findWord = result.findWord;
  const replaceWord = result.replaceWord || '';

  if (findWord) {
    const count = replaceTextOnPage(findWord, replaceWord);
    if (count > 0) {
      chrome.runtime.sendMessage({ action: 'incrementCount', count: count });
    }
  }
});

// Listen for fireworks trigger from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'triggerFireworks') {
    showFireworks(request.milestone);
  }
});

function showFireworks(milestone) {
  const overlay = document.createElement('div');
  overlay.className = 'wrp-firework-overlay';
  
  const message = document.createElement('div');
  message.className = 'wrp-message';
  message.textContent = `🎉 WOW! ${milestone.toLocaleString()} Replacements! 🎉`;
  overlay.appendChild(message);

  // Generate particles for the firework effect
  const colors = ['#ff0040', '#00ff40', '#4000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff'];
  
  // Create 3 bursts
  for (let b = 0; b < 3; b++) {
    const originX = 30 + Math.random() * 40; // 30% to 70%
    const originY = 30 + Math.random() * 40; // 30% to 70%
    const delay = b * 0.4;

    for (let i = 0; i < 60; i++) {
      const particle = document.createElement('div');
      particle.className = 'wrp-particle';
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      
      // Random directions in a circle
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * 250 + 50;
      particle.style.setProperty('--tx', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--ty', `${Math.sin(angle) * distance}px`);
      
      // Set burst origin
      particle.style.left = `${originX}%`;
      particle.style.top = `${originY}%`;
      
      // Apply delay
      particle.style.animationDelay = `${delay + Math.random() * 0.2}s`;
      
      overlay.appendChild(particle);
    }
  }

  document.body.appendChild(overlay);

  // Remove overlay after the animation completes
  setTimeout(() => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }, 4500);
}
