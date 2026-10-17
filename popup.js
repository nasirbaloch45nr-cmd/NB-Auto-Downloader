document.addEventListener('DOMContentLoaded', () => {
  const saveFolderInput = document.getElementById('saveFolder');
  const dlVideosInput = document.getElementById('dlVideos');
  const dlImagesInput = document.getElementById('dlImages');
  const aspectRatioSelect = document.getElementById('aspectRatioSelect');

  const downloadBtn = document.getElementById('downloadBtn');
  const monitorBtn = document.getElementById('monitorBtn');
  const resetProjectBtn = document.getElementById('resetProjectBtn');
  const clearLogBtn = document.getElementById('clearLogBtn');
  const statusText = document.getElementById('statusText');
  const counterDownloaded = document.getElementById('counterDownloaded');
  const nextClipSeq = document.getElementById('nextClipSeq');

  // Version khud manifest se
  document.getElementById('appVersion').textContent = 'v' + chrome.runtime.getManifest().version;

  function updateUIStats() {
    chrome.storage.local.get(['totalDownloadedCount', 'clipSequenceCounter'], (res) => {
      counterDownloaded.textContent = res.totalDownloadedCount || 0;
      const seq = res.clipSequenceCounter || 1;
      nextClipSeq.textContent = String(seq).padStart(3, '0');
    });
  }

  setInterval(updateUIStats, 1000);
  updateUIStats();

  chrome.storage.local.get([
    'saveFolder', 'dlVideos', 'dlImages', 'ratioFilter', 'isMonitoring'
  ], (res) => {
    if (res.saveFolder) saveFolderInput.value = res.saveFolder;
    if (res.dlVideos !== undefined) dlVideosInput.checked = res.dlVideos;
    if (res.dlImages !== undefined) dlImagesInput.checked = res.dlImages;
    if (res.ratioFilter) aspectRatioSelect.value = res.ratioFilter;

    if (res.isMonitoring) {
      monitorBtn.textContent = 'Stop Auto Monitoring';
      monitorBtn.className = 'btn btn-danger';
      statusText.textContent = 'Status: Monitoring Active...';
    }
  });

  function saveSettings() {
    chrome.storage.local.set({
      saveFolder: saveFolderInput.value.trim() || 'GoogleFlow_Media',
      dlVideos: dlVideosInput.checked,
      dlImages: dlImagesInput.checked,
      ratioFilter: aspectRatioSelect.value
    });
  }

  saveFolderInput.addEventListener('change', saveSettings);
  dlVideosInput.addEventListener('change', saveSettings);
  dlImagesInput.addEventListener('change', saveSettings);
  aspectRatioSelect.addEventListener('change', saveSettings);

  downloadBtn.addEventListener('click', () => {
    saveSettings();
    statusText.textContent = 'Scanning... (grid khud scroll hogi, thora intezar)';
    chrome.runtime.sendMessage({ action: 'downloadCurrentPage' }, (response) => {
      if (chrome.runtime.lastError) {
        statusText.textContent = 'Error: Page Reload Karein!';
      } else if (response && response.status) {
        statusText.textContent = `Status: ${response.status}`;
      }
    });
  });

  monitorBtn.addEventListener('click', () => {
    saveSettings();
    chrome.storage.local.get(['isMonitoring'], (res) => {
      const isMonitoring = !res.isMonitoring;
      if (isMonitoring) {
        chrome.runtime.sendMessage({ action: 'startMonitoring' }, () => {
          monitorBtn.textContent = 'Stop Auto Monitoring';
          monitorBtn.className = 'btn btn-danger';
          statusText.textContent = 'Status: Auto Monitoring Active...';
        });
      } else {
        chrome.runtime.sendMessage({ action: 'stopMonitoring' }, () => {
          monitorBtn.textContent = 'Start Auto Monitoring';
          monitorBtn.className = 'btn btn-success';
          statusText.textContent = 'Status: Monitoring Stopped';
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
});
