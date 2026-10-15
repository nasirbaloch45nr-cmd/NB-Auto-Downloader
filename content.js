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
  if (request.action === 'scanAndDescription' || request.action === 'scanAndDownload') {
    const rawList = [];

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

    // EXACT VISUAL SCREEN ORDER SORTING (Top-to-Bottom, Left-to-Right)
    // Yaani screen par jo sabse upar hai (jaise Z/Top row), wahan se shuru karega 
    // aur neeche ki taraf (A tak) bilkul tarteeb se chalega.
    rawList.sort((a, b) => {
      // Agar vertical gap 40px se zyada hai, toh jo upar hai (chhota top) woh pehle aayega
      if (Math.abs(a.top - b.top) > 40) {
        return a.top - b.top; 
      }
      // Agar same row mein hain, toh Left to Right (A se Z ki taraf)
      return a.left - b.left;
    });

    sendResponse({ mediaList: rawList });
  }
  return true;
});
