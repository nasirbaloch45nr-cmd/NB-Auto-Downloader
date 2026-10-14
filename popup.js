document.addEventListener('DOMContentLoaded', () => {
  const folderInput = document.getElementById('folderInput');
  const dlVideos = document.getElementById('dlVideos');
  const dlImages = document.getElementById('dlImages');
  const intervalSelect = document.getElementById('intervalSelect');
  const downloadBtn = document.getElementById('downloadBtn');
  const monitorBtn = document.getElementById('monitorBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusDiv = document.getElementById('status');

  // Storage se settings load karein
  chrome.storage.local.get(['saveFolder', 'dlVideos', 'dlImages', 'checkInterval', 'isMonitoring'], (res) => {
    if (res.saveFolder && folderInput) folderInput.value = res.saveFolder;
    if (res.dlVideos !== undefined && dlVideos) dlVideos.checked = res.dlVideos;
    if (res.dlImages !== undefined && dlImages) dlImages.checked = res.dlImages;
    if (res.checkInterval && intervalSelect) intervalSelect.value = res.checkInterval;
    
    if (res.isMonitoring && monitorBtn) {
      monitorBtn.textContent = 'Stop Auto Monitoring';
      monitorBtn.style.background = '#e74c3c';
      if (statusDiv) statusDiv.textContent = 'Status: Monitoring Active...';
    }
  });

  // Settings save karein jab inputs change ho
  function saveSettings() {
    chrome.storage.local.set({
      saveFolder: folderInput ? (folderInput.value.trim() || 'GoogleFlow_Media') : 'GoogleFlow_Media',
      dlVideos: dlVideos ? dlVideos.checked : true,
      dlImages: dlImages ? dlImages.checked : true,
      checkInterval: intervalSelect ? parseInt(intervalSelect.value, 10) : 3000
    });
  }

  if (folderInput) folderInput.addEventListener('change', saveSettings);
  if (dlVideos) dlVideos.addEventListener('change', saveSettings);
  if (dlImages) dlImages.addEventListener('change', saveSettings);
  if (intervalSelect) intervalSelect.addEventListener('change', saveSettings);

  // Single page download button
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      saveSettings();
      if (statusDiv) statusDiv.textContent = 'Status: Extracting media...';

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        if (statusDiv) statusDiv.textContent = 'Status: No active tab found!';
        return;
      }

      chrome.runtime.sendMessage({ action: 'downloadCurrentPage', tabId: tab.id }, (response) => {
        if (chrome.runtime.lastError) {
          if (statusDiv) statusDiv.textContent = 'Status: Page reload karke try karein!';
        } else if (response && response.status) {
          if (statusDiv) statusDiv.textContent = `Status: ${response.status}`;
        }
      });
    });
  }

  // Start/Stop Monitoring button
  if (monitorBtn) {
    monitorBtn.addEventListener('click', async () => {
      saveSettings();
      const res = await chrome.storage.local.get(['isMonitoring']);
      const newState = !res.isMonitoring;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        if (statusDiv) statusDiv.textContent = 'Status: No active tab found!';
        return;
      }

      if (newState) {
        chrome.runtime.sendMessage({ action: 'startMonitoring', tabId: tab.id }, (response) => {
          if (chrome.runtime.lastError) {
            if (statusDiv) statusDiv.textContent = 'Status: Page reload karke try karein!';
          } else {
            chrome.storage.local.set({ isMonitoring: true });
            monitorBtn.textContent = 'Stop Auto Monitoring';
            monitorBtn.style.background = '#e74c3c';
            if (statusDiv) statusDiv.textContent = 'Status: Monitoring Started!';
          }
        });
      } else {
        chrome.runtime.sendMessage({ action: 'stopMonitoring' }, (response) => {
          chrome.storage.local.set({ isMonitoring: false });
          monitorBtn.textContent = 'Start Auto Monitoring';
          monitorBtn.style.background = '#2ecc71';
          if (statusDiv) statusDiv.textContent = 'Status: Monitoring Stopped';
        });
      }
    });
  }

  // Reset history button
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'resetHistory' }, (response) => {
        if (statusDiv) statusDiv.textContent = 'Status: History cleared!';
      });
    });
  }
});
