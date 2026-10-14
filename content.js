console.log("NB Auto Downloader: Content script active on page!");

function sanitizeFilename(text) {
  if (!text) return 'Clip';
  return text.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 30);
}

function isMediaComplete(element) {
  if (!element) return false;
  
  if (element.closest('[class*="loading"], [class*="generating"], [class*="spinner"]')) {
    return false;
  }
  
  if (element.tagName === 'IMG') {
    return element.complete && element.naturalWidth > 150;
  }
  
  if (element.tagName === 'VIDEO') {
    return element.readyState >= 2 && !element.src.startsWith('blob:placeholder');
  }
  
  return true;
}

function scanGoogleFlowMedia(dlVideos = true, dlImages = true) {
  const mediaList = [];
  const items = document.querySelectorAll('img, video');
  
  items.forEach((elem) => {
    if (!isMediaComplete(elem)) return;

    let src = elem.src || elem.querySelector('source')?.src;
    if (!src || (!src.startsWith('http') && !src.startsWith('blob:'))) return;

    const isVideo = elem.tagName === 'VIDEO' || src.includes('.mp4');
    const isImage = elem.tagName === 'IMG' && !isVideo;

    if (isVideo && !dlVideos) return;
    if (isImage && !dlImages) return;

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAndDownload') {
    const media = scanGoogleFlowMedia(request.dlVideos, request.dlImages);
    sendResponse({ mediaList: media, count: media.length });
  }
  return true;
});
