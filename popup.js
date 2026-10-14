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
    if (res.saveFolder) folderInput.value = res.saveFolder;
    if (res.dlVideos !== undefined) dlVideos.checked = res.dlVideos;
    if (res.dlImages !== undefined) dlImages.checked = res.dlImages;
    if (res.checkInterval) intervalSelect.value = res.checkInterval;
    
    if (res.isMonitoring) {
      monitorBtn.textContent = 'Stop Auto Monitoring';
      monitorBtn.style.background = '#e74c3c';
      statusDiv.textContent = 'Status: Monitoring Active...';
    }
  });

  // Settings save karein jab inputs change ho
  function saveSettings() {
    chrome.storage.local.set({
      saveFolder: folderInput.value.trim() || 'GoogleFlow_Media',
      dlVideos: dlVideos.checked,
      dlImages: dlImages.checked,
      checkInterval: parseInt(intervalSelect.value, 10)
    });
  }

  folderInput.addEventListener('change', saveSettings);
  dlVideos.addEventListener('change', saveSettings);
  dlImages.addEventListener('change', saveSettings);
  intervalSelect.addEventListener('change', saveSettings);

  // Single page download button
  downloadBtn.addEventListener('click', async () => {
    saveSettings();
    statusDiv.textContent = 'Status: Extracting media...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      statusDiv.textContent = 'Status: No active tab found!';
      return;
    }

    chrome.runtime.sendMessage({ action: 'downloadCurrentPage', tabId: tab.id }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = 'Status: Page reload karke try karein!';
      } else if (response && response.status) {
        statusDiv.textContent = `Status: ${response.status}`;
      }
    });
  });

  // Start/Stop Monitoring button
  monitorBtn.addEventListener('click', async () => {
    saveSettings();
    const res = await chrome.storage.local.get(['isMonitoring']);
    const newState = !res.isMonitoring;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      statusDiv.textContent = 'Status: No active tab found!';
      return;
    }

    if (newState) {
      chrome.runtime.sendMessage({ action: 'startMonitoring', tabId: tab.id }, (response) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Status: Page reload karke try karein!';
        } else {
          chrome.storage.local.set({ isMonitoring: true });
          monitorBtn.textContent = 'Stop Auto Monitoring';
          monitorBtn.style.background = '#e74c3c';
          statusDiv.textContent = 'Status: Monitoring Started!';
        }
      });
    } else {
      chrome.runtime.sendMessage({ action: 'stopMonitoring' }, (response) => {
        chrome.storage.local.set({ isMonitoring: false });
        monitorBtn.textContent = 'Start Auto Monitoring';
        monitorBtn.style.background = '#2ecc71';
        statusDiv.textContent = 'Status: Monitoring Stopped';
      });
    }
  });

  // Reset history button
  resetBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'resetHistory' }, (response) => {
      statusDiv.textContent = 'Status: History cleared!';
    });
  });
});
