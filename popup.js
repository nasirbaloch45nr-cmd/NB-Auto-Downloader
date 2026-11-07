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
  let viewMode = 'normal';              // 'normal' | 'animated'
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

    viewMode = res.viewMode === 'animated' ? 'animated' : 'normal';
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

  // =====================================================================
  //  Tabs
  // =====================================================================
  const tabNames = ['Downloader', 'Prompts', 'Logs'];
  const tabBtns = document.querySelectorAll('.tabbtn');
  function showTab(name) {
    tabNames.forEach((n) => $('tab' + n).classList.toggle('hidden', n !== name));
    tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    chrome.storage.local.set({ activeTab: name });
    if (name === 'Prompts') probeFlow();
  }
  tabBtns.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // =====================================================================
  //  Prompting
  // =====================================================================
  const cfgConc = $('cfgConc'), cfgDelayMin = $('cfgDelayMin'), cfgDelayMax = $('cfgDelayMax');
  const cfgRetries = $('cfgRetries'), cfgOutputs = $('cfgOutputs'), cfgInput = $('cfgInput');
  const promptsText = $('promptsText'), promptsCount = $('promptsCount');
  const promptsUpload = $('promptsUpload'), promptsFile = $('promptsFile');
  const engRun = $('engRun'), engPause = $('engPause'), engStop = $('engStop');
  const engRetry = $('engRetry'), engClear = $('engClear');
  const engQueue = $('engQueue'), engSummary = $('engSummary'), engNote = $('engNote'), engProbe = $('engProbe');
  const logBox = $('logBox'), logCopy = $('logCopy'), logClear = $('logClear');

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const parsePrompts = (text) => text.replace(/\r/g, '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

  function readCfg() {
    return {
      concurrency: parseInt(cfgConc.value, 10), delayMin: Number(cfgDelayMin.value) || 0, delayMax: Number(cfgDelayMax.value) || 0,
      retries: parseInt(cfgRetries.value, 10), outputs: cfgOutputs.value, inputMode: cfgInput.value
    };
  }
  let cfgTimer = null;
  function saveEngineCfg() {
    clearTimeout(cfgTimer);
    cfgTimer = setTimeout(() => chrome.storage.local.set({ engineCfg: Object.assign(readCfg(), { promptsText: promptsText.value }) }), 300);
  }
  function updatePromptsCount() { promptsCount.textContent = parsePrompts(promptsText.value).length; }

  [cfgConc, cfgDelayMin, cfgDelayMax, cfgRetries, cfgOutputs].forEach((el) => el.addEventListener('change', saveEngineCfg));
  promptsText.addEventListener('input', () => { updatePromptsCount(); saveEngineCfg(); });
  cfgInput.addEventListener('change', () => {
    if (cfgInput.value === 'trusted') {
      // debugger ki ijazat sirf tab maangte hain jab user "Trusted" chune (Chrome peeli debugging patti dikhata hai)
      chrome.permissions.request({ permissions: ['debugger'] }, (granted) => {
        if (!granted) { cfgInput.value = 'normal'; setEngNote('debugger ki ijazat nahi mili, Normal par wapas'); }
        saveEngineCfg();
      });
    } else {
      saveEngineCfg();
    }
  });
  promptsUpload.addEventListener('click', () => promptsFile.click());
  promptsFile.addEventListener('change', () => {
    const f = promptsFile.files && promptsFile.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      promptsText.value = (promptsText.value.trim() ? promptsText.value.trim() + '\n\n' : '') + String(r.result).trim();
      updatePromptsCount(); saveEngineCfg();
    };
    r.readAsText(f);
    promptsFile.value = '';
  });

  function setEngNote(t) { engNote.textContent = t || ''; }
  function sendEngine(payload, cb) {
    chrome.runtime.sendMessage({ action: 'engineCommand', payload: payload }, (resp) => {
      const err = chrome.runtime.lastError;
      cb && cb(err ? { ok: false, error: err.message } : (resp || { ok: false, error: 'jawab nahi aaya' }));
    });
  }

  function probeFlow() {
    sendEngine({ action: 'engineProbe' }, (r) => {
      if (!r.ok && r.error) { engProbe.textContent = '⚠ ' + r.error; return; }
      engProbe.textContent = (r.project ? '✓ project' : '✗ project page nahi') + ' · ' + (r.editor ? '✓ prompt box' : '✗ prompt box') +
        ' · ' + (r.generate ? '✓ Generate' : '✗ Generate') + (r.outputs ? ' · Flow par x' + r.outputs : '');
    });
  }

  engRun.addEventListener('click', () => {
    const prompts = parsePrompts(promptsText.value);
    if (!prompts.length) { setEngNote('Pehle prompts likhein'); return; }
    saveEngineCfg();
    setEngNote('');
    sendEngine({ action: 'engineStart', prompts: prompts, cfg: readCfg() }, (r) => setEngNote(r.ok ? '' : r.error));
  });
  engPause.addEventListener('click', () => {
    chrome.storage.local.get(['engineState'], (res) => {
      const paused = res.engineState && res.engineState.paused;
      sendEngine({ action: paused ? 'engineResume' : 'enginePause' }, (r) => setEngNote(r.ok ? '' : r.error));
    });
  });
  engStop.addEventListener('click', () => sendEngine({ action: 'engineStop' }, (r) => setEngNote(r.ok ? '' : r.error)));
  engRetry.addEventListener('click', () => sendEngine({ action: 'engineRetryFailed' }, (r) => setEngNote(r.ok ? '' : r.error)));
  engClear.addEventListener('click', () => {
    chrome.storage.local.get(['engineState'], (res) => {
      if (res.engineState && res.engineState.running) { setEngNote('Pehle Stop dabayein'); return; }
      chrome.storage.local.remove(['engineState', 'engineLog']);
      setEngNote('');
    });
  });

  const chipText = { queued: 'intezar', sending: 'bhej raha', generating: 'generate', done: 'done', failed: 'fail', interrupted: 'adhoori' };
  function renderEngine(res) {
    const st = res.engineState;
    if (!st || !st.jobs || !st.jobs.length) {
      engQueue.innerHTML = '<div class="note">Abhi koi run nahi</div>';
      engSummary.textContent = '';
    } else {
      engQueue.innerHTML = st.jobs.map((j) =>
        '<div class="qrow"><span class="qn">' + (j.idx + 1) + '</span><span class="qt" title="' + esc(j.text) + '">' + esc(j.text.slice(0, 50)) +
        '</span><span class="chip ' + j.status + '" title="' + esc(j.err || '') + '">' + chipText[j.status] + (j.attempts > 1 ? ' ×' + j.attempts : '') + '</span></div>'
      ).join('');
      const c = st.counts || {};
      engSummary.textContent = 'Bheje ' + (c.sent || 0) + '/' + (c.total || 0) + ' · Done ' + (c.done || 0) + ' · Fail ' + (c.failed || 0) +
        (st.running ? (st.paused ? ' · PAUSE' : ' · chal raha') : '');
    }
    const running = !!(st && st.running);
    engRun.disabled = running;
    engPause.disabled = !running;
    engPause.textContent = st && st.paused ? '▶ Resume' : '⏸ Pause';
    if (st && st.note) setEngNote(st.note);

    if (!$('tabLogs').classList.contains('hidden')) {
      const lines = res.engineLog || [];
      const atBottom = logBox.scrollTop + logBox.clientHeight >= logBox.scrollHeight - 30;
      logBox.innerHTML = lines.map((l) => {
        const d = new Date(l.t), pad = (n) => String(n).padStart(2, '0');
        return '<div class="' + (l.l || '') + '"><span class="t">' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '</span> ' + esc(l.m) + '</div>';
      }).join('') || '<div class="t">Abhi koi log nahi.</div>';
      if (atBottom) logBox.scrollTop = logBox.scrollHeight;
    }
  }
  setInterval(() => chrome.storage.local.get(['engineState', 'engineLog'], renderEngine), 700);

  logCopy.addEventListener('click', () => {
    chrome.storage.local.get(['engineLog'], (res) => {
      const text = (res.engineLog || []).map((l) => new Date(l.t).toLocaleTimeString() + ' [' + l.l + '] ' + l.m).join('\n');
      navigator.clipboard.writeText(text).catch(() => {});
    });
  });
  logClear.addEventListener('click', () => chrome.storage.local.remove(['engineLog']));

  // purani settings aur aakhri tab wapas
  chrome.storage.local.get(['engineCfg', 'activeTab'], (res) => {
    const c = res.engineCfg;
    if (c) {
      if (c.concurrency) cfgConc.value = String(c.concurrency);
      if (c.delayMin !== undefined) cfgDelayMin.value = c.delayMin;
      if (c.delayMax !== undefined) cfgDelayMax.value = c.delayMax;
      if (c.retries !== undefined) cfgRetries.value = String(c.retries);
      if (c.outputs) cfgOutputs.value = c.outputs;
      if (c.inputMode) cfgInput.value = c.inputMode;
      if (c.promptsText) promptsText.value = c.promptsText;
    }
    updatePromptsCount();
    showTab(tabNames.indexOf(res.activeTab) >= 0 ? res.activeTab : 'Downloader');
  });
});
