document.addEventListener('DOMContentLoaded', () => {
  // Load saved folder name
  chrome.storage.local.get(['customFolder'], (data) => {
    if (data.customFolder) {
      document.getElementById('folderInput').value = data.customFolder;
    } else {
      document.getElementById('folderInput').value = 'GoogleFlow_Media';
    }
  });

  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.isRunning) {
      updateUIState(true);
    }
  });
});

// Save folder name on change
document.getElementById('folderInput').addEventListener('input', (e) => {
  const folderName = e.target.value.trim();
  chrome.storage.local.set({ customFolder: folderName });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Downloading current...';
  chrome.runtime.sendMessage({ action: 'startMonitoring' });
  setTimeout(() => {
    statusDiv.textContent = 'Status: Done / Monitoring';
  }, 1500);
});

document.getElementById('autoToggleBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    const isRunning = response ? response.isRunning : false;

    if (!isRunning) {
      chrome.runtime.sendMessage({ action: 'startMonitoring' }, () => {
        updateUIState(true);
      });
    } else {
      chrome.runtime.sendMessage({ action: 'stopMonitoring' }, () => {
        updateUIState(false);
      });
    }
  });
});

function updateUIState(isRunning) {
  const toggleBtn = document.getElementById('autoToggleBtn');
  const statusDiv = document.getElementById('status');

  if (isRunning) {
    toggleBtn.textContent = 'Stop Auto Monitoring';
    toggleBtn.classList.add('active');
    statusDiv.textContent = 'Status: Background Live...';
  } else {
    toggleBtn.textContent = 'Start Auto Monitoring';
    toggleBtn.classList.remove('active');
    statusDiv.textContent = 'Status: Monitoring Stopped';
  }
}
document.addEventListener('DOMContentLoaded', () => {
  // Load saved settings
  chrome.storage.local.get(['customFolder', 'dlVideos', 'dlImages', 'checkInterval'], (data) => {
    document.getElementById('folderInput').value = data.customFolder || 'GoogleFlow_Media';
    document.getElementById('dlVideos').checked = data.dlVideos !== false;
    document.getElementById('dlImages').checked = data.dlImages !== false;
    if (data.checkInterval) {
      document.getElementById('intervalSelect').value = data.checkInterval;
    }
  });

  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.isRunning) {
      updateUIState(true);
    }
  });
});

// Save settings dynamically on change
document.getElementById('folderInput').addEventListener('input', (e) => {
  chrome.storage.local.set({ customFolder: e.target.value.trim() });
});

document.getElementById('dlVideos').addEventListener('change', (e) => {
  chrome.storage.local.set({ dlVideos: e.target.checked });
});

document.getElementById('dlImages').addEventListener('change', (e) => {
  chrome.storage.local.set({ dlImages: e.target.checked });
});

document.getElementById('intervalSelect').addEventListener('change', (e) => {
  const interval = parseInt(e.target.value);
  chrome.storage.local.set({ checkInterval: interval });
  // Notify background service worker to update interval if running
  chrome.runtime.sendMessage({ action: 'updateInterval', interval: interval });
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = 'Downloading current...';
  chrome.runtime.sendMessage({ action: 'startMonitoring' });
  setTimeout(() => {
    statusDiv.textContent = 'Status: Done / Monitoring';
  }, 1500);
});

document.getElementById('autoToggleBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    const isRunning = response ? response.isRunning : false;

    if (!isRunning) {
      chrome.runtime.sendMessage({ action: 'startMonitoring' }, () => {
        updateUIState(true);
      });
    } else {
      chrome.runtime.sendMessage({ action: 'stopMonitoring' }, () => {
        updateUIState(false);
      });
    }
  });
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to clear download history log?')) {
    chrome.storage.local.set({ downloadedHistory: [] }, () => {
      document.getElementById('status').textContent = 'History Cleared!';
      setTimeout(() => {
        document.getElementById('status').textContent = 'Status: Ready';
      }, 1500);
    });
  }
});

function updateUIState(isRunning) {
  const toggleBtn = document.getElementById('autoToggleBtn');
  const statusDiv = document.getElementById('status');

  if (isRunning) {
    toggleBtn.textContent = 'Stop Auto Monitoring';
    toggleBtn.classList.add('active');
    statusDiv.textContent = 'Status: Background Live...';
  } else {
    toggleBtn.textContent = 'Start Auto Monitoring';
    toggleBtn.classList.remove('active');
    statusDiv.textContent = 'Status: Monitoring Stopped';
  }
}
