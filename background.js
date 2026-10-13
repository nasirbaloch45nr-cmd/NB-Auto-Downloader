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

      const mediaItems = results[0].result; // Objects containing { url, type }

      chrome.storage.local.get(['downloadedHistory', 'fileCounter'], (data) => {
        let history = data.downloadedHistory || [];
        let counter = data.fileCounter || 1;
        let newFound = 0;

        mediaItems.forEach((item) => {
          if (!history.includes(item.url)) {
            history.push(item.url);
            newFound++;

            const fileNum = String(counter).padStart(3, '0');
            const ext = item.type === 'video' ? 'mp4' : 'webp';
            const fileName = `Flow_Media_${fileNum}.${ext}`;
            counter++;

            chrome.downloads.download({
              url: item.url,
              filename: fileName,
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
  const foundItems = [];
  const addedUrls = new Set();

  // 1. Detect Videos (<video> tags and <source> elements)
  document.querySelectorAll('video').forEach(video => {
    let src = video.src || video.currentSrc;
    if (src && !addedUrls.has(src)) {
      addedUrls.add(src);
      foundItems.push({ url: src, type: 'video' });
    }
    video.querySelectorAll('source').forEach(source => {
      if (source.src && !addedUrls.has(source.src)) {
        addedUrls.add(source.src);
        foundItems.push({ url: source.src, type: 'video' });
      }
    });
  });

  // 2. Detect Images (<img> tags)
  document.querySelectorAll('img').forEach(img => {
    let src = img.src || (img.dataset && img.dataset.src);
    if (src && !addedUrls.has(src)) {
      addedUrls.add(src);
      foundItems.push({ url: src, type: 'image' });
    }
  });

  // 3. Detect Background Images
  document.querySelectorAll('*').forEach(el => {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1] && !addedUrls.has(match[1])) {
        addedUrls.add(match[1]);
        foundItems.push({ url: match[1], type: 'image' });
      }
    }
  });

  return foundItems.filter(item => 
    item.url.startsWith('http') || item.url.startsWith('blob:') || item.url.startsWith('data:')
  );
}
