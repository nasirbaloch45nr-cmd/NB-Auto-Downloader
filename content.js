// Prevent multiple injections in frames
if (window.nbDownloaderInjected) {
  // Already injected
} else {
  window.nbDownloaderInjected = true;
  console.log("NB Auto Downloader: Clean Content script active!");

  function sanitizeFilename(text) {
    if (!text) return 'Clip';
    return text.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 30);
  }

  function isElementGenerating(elem) {
    if (!elem) return true;
    const parentCard = elem.closest('[class*="card"], [class*="item"], [class*="grid"], [role="listitem"]');
    if (parentCard) {
      const text = parentCard.textContent.toLowerCase();
      if (text.includes('generating') || text.includes('processing') || text.includes('loading')) {
        return true;
      }
      if (parentCard.querySelector('[class*="spinner"], [class*="progress"], [class*="loader"]')) {
        return true;
      }
    }
    return false;
  }

  function scanGoogleFlowMedia(dlVideos = true, dlImages = true) {
    const mediaList = [];
    const foundUrls = new Set();

    // Scan all media tags on the page
    const mediaElements = document.querySelectorAll('img, video, source');
    mediaElements.forEach((elem) => {
      if (isElementGenerating(elem)) return;

      let src = elem.src || elem.getAttribute('src');
      if (!src || src.startsWith('data:') || src.startsWith('blob:placeholder')) return;

      const isVideo = elem.tagName === 'VIDEO' || elem.tagName === 'SOURCE' || src.includes('.mp4');
      const isImage = (elem.tagName === 'IMG' || src.includes('.webp') || src.includes('.jpg') || src.includes('.png')) && !isVideo;

      if (isVideo && !dlVideos) return;
      if (isImage && !dlImages) return;

      if (!foundUrls.has(src)) {
        foundUrls.add(src);
        
        let parent = elem.closest('[class*="card"], [class*="item"]') || elem.parentElement;
        let promptText = parent ? (parent.getAttribute('aria-label') || parent.textContent) : 'FlowClip';
        promptText = sanitizeFilename(promptText);

        mediaList.push({
          url: src,
          isVideo: isVideo,
          promptText: promptText
        });
      }
    });

    console.log(`NB Auto Downloader: Found ${mediaList.length} complete media items.`);
    return mediaList;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'scanAndDownload') {
      const media = scanGoogleFlowMedia(request.dlVideos ?? true, request.dlImages ?? true);
      sendResponse({ mediaList: media, count: media.length });
    }
    return true;
  });
}
