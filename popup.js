document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response && response.isRunning) {
      updateUIState(true);
    }
  });
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
