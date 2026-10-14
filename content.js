console.log("NB Auto Downloader: Robust Content script active!");

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

// Incomplete / Generating filter check
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

  // 1. Direct IMG & VIDEO Elements
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

  // 2. CSS Background Image Elements (Google Flow Thumbnail Grid fallback)
  if (dlImages) {
    const allDivs = document.querySelectorAll('div, a, span');
    allDivs.forEach((elem) => {
      if (isElementGenerating(elem)) return;

      const style = window.getComputedStyle(elem);
      const bgImage = style.backgroundImage;

      if (bgImage && bgImage !== 'none' && bgImage.includes('url(')) {
        let urlMatch = bgImage.match(/url\(["']?(.*?)["']?\)/);
        if (urlMatch && urlMatch[1]) {
          let src = urlMatch[1];
          if (src.startsWith('http') && !foundUrls.has(src)) {
            foundUrls.add(src);

            let promptText = elem.getAttribute('aria-label') || elem.textContent || 'FlowClip';
            promptText = sanitizeFilename(promptText);

            mediaList.push({
              url: src,
              isVideo: false,
              promptText: promptText
            });
          }
        }
      }
    });
  }

  console.log(`NB Auto Downloader: Found ${mediaList.length} total complete media items.`);
  return mediaList;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAndDownload') {
    const media = scanGoogleFlowMedia(request.dlVideos ?? true, request.dlImages ?? true);
    sendResponse({ mediaList: media, count: media.length });
  }
  return true;
});
