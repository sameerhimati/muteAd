let adObserver = null;
let isAdMuterEnabled = false;
let isMuted = false;
let isAdPlaying = false;
let adStartTime = 0;
let lastKnownVideoTime = 0;
let lastKnownVideoDuration = 0;
let consecutiveAdChecks = 0;
const AD_CHECK_THRESHOLD = 3;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 2000; // 2 seconds

function initAdDetection() {
  if (adObserver) {
    adObserver.disconnect();
  }
  adObserver = new MutationObserver(() => {
    checkForHuluAds();
  });
  const config = { childList: true, subtree: true, attributes: true, characterData: true };

  function observePlayer() {
    const playerContainer = document.querySelector('#content-video-player') || document.body;
    if (playerContainer) {
      console.log('Player container found, initializing ad detection');
      adObserver.observe(playerContainer, config);
      setInterval(checkForHuluAds, 1000); // Periodic check every second
    } else {
      console.log('Player container not found, will retry');
      setTimeout(observePlayer, 1000); // Retry after 1 second
    }
  }

  observePlayer();
  console.log('Hulu ad detection initialized');
}

function checkForHuluAds() {
  if (!isAdMuterEnabled) return;

  try {
    const adDetected = checkVisualAdMarkers() || 
                       checkPlayerStateChanges() || 
                       checkAudioLevels() ||
                       checkNetworkRequests();

    if (adDetected) {
      consecutiveAdChecks++;
      if (consecutiveAdChecks >= AD_CHECK_THRESHOLD && !isAdPlaying) {
        isAdPlaying = true;
        adStartTime = Date.now();
        handleAdStart();
      }
    } else {
      if (consecutiveAdChecks >= AD_CHECK_THRESHOLD && isAdPlaying) {
        isAdPlaying = false;
        handleAdEnd();
      }
      consecutiveAdChecks = 0;
    }

    console.log('Hulu ad check:', { adDetected, consecutiveAdChecks, isAdPlaying });
    reconnectAttempts = 0; // Reset reconnect attempts on successful check
  } catch (error) {
    console.error('Error checking for Hulu ads:', error);
    handleExtensionError(error);
  }
}

function checkVisualAdMarkers() {
    const adMarkers = [
        '.ad-container', '.AdUnitView', '.ad-overlay', '.ad-progress-bar',
        '[data-automation-id="ad-unit"]', '[data-automationid="player-ad-notice"]',
        '.AdBanner', '.AdTag', '[data-ad-break-type]', '[data-ad-break-start]'
    ];
    return adMarkers.some(marker => document.querySelector(marker));
}

function checkPlayerStateChanges() {
    const videoElement = document.querySelector('video');
    if (!videoElement) return false;

    const currentTime = videoElement.currentTime;
    const duration = videoElement.duration;

    const durationChanged = Math.abs(duration - lastKnownVideoDuration) > 5;
    const unexpectedTimeJump = Math.abs(currentTime - lastKnownVideoTime) > 5 && 
                               Math.abs(currentTime - lastKnownVideoTime) < duration - 5;

    lastKnownVideoTime = currentTime;
    lastKnownVideoDuration = duration;

    return durationChanged || unexpectedTimeJump;
}

function checkAudioLevels() {
    // Placeholder for audio level analysis
    return false;
}

function checkNetworkRequests() {
    // Placeholder for network request analysis
    return false;
}

function handleAdStart() {
  console.log('Ad detected, attempting to mute tab');
  chrome.runtime.sendMessage({ action: 'muteTab' })
    .then(response => {
      if (response && response.success) {
        console.log('Tab muted successfully');
        isMuted = true;
      } else {
        throw new Error('Failed to mute tab: ' + (response ? response.error : 'Unknown error'));
      }
    })
    .catch(error => {
      console.error('Error sending mute message:', error);
      handleExtensionError(error);
    });
}
  
  function handleAdEnd() {
    console.log('Ad ended, attempting to unmute tab');
    const adDuration = Math.round((Date.now() - adStartTime) / 1000);
    chrome.runtime.sendMessage({ action: 'unmuteTab', adDuration: adDuration })
      .then(response => {
        if (response && response.success) {
          console.log('Tab unmuted successfully');
          isMuted = false;
        } else {
          console.error('Failed to unmute tab:', response ? response.error : 'Unknown error');
          throw new Error('Failed to unmute tab');
        }
      })
      .catch(error => {
        console.error('Error sending unmute message:', error);
        handleExtensionError(error);
      });
  }
  
  function handleExtensionError(error) {
    console.error('Handling extension error:', error);
    if (error.message.includes('Extension context invalidated') || error.message.includes('Chrome runtime not available')) {
      reconnectToExtension();
    }
  }
  
  function reconnectToExtension() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached. Please refresh the page.');
      return;
    }
  
    reconnectAttempts++;
    console.log(`Attempting to reconnect to extension (Attempt ${reconnectAttempts})`);
  
    setTimeout(() => {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'ping' })
          .then(response => {
            console.log('Reconnected to extension successfully');
            initAdDetection();
          })
          .catch(error => {
            console.log('Reconnection failed, retrying...');
            reconnectToExtension();
          });
      } else {
        console.log('Chrome runtime still not available, retrying...');
        reconnectToExtension();
      }
    }, RECONNECT_INTERVAL);
  }
  
  // Initialize on load
function initialize() {
  if (!chrome.runtime) {
    console.error('Chrome runtime not available');
    return;
  }

  chrome.runtime.sendMessage({ action: 'getAdMuterState' })
    .then(response => {
      if (!response) {
        throw new Error('No response received from background script');
      }
      isAdMuterEnabled = response.enabled;
      if (isAdMuterEnabled) {
        initAdDetection();
      }
    })
    .catch(error => {
      console.error('Failed to get initial state:', error.message);
      reconnectToExtension();
    });
}

// Use this initialization approach in both scripts
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
  
  // Listen for runtime messages
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateAdMuterState') {
        isAdMuterEnabled = request.enabled;
        if (isAdMuterEnabled) {
          initAdDetection();
        } else {
          stopAdDetection();
          if (isAdPlaying) {
            handleAdEnd();
          }
        }
        sendResponse({ success: true });
      }
      return true;
    });
    
  }

  function stopAdDetection() {
    if (adObserver) {
      adObserver.disconnect();
      adObserver = null;
    }
    // Clear any intervals or timeouts you might have set
    console.log('Ad detection stopped');
  }

  console.log('Hulu content script loaded');