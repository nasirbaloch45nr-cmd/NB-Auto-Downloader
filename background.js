let downloadedUrls = new Set();
let clipSequenceCounter = 1;

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
    if (downloadedUrls.has(item.url)) return;

    downloadedUrls.add(item.url);
    downloadedCount++;

    const seqStr = String(clipSequenceCounter).padStart(3, '0');
    const dateTimeStr = getFormattedDateTime();
    const ext = item.isVideo ? 'mp4' : 'webp';
    const folder = saveFolder ? `${saveFolder}/` : 'GoogleFlow_Media/';

    const filename = `${folder}Clip_${seqStr}_${item.promptText}_${dateTimeStr}.${ext}`;
    clipSequenceCounter++;

    chrome.downloads.download({
      url: item.url,
      filename: filename,
      conflictAction: 'uniquify'
    });
  });

  chrome.storage.local.set({
    downloadedUrls: Array.from(downloadedUrls),
    clipSequenceCounter: clipSequenceCounter
  });

  return downloadedCount;
}

let monitoringIntervalId = null;

function startAutoMonitoring() {
  if (monitoringIntervalId) clearInterval(monitoringIntervalId);

  monitoringIntervalId = setInterval(() => {
    chrome.storage.local.get(['isMonitoring', 'saveFolder', 'dlVideos', 'dlImages'], (settings) => {
      if (!settings.isMonitoring) {
        clearInterval(monitoringIntervalId);
        monitoringIntervalId = null;
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) return;
        const tabId = tabs[0].id;

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
    });
  }, 3000);
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadCurrentPage') {
    chrome.storage.local.get(['saveFolder', 'dlVideos', 'dlImages'], (settings) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) {
          sendResponse({ status: 'No active tab!' });
          return;
        }
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'scanAndDownload',
          dlVideos: settings.dlVideos ?? true,
          dlImages: settings.dlImages ?? true
        }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ status: 'Page reload karein!' });
          } else if (response && response.mediaList) {
            const count = processAndDownloadMedia(response.mediaList, settings.saveFolder);
            sendResponse({ status: count > 0 ? `${count} clips downloaded!` : 'No new media found' });
          } else {
            sendResponse({ status: 'No media found' });
          }
        });
      });
    });
    return true;
  }

  if (request.action === 'startMonitoring') {
    chrome.storage.local.set({ isMonitoring: true });
    startAutoMonitoring();
    sendResponse({ status: 'Monitoring Active...' });
    return true;
  }

  if (request.action === 'stopMonitoring') {
    chrome.storage.local.set({ isMonitoring: false });
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
// File Name: background.js

// Default settings aur counter state management
const DEFAULT_SETTINGS = {
    counterIndex: 1,
    videoQuality: "720p",
    imageQuality: "1k",
    aspectRatio: "16:9", // Default YouTube ratio
    projectName: "default-project"
};

// Function: Naya project shuru hone par ya manually reset karne par counter 1 karne ke liye
async function resetCounterIfNeeded(newProjectName) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['currentProject', 'counterIndex'], (data) => {
            if (data.currentProject !== newProjectName) {
                // Agar project badal gaya hai, toh counter ko 1 par reset kar do
                chrome.storage.local.set({
                    currentProject: newProjectName,
                    counterIndex: 1
                }, () => {
                    resolve(1);
                });
            } else {
                // Agar wahi project hai, toh agla number do
                let nextIndex = (data.counterIndex || 0) + 1;
                chrome.storage.local.set({ counterIndex: nextIndex }, () => {
                    resolve(nextIndex);
                });
            }
        });
    });
}
