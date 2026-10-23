// File Name: content.js  (tuned for the Google Flow DOM)

if (!window.__nbAutoDownloaderLoaded) {
  window.__nbAutoDownloaderLoaded = true;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Width/height se ratio ka naam nikalta hai (4% tak farq maaf)
  function ratioLabel(w, h) {
    if (!w || !h) return 'unknown';
    const r = w / h;
    const known = [['16:9', 16 / 9], ['9:16', 9 / 16], ['1:1', 1], ['4:3', 4 / 3], ['3:4', 3 / 4]];
    for (const [label, value] of known) {
      if (Math.abs(r - value) / value < 0.04) return label;
    }
    return 'other';
  }

  function sanitize(text) {
    return (text || '')
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'Prompt';
  }

  // Purana fallback (sirf tab chalta hai jab tile mein .footer-title na mile)
  function cleanPromptText(element, parentCard) {
    let rawText = '';
    if (parentCard) {
      const promptElem = parentCard.querySelector('[class*="prompt"], [class*="title"], [class*="caption"], p, span');
      rawText = (promptElem && promptElem.innerText && promptElem.innerText.trim())
        ? promptElem.innerText
        : (parentCard.innerText || '');
    }
    if (!rawText && element) {
      rawText = element.getAttribute('aria-label') || element.alt || '';
    }
    const garbageWords = [
      /Tile_displaying_a_users_image/gi, /Tile displaying a user's image/gi,
      /play_circle/gi, /360p/gi, /720p/gi, /1080p/gi,
      /favoriteredo/gi, /redomor/gi, /more_vert/gi, /download/gi,
      /favorite/gi, /redo/gi, /share/gi, /fullscreen/gi
    ];
    let clean = rawText.trim();
    garbageWords.forEach(p => { clean = clean.replace(p, ''); });
    return sanitize(clean);
  }

  function getTitle(el, tile) {
    const t = tile && tile.querySelector('.footer-title');
    if (t && t.textContent && t.textContent.trim()) return sanitize(t.textContent);
    return cleanPromptText(el, tile);
  }

  // Sirf project ke andar kaam: /project/<id> (edit, tools, trash page nahi). Home/Gallery par nahi.
  function isProjectPage() {
    const m = location.pathname.match(/^\/project\/[^/]+(\/.*)?$/);
    if (!m) return false;
    return !/^\/(edit|tools|trash)(\/|$)/.test(m[1] || '');
  }

  function getVideoUrl(vid) {
    const source = vid.querySelector('source');
    const candidates = [vid.currentSrc, vid.src, source ? source.src : ''];
    return candidates.find(u => u && u.startsWith('http')) || '';
  }

  function isTileGenerating(tile, el, isVideo) {
    if (!tile) return false;
    if (tile.querySelector('flow-pending-tile:not(.fading-out)')) return true;
    if (!isVideo && (el.complete === false || el.naturalWidth === 0)) return true;
    if (isVideo && (tile.innerText || '').toLowerCase().includes('generating')) return true;
    return false;
  }

  // Flow ki grid "virtual scroll" hai: scroll window nahi, ye container karta hai
  function getScroller() {
    return document.querySelector('[cdkvirtualscrollingelement]') ||
           document.scrollingElement || document.documentElement;
  }

  function collectVisible(found, req) {
    const sc = getScroller();
    const isDoc = sc === document.scrollingElement || sc === document.documentElement;
    const scTop = isDoc ? 0 : sc.getBoundingClientRect().top;
    const base = sc.scrollTop || 0;

    const push = (el, url, isVideo) => {
      const tile = el.closest('flow-grid-tile-container') || el.closest('[class*="tile"]') || el.parentElement;
      const idHolder = el.closest('[data-media-id]');
      const mediaId = idHolder ? idHolder.getAttribute('data-media-id') : '';
      const key = mediaId || url.split('?')[0];
      const isGenerating = isTileGenerating(tile, el, isVideo);
      const pendingOverlay = !!(tile && tile.querySelector && tile.querySelector('flow-pending-tile'));

      const old = found.get(key);
      if (old && !old.isGenerating) return;

      const r = el.getBoundingClientRect();
      const w = isVideo ? el.videoWidth : el.naturalWidth;
      const h = isVideo ? el.videoHeight : el.naturalHeight;
      found.set(key, {
        key: key,
        url: url,
        isVideo: isVideo,
        promptText: getTitle(el, tile),
        isGenerating: isGenerating,
        pendingOverlay: pendingOverlay,
        ratio: ratioLabel(w || r.width, h || r.height),
        top: base + (r.top - scTop),
        left: r.left
      });
    };

    if (req.dlVideos) {
      document.querySelectorAll('video').forEach((vid) => {
        const url = getVideoUrl(vid);
        if (url) push(vid, url, true);
      });
    }

    if (req.dlImages) {
      // Sirf Flow ki apni images (profile picture waghera nahi)
      document.querySelectorAll('img[data-media-id], img[src^="https://flow.google.com/asb/"]').forEach((img) => {
        if (!img.src || !img.src.startsWith('http')) return;
        const tile = img.closest('flow-grid-tile-container');
        // Video tile ka poster/thumbnail image ke tor par download na ho
        if (tile && (tile.querySelector('video') || tile.querySelector('flow-video-tile'))) return;
        push(img, img.src, false);
      });
    }
  }

  async function scan(req) {
    const found = new Map();

    if (!req.deepScan) {
      collectVisible(found, req);
    } else {
      const sc = getScroller();
      const startTop = sc.scrollTop;
      sc.scrollTop = 0;
      await sleep(500);

      for (let i = 0; i < 400; i++) {
        collectVisible(found, req);

        const atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
        if (atBottom) {
          await sleep(800); // shayad aur tiles load ho rahe hon
          if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) break;
          continue;
        }

        const before = sc.scrollTop;
        sc.scrollTop = before + Math.max(300, Math.floor(sc.clientHeight * 0.7));
        await sleep(450);
        if (sc.scrollTop === before) break;
      }

      collectVisible(found, req);
      sc.scrollTop = startTop;
    }

    const list = Array.from(found.values());
    // Bottom-to-Top, Right-to-Left (purana clip pehle -> sequence 001)
    list.sort((a, b) => {
      if (Math.abs(b.top - a.top) > 40) return b.top - a.top;
      return b.left - a.left;
    });
    return list;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'liveScanNow') {
      scheduleLiveScan(0);
      sendResponse({ ok: true });
      return false;
    }
    if (request.action !== 'scanAndDownload') return false;
    if (!isProjectPage()) {
      sendResponse({ mediaList: [], notProject: true });
      return false;
    }
    scan(request)
      .then((mediaList) => sendResponse({ mediaList: mediaList }))
      .catch((err) => {
        console.warn('[NB] scan failed:', err);
        sendResponse({ mediaList: [] });
      });
    return true; // async response
  });

  // =====================================================
  //  LIVE MONITORING: naya clip/image tayyar hote hi foran signal
  // =====================================================
  let liveOn = false;
  let liveTimer = null;
  let livePoll = null;
  let liveObserver = null;
  const sentKeys = new Set();

  const HOLD_MAX_MS = 60 * 1000;   // order ke liye zyada se zyada 1 minute intezar, phir aage barh jao
  const heldSince = new Map();
  const seenKeys = new Set();     // prompt counter: jo media-keys dekh chuke
  let prevPending = 0;            // pichli scan mein media ke baghair pending tiles
  let lastPub = { gen: -1, hold: -1 };

  // Panel ke portal ke liye: kitne tiles generate ho rahe hain + hold ka countdown
  function publishLiveInfo(gen, hold) {
    if (lastPub.gen === gen && lastPub.hold === hold) return;
    lastPub = { gen: gen, hold: hold };
    try { chrome.storage.local.set({ generatingCount: gen, holdUntil: hold }); } catch (e) {}
  }

  // Wo tiles jo abhi generate ho rahe hain (pending overlay wale)
  function collectPendingTiles() {
    const sc = getScroller();
    const isDoc = sc === document.scrollingElement || sc === document.documentElement;
    const scTop = isDoc ? 0 : sc.getBoundingClientRect().top;
    const base = sc.scrollTop || 0;
    const list = [];
    document.querySelectorAll('flow-grid-tile-container').forEach((tile) => {
      if (!tile.querySelector('flow-pending-tile:not(.fading-out)')) return;
      const r = tile.getBoundingClientRect();
      const hasMedia = !!tile.querySelector('img[data-media-id], video[src], img[src^="https://flow.google.com/asb/"]');
      list.push({ top: base + (r.top - scTop), left: r.left, el: tile, hasMedia: hasMedia });
    });
    return list;
  }

  // Grid order: neeche wala pehle (purana), ek row mein right-to-left.
  // Negative matlab: a, b se purana hai.
  function olderFirst(a, b) {
    if (Math.abs(b.top - a.top) > 40) return b.top - a.top;
    return b.left - a.left;
  }

  async function liveScan() {
    if (!liveOn) return;
    if (!isProjectPage()) { publishLiveInfo(0, 0); return; }   // project ke bahar kuch nahi

    let settings = {};
    try {
      settings = await new Promise((res) => chrome.storage.local.get(['dlVideos', 'dlImages', 'keepOrder'], res));
    } catch (e) { return; }

    const pendingTiles = collectPendingTiles();
    const found = new Map();
    collectVisible(found, { dlVideos: settings.dlVideos ?? true, dlImages: settings.dlImages ?? true });

    // Prompt counter: tiles ki "pehchan" par nahi (Flow unhein dobara banati hai), sirf ginti par.
    // naye prompts = (abhi media ke baghair pending tiles - pichli baar) + (pending se tayyar hote tiles)
    const noMedia = pendingTiles.filter((p) => !p.hasMedia).length;
    let transitions = 0;
    found.forEach((item, key) => {
      if (seenKeys.has(key)) return;
      seenKeys.add(key);
      if (item.pendingOverlay) transitions++;   // purane tile jo scroll se aaye unmein overlay nahi hota
    });
    const newPrompts = Math.max(0, noMedia - prevPending + transitions);
    prevPending = noMedia;
    if (newPrompts > 0) {
      try { chrome.runtime.sendMessage({ action: 'promptsStarted', count: newPrompts }); } catch (e) {}
    }

    // Keep Order: koi purana tile abhi generate ho raha ho to naya tayyar tile ruka rahe (max 1 minute)
    const keepOrder = settings.keepOrder !== false;
    const pending = keepOrder ? pendingTiles : [];
    const now = Date.now();

    const fresh = [];
    found.forEach((item, key) => {
      if (item.isGenerating) return;   // abhi tayyar nahi: agla event dobara check karega
      if (sentKeys.has(key)) return;

      if (keepOrder && pending.some((p) => olderFirst(p, item) < 0)) {
        if (!heldSince.has(key)) heldSince.set(key, now);
        if (now - heldSince.get(key) < HOLD_MAX_MS) return;   // purane ka intezar
      }

      heldSince.delete(key);
      sentKeys.add(key);
      fresh.push(item);
    });

    // Jo ruke hue the magar ab nazar nahi aa rahe / chhod diye gaye, unhein hata do
    heldSince.forEach((t, key) => { if (!found.has(key) || sentKeys.has(key)) heldSince.delete(key); });
    let earliest = Infinity;
    heldSince.forEach((t) => { if (t < earliest) earliest = t; });
    publishLiveInfo(pendingTiles.length, earliest === Infinity ? 0 : earliest + HOLD_MAX_MS);

    if (fresh.length === 0) return;
    fresh.sort(olderFirst);   // purani pehle

    try {
      chrome.runtime.sendMessage({ action: 'liveMedia', mediaList: fresh });
    } catch (e) { /* extension reload hui hai: Flow page refresh (F5) karein */ }
  }

  // Throttle: ek waqt mein sirf ek scan pending, mutations ki bharmaar mein bhi chalta rahe
  function scheduleLiveScan(delay) {
    if (!liveOn || liveTimer) return;
    liveTimer = setTimeout(() => { liveTimer = null; liveScan(); }, delay);
  }

  function onMediaEvent() { scheduleLiveScan(300); }

  function startLive() {
    if (liveOn) return;
    liveOn = true;
    sentKeys.clear();
    heldSince.clear();
    seenKeys.clear();
    prevPending = 0;
    lastPub = { gen: -1, hold: -1 };

    liveObserver = new MutationObserver(() => scheduleLiveScan(600));
    liveObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'class']
    });

    // img/video ka load hona DOM mutation nahi hota, isliye capture-phase par sunte hain
    document.addEventListener('load', onMediaEvent, true);
    document.addEventListener('loadeddata', onMediaEvent, true);

    // Safety net: har 5 second mein bhi ek scan
    livePoll = setInterval(() => scheduleLiveScan(0), 5000);
    scheduleLiveScan(0);
  }

  function stopLive() {
    liveOn = false;
    if (liveObserver) { liveObserver.disconnect(); liveObserver = null; }
    document.removeEventListener('load', onMediaEvent, true);
    document.removeEventListener('loadeddata', onMediaEvent, true);
    clearInterval(livePoll);
    clearTimeout(liveTimer);
    liveTimer = null;
    heldSince.clear();
  }

  try {
    chrome.storage.local.get(['isMonitoring'], (res) => {
      if (res && res.isMonitoring) startLive();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.isMonitoring) {
        if (changes.isMonitoring.newValue) startLive(); else stopLive();
      }
      // History reset hui to dobara bhejne ki ijazat
      if (changes.downloadedUrls) {
        const nv = changes.downloadedUrls.newValue;
        if (!nv || nv.length === 0) sentKeys.clear();
      }
    });
  } catch (e) {}
}
