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
  const foundUrls = new Set();

  // 1. Standard Image Tags (<img>)
  document.querySelectorAll('img').forEach(img => {
    if (img.src) foundUrls.add(img.src);
    if (img.dataset.src) foundUrls.add(img.dataset.src);
  });

  // 2. CSS Background Images
  document.querySelectorAll('*').forEach(el => {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') {
      const match = bg.match(/url\(["']?(.*?)["']?\)/);
      if (match && match[1]) foundUrls.add(match[1]);
    }
  });

  // 3. Anchor Tag Links (<a>)
  document.querySelectorAll('a').forEach(a => {
    if (a.href && a.href.match(/\.(jpeg|jpg|gif|png|webp|svg|mp4|webm)$/i)) {
      foundUrls.add(a.href);
    }
  });

  // Convert Set to Array
  const mediaUrls = Array.from(foundUrls).filter(url => 
    url.startsWith('http') || url.startsWith('blob:') || url.startsWith('data:')
  );

  if (mediaUrls.length === 0) {
    alert('No downloadable media found on this page.');
    return;
  }

  // Trigger Download via programmatic link creation
  let downloadedCount = 0;
  mediaUrls.forEach((url, index) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = url;
      a.download = `media_download_${index + 1}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, index * 300); // Small delay to avoid blocking
  });

  alert(`Found and initiated download for ${mediaUrls.length} media item(s)!`);
}
