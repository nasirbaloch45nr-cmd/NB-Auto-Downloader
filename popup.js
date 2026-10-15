document.addEventListener('DOMContentLoaded', () => {
  const saveFolderInput = document.getElementById('saveFolder');
  const dlVideosInput = document.getElementById('dlVideos');
  const dlImagesInput = document.getElementById('dlImages');
  const aspectRatioSelect = document.getElementById('aspectRatioSelect');
  const videoQualitySelect = document.getElementById('videoQualitySelect');
  const imageQualitySelect = document.getElementById('imageQualitySelect');

  const downloadBtn = document.getElementById('downloadBtn');
  const monitorBtn = document.getElementById('monitorBtn');
  const resetProjectBtn = document.getElementById('resetProjectBtn');
  const clearLogBtn = document.getElementById('clearLogBtn');
  const statusText = document.getElementById('statusText');
  const updateBanner = document.getElementById('updateBanner');
  const appVersion = document.getElementById('appVersion');

  // Current Manifest Version set karein
  const currentVer = chrome.runtime.getManifest().version;
  appVersion.textContent = `v${currentVer}`;

  // GitHub Auto Version Check
  const GITHUB_MANIFEST_URL = 'https://raw.githubusercontent.com/NasirAli-1/NB-Auto-Downloader/main/manifest.json';

  fetch(GITHUB_MANIFEST_URL)
    .then(res => res.json())
    .then(data => {
      if (data.version && data.version !== currentVer) {
        updateBanner.style.display = 'block';
        updateBanner.textContent = `⚡ New Version v${data.version} Available! Click to Update`;
      }
    })
    .catch(() => {
      // Offline / error silent handling
    });

  updateBanner.addEventListener('click', () => {
    alert("Naya update GitHub par live hai! Extension page (chrome://extensions) par Reload (🔄) dabayein.");
  });

  // Saved settings load karein
  chrome.storage.local.get([
    'saveFolder', 'dlVideos', 'dlImages',
    'aspectRatio', 'videoQuality', 'imageQuality', 'isMonitoring'
  ], (res) => {
    if (res.saveFolder) saveFolderInput.value = res.saveFolder;
    if (res.dlVideos !== undefined) dlVideosInput.checked = res.dlVideos;
    if (res.dlImages !== undefined) dlImagesInput.checked = res.dlImages;
    if (res.aspectRatio) aspectRatioSelect.value = res.aspectRatio;
    if (res.videoQuality) videoQualitySelect.value = res.videoQuality;
    if (res.imageQuality) imageQualitySelect.value = res.imageQuality;

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
      aspectRatio: aspectRatioSelect.value,
      videoQuality: videoQualitySelect.value,
      imageQuality: imageQualitySelect.value
    });
  }

  saveFolderInput.addEventListener('change', saveSettings);
  dlVideosInput.addEventListener('change', saveSettings);
  dlImagesInput.addEventListener('change', saveSettings);
  aspectRatioSelect.addEventListener('change', saveSettings);
  videoQualitySelect.addEventListener('change', saveSettings);
  imageQualitySelect.addEventListener('change', saveSettings);

  downloadBtn.addEventListener('click', () => {
    saveSettings();
    statusText.textContent = 'Scanning media...';
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
        chrome.runtime.sendMessage({ action: 'startMonitoring' }, (response) => {
          monitorBtn.textContent = 'Stop Auto Monitoring';
          monitorBtn.className = 'btn btn-danger';
          statusText.textContent = 'Status: Monitoring Active...';
        });
      } else {
        chrome.runtime.sendMessage({ action: 'stopMonitoring' }, (response) => {
          monitorBtn.textContent = 'Start Auto Monitoring';
          monitorBtn.className = 'btn btn-success';
          statusText.textContent = 'Status: Monitoring Stopped';
        });
      }
    });
  });

  resetProjectBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resetProjectCounter' }, (response) => {
      statusText.textContent = 'Counter reset to 001!';
    });
  });

  clearLogBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resetHistory' }, (response) => {
      statusText.textContent = 'History & counter completely reset!';
    });
  });
});
