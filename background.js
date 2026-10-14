// Extension install setup
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ isMonitoring: false });
});

// Messages listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadCurrentPage') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        sendResponse({ status: 'No active tab!' });
        return;
      }
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'scanAndDownload' }, (res) => {
        if (chrome.runtime.lastError) {
          // Programmatically script inject karke try karein
          chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            files: ['content.js']
          }).then(() => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'scanAndDownload' }, (res2) => {
              if (chrome.runtime.lastError) {
                sendResponse({ status: 'Is page par reload zaroori hai!' });
              } else {
                sendResponse(res2 || { status: 'Download Triggered!' });
              }
            });
          }).catch(() => {
            sendResponse({ status: 'Is page par run nahi ho sakta' });
          });
        } else {
          sendResponse(res || { status: 'Download Triggered!' });
        }
      });
    });
    return true; // Async handle karne ke liye
  }

  if (request.action === 'startMonitoring') {
    chrome.storage.local.set({ isMonitoring: true });
    sendResponse({ status: 'Monitoring Started' });
    return true;
  }

  if (request.action === 'stopMonitoring') {
    chrome.storage.local.set({ isMonitoring: false });
    sendResponse({ status: 'Monitoring Stopped' });
    return true;
  }

  if (request.action === 'resetHistory') {
    chrome.storage.local.set({ downloadedFiles: [] });
    sendResponse({ status: 'History Cleared' });
    return true;
  }
});
