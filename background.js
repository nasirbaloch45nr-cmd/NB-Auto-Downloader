let downloadedUrls = new Set();
let clipSequenceCounter = 1;

// Load sequence & history from local storage
chrome.storage.local.get(['downloadedUrls', 'clipSequenceCounter'], (res) => {
  if (res.downloadedUrls) downloadedUrls = new Set(res.downloadedUrls);
  if (res.clipSequenceCounter) clipSequenceCounter = res.clipSequenceCounter;
});

function getFormattedDateTime() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${dd}${mm}${yy}_${hh}${min}${ss}`;
}

function processAndDownloadMedia(mediaList, saveFolder) {
  if (!mediaList || mediaList.length === 0) return 0;

  let downloadedCount = 0;

  mediaList.forEach((item) => {
    if (downloadedUrls.has(item.url)) return; // Avoid duplicate download

    downloadedUrls.add(item.url);
    downloadedCount++;

    const seqStr = String(clipSequenceCounter).padStart(3, '0');
    const dateTimeStr = getFormattedDateTime();
    const ext = item.isVideo ? 'mp4' : 'webp';
    const folder = saveFolder ? `${saveFolder}/` : 'GoogleFlow_Media/';

    // Structure: Folder / Clip_001_PromptTitle_DDMMYY_HHMMSS.ext
    const filename = `${folder}Clip_${seqStr}_${item.promptText}_${dateTimeStr}.${ext}`;

    clipSequenceCounter++;

    chrome.downloads.download({
      url: item.url,
      filename: filename,
      conflictAction: 'uniquify'
    });
  });

  // Save progress
  chrome.storage.local.set({
    downloadedUrls: Array.from(downloadedUrls),
    clipSequenceCounter: clipSequenceCounter
  });

  return downloadedCount;
}

// Background monitoring loop
let monitoringIntervalId = null;

function startAutoMonitoring(tabId) {
  if (monitoringIntervalId) clearInterval(monitoringIntervalId);

  monitoringIntervalId = setInterval(() => {
    chrome.storage.local.get(['isMonitoring', 'saveFolder', 'dlVideos', 'dlImages'], (settings) => {
      if (!settings.isMonitoring) {
        clearInterval(monitoringIntervalId);
        monitoringIntervalId = null;
        return;
      }

      chrome.tabs.sendMessage(tabId, {
        action: 'scanAndDownload',
        dlVideos: settings.dlVideos ?? true,
        dlImages: settings.dlImages ?? true
      }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.mediaList) {
          processAndDownloadMedia(response.mediaList, settings.saveFolder);
        }
      });
    });
  }, 3000); // Check every 3 seconds
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadCurrentPage') {
    chrome.storage.local.get(['saveFolder', 'dlVideos', 'dlImages'], (settings) => {
      chrome.tabs.sendMessage(request.tabId, {
        action: 'scanAndDownload',
        dlVideos: settings.dlVideos ?? true,
        dlImages: settings.dlImages ?? true
      }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ status: 'Page reload karke try karein!' });
        } else if (response && response.mediaList) {
          const count = processAndDownloadMedia(response.mediaList, settings.saveFolder);
          sendResponse({ status: count > 0 ? `${count} new clips downloaded!` : 'No new complete media found' });
        } else {
          sendResponse({ status: 'No complete media found' });
        }
      });
    });
    return true;
  }

  if (request.action === 'startMonitoring') {
    startAutoMonitoring(request.tabId);
    sendResponse({ status: 'Monitoring Active...' });
    return true;
  }

  if (request.action === 'stopMonitoring') {
    if (monitoringIntervalId) {
      clearInterval(monitoringIntervalId);
      monitoringIntervalId = null;
    }
    sendResponse({ status: 'Monitoring Stopped' });
    return true;
  }

  if (request.action === 'resetHistory') {
    downloadedUrls.clear();
    clipSequenceCounter = 1;
    chrome.storage.local.set({
      downloadedUrls: [],
      clipSequenceCounter: 1
    });
    sendResponse({ status: 'History & sequence reset!' });
    return true;
  }
});
