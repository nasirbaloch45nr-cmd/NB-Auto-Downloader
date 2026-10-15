// File Name: content.js

function cleanPromptText(text) {
  if (!text) return 'Prompt';

  let clean = text.trim();

  const garbageWords = [
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

  return clean.slice(0, 40) || 'Clip';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAndDownload') {
    const rawList = [];

    // Helper function to get exact element screen position
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
      videos.forEach((vid) => {
        if (vid.src && vid.src.startsWith('http')) {
          const parentCard = vid.closest('[class*="card"], [class*="item"], div') || vid.parentElement;
          const rawText = parentCard ? parentCard.innerText : '';
          const pos = getPos(vid);

          const isGenerating = parentCard ? (
            parentCard.innerText.toLowerCase().includes('generating') || 
            parentCard.querySelector('[class*="spinner"], [class*="loading"], [class*="progress"]') !== null
          ) : false;

          rawList.push({
            url: vid.src,
            isVideo: true,
            promptText: cleanPromptText(rawText),
            isGenerating: isGenerating,
            top: pos.top,
            left: pos.left
          });
        }
      });
    }

    // Images scan
    if (request.dlImages) {
      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        if (img.src && img.src.startsWith('http') && !img.src.includes('avatar') && !img.src.includes('icon')) {
          const parentCard = img.closest('[class*="card"], [class*="item"], div') || img.parentElement;
          const rawText = img.alt || (parentCard ? parentCard.innerText : '');
          const pos = getPos(img);

          const isGenerating = parentCard ? (
            parentCard.innerText.toLowerCase().includes('generating') || 
            parentCard.querySelector('[class*="spinner"], [class*="loading"]') !== null
          ) : false;

          rawList.push({
            url: img.src,
            isVideo: false,
            promptText: cleanPromptText(rawText),
            isGenerating: isGenerating,
            top: pos.top,
            left: pos.left
          });
        }
      });
    }

    // PERFECT GRID SORTING (Bottom-to-Top Y, Left-to-Right X)
    // Sabse pehle neeche wali row (Top maximum) aur us row me left-to-right (Left minimum)
    rawList.sort((a, b) => {
      // Direct Y-axis comparison with 50px row-tolerance gap
      if (Math.abs(b.top - a.top) > 50) {
        return b.top - a.top; // Higher Y (bottom-most) comes first
      }
      return a.left - b.left; // Inside same row, Left to Right
    });

    sendResponse({ mediaList: rawList });
  }
  return true;
});
