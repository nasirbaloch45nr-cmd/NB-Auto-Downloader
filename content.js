chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanAndDownload') {
    let images = Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src.startsWith('http'));
    let videos = Array.from(document.querySelectorAll('video')).map(vid => vid.src || vid.querySelector('source')?.src).filter(src => src && src.startsWith('http'));

    let totalFound = images.length + videos.length;
    
    if (totalFound === 0) {
      sendResponse({ status: 'Koi media nahi mila!' });
    } else {
      sendResponse({ status: `Media Found: ${totalFound} files!` });
    }
  }
  return true;
});
