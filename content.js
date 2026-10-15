// File Name: content.js

function cleanPromptText(text) {
  if (!text) return 'Prompt';

  // Step 1: Extra whitespace saaf karein
  let clean = text.trim();

  // Step 2: Google Flow ke common UI icons/button words ko remove karein
  const garbageWords = [
    /play_circle/gi, /360p/gi, /720p/gi, /1080p/gi,
    /favoriteredo/gi, /redomor/gi, /more_vert/gi, /download/gi,
    /favorite/gi, /redo/gi, /share/gi, /fullscreen/gi
  ];

  garbageWords.forEach(pattern => {
    clean = clean.replace(pattern, '');
  });

  // Step 3: Special characters mita kar spaces ko underscores banayein
  clean = clean
    .replace(/[^a-zA-Z0-9\s_-]/g, '') // sirf safe characters rakhein
    .replace(/\s+/g, '_')             // spaces -> _
    .replace(/_+/g, '_')              // double __ -> _
    .replace(/^_+|_+$/g, '');         // shuru/aakhir ke _ mitaayein

  // Pehle 40 characters lein taake filename zyada lamba na ho
  return clean.slice(0, 40) || 'Clip';
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAndDownload') {
    const mediaList = [];
    
    // Videos scan karein
    if (request.dlVideos) {
      const videos = document.querySelectorAll('video');
      videos.forEach((vid) => {
        if (vid.src && vid.src.startsWith('http')) {
          // Nearest container se prompt text dhoondna
          const parentCard = vid.closest('[class*="card"], [class*="item"], div') || vid.parentElement;
          const rawText = parentCard ? parentCard.innerText : '';
          
          mediaList.push({
            url: vid.src,
            isVideo: true,
            promptText: cleanPromptText(rawText)
          });
        }
      });
    }

    // Images scan karein
    if (request.dlImages) {
      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        if (img.src && img.src.startsWith('http') && !img.src.includes('avatar') && !img.src.includes('icon')) {
          const parentCard = img.closest('[class*="card"], [class*="item"], div') || img.parentElement;
          const rawText = parentCard ? parentCard.innerText : '';

          mediaList.push({
            url: img.src,
            isVideo: false,
            promptText: cleanPromptText(rawText)
          });
        }
      });
    }

    sendResponse({ mediaList: mediaList });
  }
  return true;
});
