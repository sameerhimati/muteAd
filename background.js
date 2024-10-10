chrome.runtime.onInstalled.addListener(() => {
    console.log('Ad Muter extension installed');
    chrome.storage.sync.set({ 
      adMuterEnabled: true,
      adsMuted: 0,
      secondsSaved: 0
    }, () => {
      console.log('Initial settings saved');
    });
  });
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "muteTab") {
      chrome.tabs.update(sender.tab.id, { muted: true });
      sendResponse({ success: true });
    } else if (request.action === "unmuteTab") {
      chrome.tabs.update(sender.tab.id, { muted: false });
      updateMetrics(request.adDuration);
      sendResponse({ success: true });
    } else if (request.action === "getMetrics") {
      chrome.storage.sync.get(['adsMuted', 'secondsSaved'], (result) => {
        sendResponse({ 
          adsMuted: result.adsMuted || 0, 
          timeSaved: formatTimeSaved(result.secondsSaved || 0)
        });
      });
      return true; // Indicates we will send a response asynchronously
    } else if (request.action === 'ping') {
      sendResponse({ success: true });
    } else if (request.action === 'getAdMuterState') {
      chrome.storage.sync.get('adMuterEnabled', (data) => {
        sendResponse({ enabled: data.adMuterEnabled });
      });
      return true; // Will respond asynchronously
    }
    return true;
  });
  
  function updateMetrics(adDuration) {
    chrome.storage.sync.get(['adsMuted', 'secondsSaved'], (result) => {
      let newAdsMuted = result.adsMuted || 0;
      let newSecondsSaved = result.secondsSaved || 0;
  
      newAdsMuted++;
      newSecondsSaved += adDuration || 0;
  
      chrome.storage.sync.set({ 
        adsMuted: newAdsMuted, 
        secondsSaved: newSecondsSaved 
      }, () => {
        console.log('Metrics updated:', { adsMuted: newAdsMuted, secondsSaved: newSecondsSaved });
      });
    });
  }
  
  function formatTimeSaved(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
  
    let formattedTime = '';
    if (hours > 0) formattedTime += `${hours}h `;
    if (minutes > 0 || hours > 0) formattedTime += `${minutes}m `;
    formattedTime += `${remainingSeconds}s`;
  
    return formattedTime.trim();
  }
  
  console.log('Background script loaded');