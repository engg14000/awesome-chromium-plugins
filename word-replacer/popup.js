document.addEventListener('DOMContentLoaded', () => {
  const findInput = document.getElementById('find-word');
  const replaceInput = document.getElementById('replace-word');
  const saveBtn = document.getElementById('save-btn');
  const resetBtn = document.getElementById('reset-btn');
  const counterEl = document.getElementById('counter');
  const statusEl = document.getElementById('save-status');

  // Load existing data
  chrome.storage.local.get(['findWord', 'replaceWord', 'lifetimeCount'], (result) => {
    if (result.findWord) findInput.value = result.findWord;
    if (result.replaceWord) replaceInput.value = result.replaceWord;
    if (result.lifetimeCount !== undefined) {
      counterEl.textContent = result.lifetimeCount.toLocaleString();
    }
  });

  // Save changes
  saveBtn.addEventListener('click', () => {
    const findWord = findInput.value.trim();
    const replaceWord = replaceInput.value; // Can be empty or contain spaces

    chrome.storage.local.set({ findWord, replaceWord }, () => {
      statusEl.textContent = 'Saved! Reload tabs to apply.';
      setTimeout(() => {
        statusEl.textContent = '';
      }, 2000);
    });
  });

  // Reset counter
  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset your lifetime replacement count?')) {
      chrome.storage.local.set({ lifetimeCount: 0 }, () => {
        counterEl.textContent = '0';
      });
    }
  });

  // Listen for storage changes to update counter in real-time
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.lifetimeCount) {
      counterEl.textContent = changes.lifetimeCount.newValue.toLocaleString();
    }
  });
});
