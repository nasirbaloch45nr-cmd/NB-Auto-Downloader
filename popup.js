document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  // ---------- normal panel ----------
  const saveFolderInput = $('saveFolder');
  const dlVideosInput = $('dlVideos');
  const dlImagesInput = $('dlImages');
  const aspectRatioSelect = $('aspectRatioSelect');
  const keepOrderInput = $('keepOrder');
  const downloadBtn = $('downloadBtn');
  const monitorBtn = $('monitorBtn');
  const resetProjectBtn = $('resetProjectBtn');
  const clearLogBtn = $('clearLogBtn');
  const statusText = $('statusText');
  const counterDownloaded = $('counterDownloaded');
  const remainingClips = $('remainingClips');
  const remainingLabel = $('remainingLabel');
  const remainingBox = $('remainingBox');
  const viewNormalBtn = $('viewNormal');
  const viewAnimatedBtn = $('viewAnimated');
  const reopenBtn = $('portalReopen');

  // ---------- portal ----------
  const portal = $('portal');
  const portalVideo = $('portalVideo');
  const portalBack = $('portalBack');
  const pDownloaded = $('pDownloaded');
  const pSubLabel = $('pSubLabel');
  const pSubValue = $('pSubValue');
  const pStatus = $('pStatus');
  const pNote = $('pNote');

  $('appVersion').textContent = 'v' + chrome.runtime.getManifest().version;

  // portal.mp4 na mile / na chale to saaf paigham
  portalVideo.addEventListener('error', () => pNote.classList.remove('hidden'));
  portalVideo.addEventListener('loadeddata', () => pNote.classList.add('hidden'));

  // ---------- state ----------
  let viewMode = 'animated';            // 'normal' | 'animated'
  let session = null;                   // { mode: 'monitor' | 'current' }
  let portalVisible = false;
  let tickTimer = null;
  let curRate = 0.8;
  let targetRate = 0.8;
  let lastDownloaded = 0;
  let dlStamps = [];                    // recent download times (speed ke liye)
  let lastActivity = Date.now();
  let scanDone = false;
  let scanMessage = '';
  let completing = false;
  let completeAt = 0;

  const IDLE_DONE_MONITOR_MS = 20000;   // monitoring: itni der khamoshi = sab complete
  const IDLE_DONE_CURRENT_MS = 2500;
  const COMPLETE_CLOSE_MS = 6500;       // complete message ke baad portal band hone tak

  // ---------- counters (normal panel) ----------
  function updateUIStats() {
    chrome.storage.local.get(
      ['totalDownloadedCount', 'clipSequenceCounter', 'pendingCount', 'promptCount', 'isMonitoring'],
      (res) => {
        counterDownloaded.textContent = res.totalDownloadedCount || 0;
        if (res.isMonitoring) {
          remainingLabel.textContent = 'Prompts';
          remainingClips.textContent = res.promptCount || 0;
        } else {
          remainingLabel.textContent = 'Remaining Clips';
          remainingClips.textContent = res.pendingCount || 0;
        }
        remainingBox.title = 'Next sequence: ' + String(res.clipSequenceCounter || 1).padStart(3, '0');
      }
    );
  }
  setInterval(updateUIStats, 1000);
  updateUIStats();

  // ---------- settings ----------
  function saveSettings() {
    chrome.storage.local.set({
      saveFolder: saveFolderInput.value.trim() || 'GoogleFlow_Media',
      dlVideos: dlVideosInput.checked,
      dlImages: dlImagesInput.checked,
      ratioFilter: aspectRatioSelect.value,
      keepOrder: keepOrderInput.checked
    });
  }
  [saveFolderInput, dlVideosInput, dlImagesInput, aspectRatioSelect, keepOrderInput]
    .forEach((el) => el.addEventListener('change', saveSettings));

  function setMonitorButton(on) {
    monitorBtn.textContent = on ? 'Stop Auto Monitoring' : 'Start Auto Monitoring';
    monitorBtn.className = on ? 'btn btn-danger' : 'btn btn-success';
  }

  // ---------- view switch (Normal | Animated) ----------
  function setViewMode(mode) {
    viewMode = mode;
    viewNormalBtn.classList.toggle('active', mode === 'normal');
    viewAnimatedBtn.classList.toggle('active', mode === 'animated');
    chrome.storage.local.set({ viewMode: mode });
    if (mode === 'normal' && portalVisible) hidePortal(true);
    refreshReopenButton();
  }
  viewNormalBtn.addEventListener('click', () => setViewMode('normal'));
  viewAnimatedBtn.addEventListener('click', () => setViewMode('animated'));

  // ---------- portal open / close ----------
  function refreshReopenButton() {
    chrome.storage.local.get(['isMonitoring'], (r) => {
      const can = viewMode === 'animated' && !portalVisible && (session || r.isMonitoring);
      reopenBtn.classList.toggle('hidden', !can);
    });
  }

  function showPortal() {
    portalVisible = true;
    portal.classList.remove('hidden');
    requestAnimationFrame(() => portal.classList.add('show'));
    portalVideo.playbackRate = curRate;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      portalVideo.play().catch(() => {});
    }
    clearInterval(tickTimer);
    tickTimer = setInterval(tick, 500);
    chrome.storage.local.set({ portalOpen: true });
    tick();
    refreshReopenButton();
  }

  // keepSession=true: sirf normal panel par wapas (back), session chalta rahe
  function hidePortal(keepSession) {
    portalVisible = false;
    portal.classList.remove('show');
    clearInterval(tickTimer);
    tickTimer = null;
    setTimeout(() => {
      if (!portalVisible) { portal.classList.add('hidden'); portalVideo.pause(); }
    }, 650);
    chrome.storage.local.set({ portalOpen: false });
    if (!keepSession) {
      session = null;
      chrome.storage.local.set({ portalSession: null });
    }
    refreshReopenButton();
  }

  function openPortal(mode) {
    session = { mode: mode };
    scanDone = (mode === 'monitor');
    scanMessage = '';
    completing = false;
    curRate = targetRate = 0.8;
    dlStamps = [];
    lastActivity = Date.now();
    chrome.storage.local.get(['totalDownloadedCount'], (r) => { lastDownloaded = r.totalDownloadedCount || 0; });
    chrome.storage.local.set({ portalSession: session });
    showPortal();
  }

  portalBack.addEventListener('click', () => hidePortal(true));
  reopenBtn.addEventListener('click', () => {
    chrome.storage.local.get(['isMonitoring'], (r) => {
      if (session) showPortal();
      else if (r.isMonitoring) openPortal('monitor');
    });
  });

  // ---------- portal: har 500ms ----------
  function popNumber() {
    pDownloaded.classList.remove('pop');
    void pDownloaded.offsetWidth;
    pDownloaded.classList.add('pop');
  }

  function tick() {
    chrome.storage.local.get(
      ['totalDownloadedCount', 'pendingCount', 'promptCount', 'generatingCount', 'holdUntil'],
      (r) => {
        if (!session || !portalVisible) return;
        const now = Date.now();
        const isMonitor = session.mode === 'monitor';
        const d = r.totalDownloadedCount || 0;
        const pend = r.pendingCount || 0;
        const gen = r.generatingCount || 0;
        const prompts = r.promptCount || 0;
        const hold = r.holdUntil || 0;

        // download barhne ka hisab (counter reset hua to d < lastDownloaded: sirf naya base)
        let changed = false;
        if (d > lastDownloaded) {
          for (let k = 0; k < d - lastDownloaded; k++) dlStamps.push(now);
          popNumber();
          changed = true;
        }
        lastDownloaded = d;
        dlStamps = dlStamps.filter((t) => now - t < 20000);   // pichle 20 second ki downloads = raftaar

        const busy = pend > 0 || (isMonitor && gen > 0);
        if (busy || changed) lastActivity = now;

        // numbers
        pDownloaded.textContent = d;
        pDownloaded.classList.toggle('long', String(d).length > 3);
        pSubLabel.textContent = isMonitor ? 'PROMPTS' : 'REMAINING';
        pSubValue.textContent = isMonitor ? prompts : pend;

        // complete ka faisla
        const idle = now - lastActivity;
        const finished = isMonitor
          ? (d > 0 && !busy && idle >= IDLE_DONE_MONITOR_MS)
          : (scanDone && !busy && idle >= IDLE_DONE_CURRENT_MS);
        if (!completing && finished) { completing = true; completeAt = now; }
        if (completing && (busy || changed)) completing = false;   // naya kaam aa gaya

        // status line
        let text;
        if (completing) {
          text = d > 0
            ? '✓ All complete — ' + d + ' files saved' + (isMonitor ? ' · monitoring chal rahi hai' : '')
            : (scanMessage || 'Nothing new to download');
        } else if (!scanDone) {
          text = 'Scanning project…';
        } else if (isMonitor && hold > now) {
          text = '⏳ Purani clip ka intezar… ' + Math.ceil((hold - now) / 1000) + 's baad aage barhenge';
        } else if (pend > 0) {
          text = 'Downloading… ' + pend + ' baqi';
        } else if (isMonitor && gen > 0) {
          text = 'Generating: ' + gen;
        } else {
          text = isMonitor ? 'Monitoring live — prompts bhejte rahein' : (scanMessage || 'Ready');
        }
        pStatus.textContent = text;

        // animation ki raftaar: jitni zyada downloads, utni tez; complete par dheere dheere ruk jaye
        if (completing) {
          targetRate = 0.1;
        } else {
          targetRate = 0.8 + Math.min(2.2, dlStamps.length * 0.4 + pend * 0.15);
        }
        curRate += (targetRate - curRate) * (completing ? 0.35 : 0.2);
        portalVideo.playbackRate = Math.max(0.1, Math.min(3, curRate));
        if (completing && curRate < 0.16 && !portalVideo.paused) portalVideo.pause();
        if (!completing && portalVideo.paused && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          portalVideo.play().catch(() => {});
        }

        // portal khud band, normal panel wapas (monitoring chalti rahe)
        if (completing && now - completeAt >= COMPLETE_CLOSE_MS) {
          hidePortal(false);
        }
      }
    );
  }

  // ---------- buttons ----------
  downloadBtn.addEventListener('click', () => {
    saveSettings();
    statusText.textContent = 'Scanning... (grid khud scroll hogi, thora intezar)';
    if (viewMode === 'animated') openPortal('current');
    chrome.runtime.sendMessage({ action: 'downloadCurrentPage' }, (response) => {
      let msg = '';
      if (chrome.runtime.lastError) msg = 'Error: Page Reload Karein!';
      else if (response && response.status) msg = response.status;
      scanMessage = msg;
      scanDone = true;
      statusText.textContent = 'Status: ' + msg;
    });
  });

  monitorBtn.addEventListener('click', () => {
    saveSettings();
    chrome.storage.local.get(['isMonitoring'], (res) => {
      if (!res.isMonitoring) {
        chrome.runtime.sendMessage({ action: 'startMonitoring' }, () => {
          setMonitorButton(true);
          statusText.textContent = 'Status: Auto Monitoring Active...';
          if (viewMode === 'animated') openPortal('monitor');
          refreshReopenButton();
        });
      } else {
        chrome.runtime.sendMessage({ action: 'stopMonitoring' }, () => {
          setMonitorButton(false);
          statusText.textContent = 'Status: Monitoring Stopped';
          if (session && session.mode === 'monitor') hidePortal(false);
          refreshReopenButton();
        });
      }
    });
  });

  resetProjectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resetProjectCounter' }, () => {
      statusText.textContent = 'Counter reset to 001!';
      updateUIStats();
    });
  });

  clearLogBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resetHistory' }, () => {
      statusText.textContent = 'History & sequence reset!';
      updateUIStats();
    });
  });

  // ---------- panel dobara khulne par purani halat wapas ----------
  chrome.storage.local.get([
    'saveFolder', 'dlVideos', 'dlImages', 'ratioFilter', 'keepOrder', 'isMonitoring',
    'viewMode', 'portalSession', 'portalOpen'
  ], (res) => {
    if (res.saveFolder) saveFolderInput.value = res.saveFolder;
    if (res.dlVideos !== undefined) dlVideosInput.checked = res.dlVideos;
    if (res.dlImages !== undefined) dlImagesInput.checked = res.dlImages;
    if (res.ratioFilter) aspectRatioSelect.value = res.ratioFilter;
    if (res.keepOrder !== undefined) keepOrderInput.checked = res.keepOrder;

    viewMode = res.viewMode === 'normal' ? 'normal' : 'animated';
    viewNormalBtn.classList.toggle('active', viewMode === 'normal');
    viewAnimatedBtn.classList.toggle('active', viewMode === 'animated');

    if (res.isMonitoring) {
      setMonitorButton(true);
      statusText.textContent = 'Status: Monitoring Active...';
    }

    session = res.portalSession || null;
    if (viewMode === 'animated' && session && res.portalOpen) {
      scanDone = true;
      chrome.storage.local.get(['totalDownloadedCount'], (r) => {
        lastDownloaded = r.totalDownloadedCount || 0;
        lastActivity = Date.now();
        showPortal();
      });
    } else {
      refreshReopenButton();
    }
  });
});
