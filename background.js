let monitorInterval = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startMonitoring') {
    restartMonitoring();
    sendResponse({ status: 'started' });
  } else if (request.action === 'stopMonitoring') {
    stopMonitoring();
    sendResponse({ status: 'stopped' });
  } else if (request.action === 'getStatus') {
    sendResponse({ isRunning: monitorInterval !== null });
  } else if (request.action === 'updateInterval') {
    if (monitorInterval) {
      restartMonitoring();
    }
  }
  return true;
});

function startMonitoringTimer(intervalTime) {
  if (monitorInterval) clearInterval(monitorInterval);
  monitorInterval = setInterval(checkAndDownloadMedia, intervalTime);
}

function restartMonitoring() {
  chrome.storage.local.get(['checkInterval'], (data) => {
    const intervalTime = data.checkInterval || 3000;
    startMonitoringTimer(intervalTime);
  });
}

function stopMonitoring() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

function checkAndDownloadMedia() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: extractMediaUrls
    }, (results) => {
      if (!results || !results[0] || !results[0].result) return;

      const mediaItems = results[0].result.reverse();

      chrome.storage.local.get(['downloadedHistory', 'customFolder', 'dlVideos', 'dlImages'], (data) => {
        let history = data.downloadedHistory || [];
        let folder = (data.customFolder || 'GoogleFlow_Media').trim().replace(/[\\/:*?"<>|]/g, '');
        let allowVideos = data.dlVideos !== false;
        let allowImages = data.dlImages !== false;
        let newFound = 0;

        mediaItems.forEach((item) => {
          if (item.type === 'video' && !allowVideos) return;
          if (item.type === 'image' && !allowImages) return;

          if (!history.includes(item.url)) {
            history.push(item.url);
            newFound++;

            let safeTitle = item.title.replace(/[\\/:*?"<>|]/g, '_').trim();
            if (!safeTitle) safeTitle = 'Flow_Media';

            const ext = item.type === 'video' ? 'mp4' : 'webp';
            const fileName = `${safeTitle}.${ext}`;
            const savePath = folder ? `${folder}/${fileName}` : fileName;

            chrome.downloads.download({
              url: item.url,
              filename: savePath,
              conflictAction: 'uniquify'
            });
          }
        });

        if (newFound > 0) {
          chrome.storage.local.set({ downloadedHistory: history });
        }
      });
    });
  });
}

function extractMediaUrls() {
  const foundItems = [];
  const addedUrls = new Set();

  function getElementTitle(el) {
    return el.getAttribute('alt') || 
           el.getAttribute('title') || 
           el.getAttribute('aria-label') || 
           el.dataset.prompt || 
           '';
  }

  // 1. Detect Videos
  document.querySelectorAll('video').forEach(video => {
    let src = video.src || video.currentSrc;
    let title = getElementTitle(video) || getElementTitle(video.parentElement) || '';
    
    if (src && !addedUrls.has(src)) {
      addedUrls.add(src);
      foundItems.push({ url: src, type: 'video', title: title });
    }
    video.querySelectorAll('source').forEach(source => {
      if (source.src && !addedUrls.has(source.src)) {
        addedUrls.add(source.src);
        foundItems.push({ url: source.src, type: 'video', title: title });
      }
    });
  });

  // 2. Detect Images
  document.querySelectorAll('img').forEach(img => {
    let src = img.src || (img.dataset && img.dataset.src);
    let title = getElementTitle(img);
    if (src && !addedUrls.has(src)) {
      addedUrls.add(src);
      foundItems.push({ url: src, type: 'image', title: title });
    }
  });

  // 3. Detect Background Images
  document.querySelectorAll('*').forEach(el => {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1] && !addedUrls.has(match[1])) {
        addedUrls.add(match[1]);
        foundItems.push({ url: match[1], type: 'image', title: getElementTitle(el) });
      }
    }
  });

  return foundItems.filter(item => 
    item.url.startsWith('http') || item.url.startsWith('blob:') || item.url.startsWith('data:')
  );
}
