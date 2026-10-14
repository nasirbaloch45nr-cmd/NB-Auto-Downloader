if (window.nbDownloaderInjected) {
  // Already injected
} else {
  window.nbDownloaderInjected = true;

  function sanitizeFilename(text) {
    if (!text) return 'Clip';
    return text.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 30);
  }

  function scanGoogleFlowMedia(dlVideos = true, dlImages = true) {
    const mediaList = [];
    const foundUrls = new Set();

    const elements = document.querySelectorAll('img, video, source, a');

    elements.forEach((elem) => {
      let src = elem.src || elem.href || elem.getAttribute('src') || elem.getAttribute('href');
      if (!src || src.startsWith('data:') || src.startsWith('blob:placeholder') || src.startsWith('javascript:')) return;

      const isVideo = elem.tagName === 'VIDEO' || elem.tagName === 'SOURCE' || src.includes('.mp4') || src.includes('video');
      const isImage = (elem.tagName === 'IMG' || src.includes('.webp') || src.includes('.jpg') || src.includes('.png')) && !isVideo;

      if (isVideo && !dlVideos) return;
      if (isImage && !dlImages) return;

      if ((isVideo || isImage) && src.startsWith('http') && !foundUrls.has(src)) {
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
