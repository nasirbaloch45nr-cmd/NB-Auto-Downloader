// File Name: background.js

let downloadedUrls = new Set();   // ab isme media-id (ya URL) ki "keys" hain
let clipSequenceCounter = 1;
let downloadQueue = [];
let isProcessingQueue = false;
let totalDownloadedCount = 0;

let pendingGeneratingClips = new Map();
let failedUrls = new Set();
let currentKey = null; // jo item abhi download ho raha hai

// Panel ke "Remaining Clips" ke liye: queue mein baqi + jo abhi process ho rahi hai
function updatePending() {
  chrome.storage.local.set({ pendingCount: downloadQueue.length + (isProcessingQueue ? 1 : 0) });
}
updatePending(); // service worker restart hone par queue khali hoti hai

try {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.log(error));
} catch (e) {}

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

// Flow ke image links "=s1600-rw" par khatam hote hain: -rw = webp
function getImageExtension(url) {
  const u = url.toLowerCase();
  const m = u.match(/-r([wjp])(?:[?#]|$)/);
  if (m) return m[1] === 'w' ? 'webp' : (m[1] === 'j' ? 'jpg' : 'png');
  if (u.includes('.webp')) return 'webp';
  if (u.includes('.png')) return 'png';
  return 'jpg';
}

function startDownload(url, filename) {
  return new Promise((resolve) => {
    chrome.downloads.download({ url, filename, conflictAction: 'uniquify' }, (id) => {
      if (chrome.runtime.lastError || id === undefined) {
        console.warn('[NB] Download failed:', chrome.runtime.lastError && chrome.runtime.lastError.message, url);
        resolve(null);
      } else {
        resolve(id);
      }
    });
  });
}

async function processQueue(saveFolder) {
  if (isProcessingQueue || downloadQueue.length === 0) return;
  isProcessingQueue = true;

  try {
    while (downloadQueue.length > 0) {
      const item = downloadQueue.shift();
      updatePending();
      currentKey = item.key;

      if (downloadedUrls.has(item.key) || failedUrls.has(item.key)) continue;

      const seqStr = String(clipSequenceCounter).padStart(3, '0');
      const dateTimeStr = getFormattedDateTime();
      const ext = item.isVideo ? 'mp4' : getImageExtension(item.url);
      const safeFolder = (saveFolder || 'GoogleFlow_Media').replace(/[<>:"|?*\\]/g, '_').replace(/^\/+|\/+$/g, '');
      const cleanPrompt = item.promptText || 'Prompt';
      const prefix = item.isVideo ? 'Clip' : 'Image';
      const filename = `${safeFolder}/${prefix}_${seqStr}_${cleanPrompt}_${dateTimeStr}.${ext}`;

      const id = await startDownload(item.url, filename);

      if (id === null) {
        failedUrls.add(item.key);
        continue;
      }

      downloadedUrls.add(item.key);
      clipSequenceCounter++;
      totalDownloadedCount++;

      chrome.storage.local.set({
        downloadedUrls: Array.from(downloadedUrls),
        clipSequenceCounter: clipSequenceCounter,
        totalDownloadedCount: totalDownloadedCount
      });

      await new Promise(resolve => setTimeout(resolve, 1200));
    }
  } finally {
    isProcessingQueue = false;
    currentKey = null;
    updatePending();
  }
}

function processAndDownloadMedia(mediaList, saveFolder, ratioFilter) {
  const stats = { found: 0, videos: 0, images: 0, added: 0, already: 0, waiting: 0, ratioSkipped: 0, failed: 0 };
  if (!mediaList || mediaList.length === 0) return stats;

  const now = Date.now();
  stats.found = mediaList.length;

  mediaList.forEach((item) => {
    if (item.isVideo) stats.videos++; else stats.images++;

    if (downloadedUrls.has(item.key) || item.key === currentKey) { stats.already++; return; }
    if (failedUrls.has(item.key)) { stats.failed++; return; }

    // Aspect ratio filter ("any" = koi filter nahi)
    if (ratioFilter && ratioFilter !== 'any' && item.ratio &&
        item.ratio !== 'unknown' && item.ratio !== ratioFilter) {
      stats.ratioSkipped++;
      return;
    }

    if (item.isGenerating) {
      if (!pendingGeneratingClips.has(item.key)) {
        pendingGeneratingClips.set(item.key, now);
      }
      const elapsedSeconds = (now - pendingGeneratingClips.get(item.key)) / 1000;
      if (elapsedSeconds < 30) {
        stats.waiting++;
        return;
      } else {
        pendingGeneratingClips.delete(item.key);
      }
    } else {
      pendingGeneratingClips.delete(item.key);
    }

    if (!downloadQueue.some(q => q.key === item.key)) {
      downloadQueue.push(item);
      stats.added++;
    }
  });

  if (stats.added > 0) {
    processQueue(saveFolder);
  }
  updatePending();

  return stats;
}

// Panel ke status ke liye scan ki report
function formatScanStatus(s) {
  if (s.found === 0) return 'Koi media nahi mila (page par clips nazar aa rahe hain?)';
  const parts = [`Found ${s.found} (${s.videos} video, ${s.images} image)`, `queued ${s.added}`];
  if (s.already) parts.push(`already done ${s.already}`);
  if (s.waiting) parts.push(`generating/waiting ${s.waiting}`);
  if (s.ratioSkipped) parts.push(`ratio skipped ${s.ratioSkipped}`);
  if (s.failed) parts.push(`failed ${s.failed}`);
  return parts.join(' | ');
}

// Content script na mile to khud inject karke dobara try karta hai
function safeSendTabMessage(tabId, message, callback) {
  chrome.tabs.sendMessage(tabId, message, (response) => {
    if (!chrome.runtime.lastError) {
      if (callback) callback(response);
      return;
    }

    chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[NB] Inject failed:', chrome.runtime.lastError.message);
        if (callback) callback(null);
        return;
      }
      chrome.tabs.sendMessage(tabId, message, (retryResponse) => {
        if (chrome.runtime.lastError) {
          if (callback) callback(null);
          return;
        }
        if (callback) callback(retryResponse);
      });
    });
  });
}

function executeMonitoringScan() {
  chrome.storage.local.get(['isMonitoring', 'saveFolder', 'dlVideos', 'dlImages', 'ratioFilter'], (settings) => {
    if (!settings.isMonitoring) return;

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;

      // Monitoring mein scroll nahi hota (sirf jo nazar aa raha hai)
      safeSendTabMessage(tabs[0].id, {
        action: 'scanAndDownload',
        deepScan: false,
        dlVideos: settings.dlVideos ?? true,
        dlImages: settings.dlImages ?? true
      }, (response) => {
        if (response && response.mediaList) {
          processAndDownloadMedia(response.mediaList, settings.saveFolder, settings.ratioFilter);
        }
      });
    });
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoMonitorAlarm') {
    executeMonitoringScan();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // LIVE signal: content script ne naya tayyar clip/image dekha -> foran queue mein
  if (request.action === 'liveMedia') {
    chrome.storage.local.get(['isMonitoring', 'saveFolder', 'ratioFilter'], (settings) => {
      if (!settings.isMonitoring) return;
      processAndDownloadMedia(request.mediaList, settings.saveFolder, settings.ratioFilter);
    });
    return false;
  }

  if (request.action === 'downloadCurrentPage') {
    chrome.storage.local.get(['saveFolder', 'dlVideos', 'dlImages', 'ratioFilter'], (settings) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) {
          sendResponse({ status: 'No active tab!' });
          return;
        }

        // deepScan: content script khud poori grid scroll karke saare tiles jama karti hai
        safeSendTabMessage(tabs[0].id, {
          action: 'scanAndDownload',
          deepScan: true,
          dlVideos: settings.dlVideos ?? true,
          dlImages: settings.dlImages ?? true
        }, (response) => {
          if (!response || !response.mediaList) {
            sendResponse({ status: 'Page reload karein ya content script load nahi hai!' });
          } else {
            const stats = processAndDownloadMedia(response.mediaList, settings.saveFolder, settings.ratioFilter);
            sendResponse({ status: formatScanStatus(stats) });
          }
        });
      });
    });
    return true;
  }

  if (request.action === 'startMonitoring') {
    chrome.storage.local.set({ isMonitoring: true });

    clipSequenceCounter = 1;
    totalDownloadedCount = 0;
    downloadedUrls.clear();
    failedUrls.clear();
    downloadQueue = [];
    pendingGeneratingClips.clear();
    updatePending();
    chrome.storage.local.set({
      downloadedUrls: [],
      clipSequenceCounter: 1,
      totalDownloadedCount: 0
    });

    chrome.alarms.create('autoMonitorAlarm', { periodInMinutes: 0.5 });

    sendResponse({ status: 'Auto Monitoring Active...' });
    return true;
  }

  if (request.action === 'stopMonitoring') {
    chrome.storage.local.set({ isMonitoring: false });
    chrome.alarms.clear('autoMonitorAlarm');
    sendResponse({ status: 'Monitoring Stopped' });
    return true;
  }

  if (request.action === 'resetProjectCounter') {
    clipSequenceCounter = 1;
    totalDownloadedCount = 0;
    downloadQueue = [];
    pendingGeneratingClips.clear();
    updatePending();
    chrome.storage.local.set({ clipSequenceCounter: 1, totalDownloadedCount: 0 });
    sendResponse({ status: 'Counter Reset to 001' });
    return true;
  }

  if (request.action === 'resetHistory') {
    downloadedUrls.clear();
    failedUrls.clear();
    clipSequenceCounter = 1;
    totalDownloadedCount = 0;
    downloadQueue = [];
    pendingGeneratingClips.clear();
    updatePending();
    chrome.storage.local.set({
      downloadedUrls: [],
      clipSequenceCounter: 1,
      totalDownloadedCount: 0
    });
    sendResponse({ status: 'History & sequence reset!' });
    return true;
  }
});
