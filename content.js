// Google Flow Media Extractor & Real-Time Observer

function sanitizeFilename(text) {
  if (!text) return 'Clip';
  return text.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 30);
}

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

// Check if media is fully rendered (filters out loading / generating placeholders)
function isMediaComplete(element) {
  if (!element) return false;
  
  // Skip loading indicators, blurred low-res previews, or generating spinners
  if (element.closest('[class*="loading"], [class*="generating"], [class*="spinner"]')) {
    return false;
  }
  
  if (element.tagName === 'IMG') {
    return element.complete && element.naturalWidth > 200; // Ensures high-res full image
  }
  
  if (element.tagName === 'VIDEO') {
    return element.readyState >= 2 && !element.src.startsWith('blob:placeholder');
  }
  
  return true;
}

function scanGoogleFlowMedia(dlVideos = true, dlImages = true) {
  const mediaList = [];
  
  // Target Google Flow grid containers
  const items = document.querySelectorAll('img, video');
  
  items.forEach((elem) => {
    if (!isMediaComplete(elem)) return;

    let src = elem.src || elem.querySelector('source')?.src;
    if (!src || (!src.startsWith('http') && !src.startsWith('blob:'))) return;

    const isVideo = elem.tagName === 'VIDEO' || src.includes('.mp4');
    const isImage = elem.tagName === 'IMG' && !isVideo;

    if (isVideo && !dlVideos) return;
    if (isImage && !dlImages) return;

    // Extract title or prompt text nearby in Google Flow UI
    let promptText = elem.getAttribute('alt') || 
                     elem.getAttribute('aria-label') || 
                     elem.closest('[class*="card"], [class*="item"]')?.textContent || 
                     'FlowClip';

    promptText = sanitizeFilename(promptText);

    mediaList.push({
      url: src,
      isVideo: isVideo,
      promptText: promptText
    });
  });

  return mediaList;
}

// Listen for messages from popup & background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAndDownload') {
    const media = scanGoogleFlowMedia(request.dlVideos, request.dlImages);
    sendResponse({ mediaList: media, count: media.length });
  }
  return true;
});
