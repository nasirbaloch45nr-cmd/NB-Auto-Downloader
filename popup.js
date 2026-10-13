document.getElementById('downloadBtn').addEventListener('click', () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Searching media...';

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: downloadPageMedia
    });
  });
});

function downloadPageMedia() {
  const images = Array.from(document.querySelectorAll('img')).map(img => img.src);
  const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
  const mediaUrls = [...new Set([...images, ...links])].filter(url => 
    url.match(/\.(jpeg|jpg|gif|png|mp4|webm|pdf|zip)$/i)
  );

  if (mediaUrls.length === 0) {
    alert('No downloadable media found on this page.');
    return;
  }

  mediaUrls.forEach((url) => {
    chrome.runtime.sendMessage({ action: 'download', url: url });
  });
}
