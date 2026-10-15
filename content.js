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

    // Videos scan
    if (request.dlVideos) {
      const videos = document.querySelectorAll('video');
      videos.forEach((vid) => {
        if (vid.src && vid.src.startsWith('http')) {
          const parentCard = vid.closest('[class*="card"], [class*="item"], div') || vid.parentElement;
          const rawText = parentCard ? parentCard.innerText : '';
          
          // Check if card is currently generating/loading
          const isGenerating = parentCard ? (
            parentCard.innerText.toLowerCase().includes('generating') || 
            parentCard.querySelector('[class*="spinner"], [class*="loading"], [class*="progress"]') !== null
          ) : false;

          rawList.push({
            url: vid.src,
            isVideo: true,
            promptText: cleanPromptText(rawText),
            isGenerating: isGenerating
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

          const isGenerating = parentCard ? (
            parentCard.innerText.toLowerCase().includes('generating') || 
            parentCard.querySelector('[class*="spinner"], [class*="loading"]') !== null
          ) : false;

          rawList.push({
            url: img.src,
            isVideo: false,
            promptText: cleanPromptText(rawText),
            isGenerating: isGenerating
          });
        }
      });
    }

    // Chronological order (Bottom to Top)
    const orderedList = Array.from(rawList).reverse();

    sendResponse({ mediaList: orderedList });
  }
  return true;
});
