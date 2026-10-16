// File Name: background.js

let downloadedUrls = new Set();
let clipSequenceCounter = 1;
let downloadQueue = [];
let isProcessingQueue = false;
let totalDownloadedCount = 0;

let pendingGeneratingClips = new Map();

// Enable sidepanel behavior
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.storage.local.get(['downloadedUrls', 'clipSequenceCounter', 'totalDownloadedCount'], (res) => {
  if (res.downloadedUrls) downloadedUrls = new Set(res.downloadedUrls);
  if (res.clipSequenceCounter) clipSequenceCounter = res.clipSequenceCounter;
  if (res.totalDownloadedCount) totalDownloadedCount = res.totalDownloadedCount;
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

async function processQueue(saveFolder) {
  if (isProcessingQueue || downloadQueue.length === 0) return;
  isProcessingQueue = true;

  while (downloadQueue.length > 0) {
    const item = downloadQueue.shift();

    if (downloadedUrls.has(item.url)) continue;

    downloadedUrls.add(item.url);

    const seqStr = String(clipSequenceCounter).padStart(3, '0');
    const dateTimeStr = getFormattedDateTime();
    const ext = item.isVideo ? 'mp4' : 'jpg';
    const folder = saveFolder ? `${saveFolder}/` : 'GoogleFlow_Media/';

    const cleanPrompt = item.promptText || 'Prompt';
    const filename = `${folder}Clip_${seqStr}_${cleanPrompt}_${dateTimeStr}.${ext}`;

    clipSequenceCounter++;
    totalDownloadedCount++;

    chrome.downloads.download({
      url: item.url,
      filename: filename,
      conflictAction: 'uniquify'
    });

    chrome.storage.local.set({
      downloadedUrls: Array.from(downloadedUrls),
      clipSequenceCounter: clipSequenceCounter,
      totalDownloadedCount: totalDownloadedCount
    });

    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  isProcessingQueue = false;
}

function processAndDownloadMedia(mediaList, saveFolder) {
  if (!mediaList || mediaList.length === 0) return 0;

  const now = Date.now();
  let newAddedCount = 0;

  mediaList.forEach((item) => {
    if (downloadedUrls.has(item.url)) return;

    if (item.isGenerating) {
      if (!pendingGeneratingClips.has(item.url)) {
        pendingGeneratingClips.set(item.url, now);
      }
      const firstSeen = pendingGeneratingClips.get(item.url);
      const elapsedSeconds = (now - firstSeen) / 1000;

      if (elapsedSeconds < 30) {
        return;
      } else {
        pendingGeneratingClips.delete(item.url);
      }
    } else {
      pendingGeneratingClips.delete(item.url);
    }

    if (!downloadQueue.some(q => q.url === item.url)) {
      downloadQueue.push(item);
      newAddedCount++;
    }
  });

  if (newAddedCount > 0) {
    processQueue(saveFolder);
  }

  return newAddedCount;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'autoProcessMedia') {
    processAndDownloadMedia(request.mediaList, request.saveFolder);
    sendResponse({ status: 'Processed' });
    return true;
  }

  if (request.action === 'downloadCurrentPage') {
    chrome.storage.local.get(['saveFolder', 'dlVideos', 'dlImages'], (settings) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) {
          sendResponse({ status: 'No active tab!' });
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); }
        }, () => {
          setTimeout(() => {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'scanAndDownload',
              dlVideos: settings.dlVideos ?? true,
              dlImages: settings.dlImages ?? true
            }, (response) => {
              if (chrome.runtime.lastError) {
                sendResponse({ status: 'Page reload karein!' });
              } else if (response && response.mediaList) {
                const count = processAndDownloadMedia(response.mediaList, settings.saveFolder);
                sendResponse({ status: count > 0 ? `${count} clips added to queue!` : 'No ready media found' });
              } else {
                sendResponse({ status: 'No media found' });
              }
            });
          }, 800);
        });
      });
    });
    return true;
  }

  if (request.action === 'startMonitoring') {
    chrome.storage.local.set({ isMonitoring: true });
    
    // Auto-Reset on Start
    clipSequenceCounter = 1;
    totalDownloadedCount = 0;
    downloadedUrls.clear();
    downloadQueue = [];
    pendingGeneratingClips.clear();
    chrome.storage.local.set({
      downloadedUrls: [],
      clipSequenceCounter: 1,
      totalDownloadedCount: 0
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'startContentMonitoring' });
      }
    });

    sendResponse({ status: 'Auto Monitoring Active...' });
    return true;
  }

  if (request.action === 'stopMonitoring') {
    chrome.storage.local.set({ isMonitoring: false });
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'stopContentMonitoring' });
      }
    });

    sendResponse({ status: 'Monitoring Stopped' });
    return true;
  }

  if (request.action === 'resetProjectCounter') {
    clipSequenceCounter = 1;
    totalDownloadedCount = 0;
    downloadQueue = [];
    pendingGeneratingClips.clear();
    chrome.storage.local.set({ clipSequenceCounter: 1, totalDownloadedCount: 0 });
    sendResponse({ status: 'Counter Reset to 001' });
    return true;
  }

  if (request.action === 'resetHistory') {
    downloadedUrls.clear();
    clipSequenceCounter = 1;
    totalDownloadedCount = 0;
    downloadQueue = [];
    pendingGeneratingClips.clear();
    chrome.storage.local.set({
      downloadedUrls: [],
      clipSequenceCounter: 1,
      totalDownloadedCount: 0
    });
    sendResponse({ status: 'History & sequence reset!' });
    return true;
  }
});
