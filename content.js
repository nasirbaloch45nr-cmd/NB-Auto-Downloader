// File Name: content.js

function cleanPromptText(element, parentCard) {
  let rawText = '';

  // 1. Specific prompt input / display element search karein
  if (parentCard) {
    const promptElem = parentCard.querySelector('[class*="prompt"], [class*="title"], [class*="caption"], p, span');
    if (promptElem && promptElem.innerText && promptElem.innerText.trim().length > 0) {
      rawText = promptElem.innerText;
    } else {
      rawText = parentCard.innerText || '';
    }
  }

  if (!rawText && element) {
    rawText = element.getAttribute('aria-label') || element.alt || '';
  }

  let clean = rawText.trim();

  // Garbage patterns aur Google UI words remove karein
  const garbageWords = [
    /Tile_displaying_a_users_image/gi,
    /Tile displaying a user's image/gi,
    /play_circle/gi, /360p/gi, /720p/gi, /1080p/gi,
    /favoriteredo/gi, /redomor/gi, /more_vert/gi, /download/gi,
    /favorite/gi, /redo/gi, /share/gi, /fullscreen/gi
  ];

  garbageWords.forEach(pattern => {
    clean = clean.replace(pattern, '');
  });

  clean = clean
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return clean.slice(0, 40) || 'Prompt';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAndDownload') {
    const rawList = [];

    // Helper function for screen Y/X position
    function getPos(elem) {
      const rect = elem.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX
      };
    }

    // Videos scan
    if (request.dlVideos) {
      const videos = document.querySelectorAll('video');
      videos.forEach((vid, index) => {
        if (vid.src && vid.src.startsWith('http')) {
          const parentCard = vid.closest('[class*="card"], [class*="item"], [class*="tile"], div') || vid.parentElement;
          const pos = getPos(vid);

          const isGenerating = parentCard ? (
            parentCard.innerText.toLowerCase().includes('generating') || 
            parentCard.querySelector('[class*="spinner"], [class*="loading"], [class*="progress"]') !== null
          ) : false;

          rawList.push({
            url: vid.src,
            isVideo: true,
            promptText: cleanPromptText(vid, parentCard),
            isGenerating: isGenerating,
            top: pos.top,
            left: pos.left,
            domIndex: index
          });
        }
      });
    }

    // Images scan
    if (request.dlImages) {
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (img.src && img.src.startsWith('http') && !img.src.includes('avatar') && !img.src.includes('icon')) {
          const parentCard = img.closest('[class*="card"], [class*="item"], [class*="tile"], div') || img.parentElement;
          const pos = getPos(img);

          const isGenerating = parentCard ? (
            parentCard.innerText.toLowerCase().includes('generating') || 
            parentCard.querySelector('[class*="spinner"], [class*="loading"]') !== null
          ) : false;

          rawList.push({
            url: img.src,
            isVideo: false,
            promptText: cleanPromptText(img, parentCard),
            isGenerating: isGenerating,
            top: pos.top,
            left: pos.left,
            domIndex: index
          });
        }
      });
    }

    // Chronological Bottom-to-Top Grid Sorting (Natural Flow Order)
    rawList.sort((a, b) => {
      if (Math.abs(b.top - a.top) > 40) {
        return b.top - a.top; // Bottom-most row first
      }
      return a.left - b.left; // Left to Right inside row
    });

    sendResponse({ mediaList: rawList });
  }
  return true;
});
