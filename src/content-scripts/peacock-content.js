let adObserver = null;
let isAdMuterEnabled = false;
let isMuted = false;
let isAdPlaying = false;
let adStartTime = 0;
let adDuration = 0;
const AD_CHECK_INTERVAL = 500;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function initAdDetection() {
  if (adObserver) {
    adObserver.disconnect();
  }
  adObserver = new MutationObserver(checkForPeacockAds);
  const config = { childList: true, subtree: true, attributes: true };

  adObserver.observe(document.documentElement, config);
  console.log('Peacock ad detection initialized');
  setInterval(checkForPeacockAds, AD_CHECK_INTERVAL);
}

function checkForPeacockAds() {
  if (!isAdMuterEnabled) return;

  try {
    const adCountdown = document.querySelector('.countdown__foreground-ring');
    const adCountdownContainer = document.querySelector('.countdown-container.ad-countdown__container');

    if (adCountdown && adCountdownContainer) {
      if (!isAdPlaying) {
        isAdPlaying = true;
        adStartTime = Date.now();
        handleAdStart();
      }

      const remainingTimeElement = adCountdownContainer.querySelector('.countdown__remaining-time');
      if (remainingTimeElement) {
        const remainingTime = parseInt(remainingTimeElement.textContent);
        if (!isNaN(remainingTime)) {
          adDuration = remainingTime;
          console.log(`Ad duration detected: ${adDuration} seconds`);
        }
      }
    } else if (isAdPlaying) {
      isAdPlaying = false;
      handleAdEnd();
    }

    reconnectAttempts = 0; // Reset reconnect attempts on successful check
  } catch (error) {
    console.error('Error checking for Peacock ads:', error);
    handleExtensionError(error);
  }
}

function handleAdStart() {
  console.log('Peacock ad detected, attempting to mute tab');
  chrome.runtime.sendMessage({ action: 'muteTab' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error sending mute message:', chrome.runtime.lastError);
      handleExtensionError(chrome.runtime.lastError);
    } else if (response && response.success) {
      console.log('Tab muted successfully');
      isMuted = true;
    } else {
      console.error('Failed to mute tab:', response ? response.error : 'Unknown error');
    }
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
  if (error.message.includes('Extension context invalidated')) {
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
    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Reconnection failed, retrying...');
        reconnectToExtension();
      } else {
        console.log('Reconnected to extension successfully');
        initAdDetection();
      }
    });
  }, 1000 * reconnectAttempts); // Increase delay with each attempt
}

// Initialize on load
chrome.runtime.sendMessage({ action: 'getAdMuterState' }, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Failed to get initial state:', chrome.runtime.lastError);
    reconnectToExtension();
  } else {
    isAdMuterEnabled = response.enabled;
    if (isAdMuterEnabled) {
      initAdDetection();
    }
  }
});

// Listen for messages from the background script
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

  function stopAdDetection() {
    if (adObserver) {
      adObserver.disconnect();
      adObserver = null;
    }
    // Clear any intervals or timeouts you might have set
    console.log('Ad detection stopped');
  }
console.log('Peacock content script loaded');