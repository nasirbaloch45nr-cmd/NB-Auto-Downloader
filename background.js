function extractMediaUrls() {
  const foundItems = [];
  const addedUrls = new Set();
  let imgCounter = 1;
  let vidCounter = 1;

  function getElementTitle(el, type) {
    let text = el.getAttribute('alt') || 
               el.getAttribute('title') || 
               el.getAttribute('aria-label') || 
               el.dataset.prompt || '';

    // Agar text generic ho ya khali ho, toh clean professional numbering/fallback use karein
    if (!text || text.includes("Tile displaying") || text.length < 3) {
      return type === 'video' ? `Flow_Video_${vidCounter++}` : `Flow_Image_${imgCounter++}`;
    }
    
    // Agar lamba prompt ho toh usko saaf short title bana lein
    return text.substring(0, 40).trim();
  }

  // 1. Detect Videos
  document.querySelectorAll('video').forEach(video => {
    let src = video.src || video.currentSrc;
    let title = getElementTitle(video, 'video');
    
    if (src && !addedUrls.has(src)) {
      addedUrls.add(src);
      foundItems.push({ url: src, type: 'video', title: title });
    }
    video.querySelectorAll('source').forEach(source => {
      if (source.src && !addedUrls.has(source.src)) {
        addedUrls.add(source.src);
        foundItems.push({ url: source.src, type: 'video', title: title });
      }
    });
  });

  // 2. Detect Images
  document.querySelectorAll('img').forEach(img => {
    let src = img.src || (img.dataset && img.dataset.src);
    let title = getElementTitle(img, 'image');
    if (src && !addedUrls.has(src)) {
      addedUrls.add(src);
      foundItems.push({ url: src, type: 'image', title: title });
    }
  });

  return foundItems.filter(item => 
    item.url.startsWith('http') || item.url.startsWith('blob:') || item.url.startsWith('data:')
  );
}
