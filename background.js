let monitorInterval = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startMonitoring') {
    if (!monitorInterval) {
      monitorInterval = setInterval(checkAndDownloadMedia, 3000);
      sendResponse({ status: 'started' });
    }
  } else if (request.action === 'stopMonitoring') {
    clearInterval(monitorInterval);
    monitorInterval = null;
    sendResponse({ status: 'stopped' });
  } else if (request.action === 'getStatus') {
    sendResponse({ isRunning: monitorInterval !== null });
  }
});

function checkAndDownloadMedia() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: extractMediaUrls
    }, (results) => {
      if (!results || !results[0] || !results[0].result) return;

      const mediaUrls = results[0].result;

      chrome.storage.local.get(['downloadedHistory', 'fileCounter'], (data) => {
        let history = data.downloadedHistory || [];
        let counter = data.fileCounter || 1;
        let newFound = 0;

        mediaUrls.forEach((url) => {
          if (!history.includes(url)) {
            history.push(url);
            newFound++;

            const fileNum = String(counter).padStart(3, '0');
            const fileName = `Flow_Media_${fileNum}`;
            counter++;

            chrome.downloads.download({
              url: url,
              filename: `${fileName}.webp`,
              conflictAction: 'uniquify'
            });
          }
        });

        if (newFound > 0) {
          chrome.storage.local.set({ 
            downloadedHistory: history, 
            fileCounter: counter 
          });
        }
      });
    });
  });
}

function extractMediaUrls() {
  const foundUrls = new Set();
  document.querySelectorAll('img').forEach(img => {
    if (img.src) foundUrls.add(img.src);
    if (img.dataset && img.dataset.src) foundUrls.add(img.dataset.src);
  });
  document.querySelectorAll('*').forEach(el => {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1]) foundUrls.add(match[1]);
    }
  });
  return Array.from(foundUrls).filter(url => 
    url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')
  );
}
