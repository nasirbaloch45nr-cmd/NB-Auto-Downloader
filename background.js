// Extension install ya update hone par
chrome.runtime.onInstalled.addListener(() => {
  console.log('NB Auto Downloader installed.');
  chrome.storage.local.set({ isMonitoring: false });
});

// Popup ya content script se aane wale messages ko handle karna
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadCurrentPage') {
    // Current tab par media scan karne ke liye content script ko message bhejna
    chrome.tabs.sendMessage(request.tabId, { action: 'scanAndDownload' }, (response) => {
      if (chrome.runtime.lastError) {
        // Agar content script inject nahi hai toh use inject karein
        chrome.scripting.executeScript({
          target: { tabId: request.tabId },
          files: ['content.js']
        }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ status: 'Page reload karke try karein!' });
          } else {
            // Dobara message bhejiye
            chrome.tabs.sendMessage(request.tabId, { action: 'scanAndDownload' }, (res) => {
              if (chrome.runtime.lastError) {
                sendResponse({ status: 'Download failed: Page not supported' });
              } else {
                sendResponse(res || { status: 'Download triggered!' });
              }
            });
          }
        });
      } else {
        sendResponse(response || { status: 'Download triggered!' });
      }
    });
    return true; // Async response ke liye true return karna zaroori hai
  } 
  
  else if (request.action === 'startMonitoring') {
    chrome.storage.local.set({ isMonitoring: true }, () => {
      sendResponse({ status: 'Monitoring Started' });
    });
    return true;
  } 
  
  else if (request.action === 'stopMonitoring') {
    chrome.storage.local.set({ isMonitoring: false }, () => {
      sendResponse({ status: 'Monitoring Stopped' });
    });
    return true;
  } 
  
  else if (request.action === 'resetHistory') {
    // History ya downloaded items cache clear karne ki logic agar ho
    sendResponse({ status: 'History cleared!' });
    return true;
  }
});
