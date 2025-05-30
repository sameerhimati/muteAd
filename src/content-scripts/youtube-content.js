let adObserver = null;
let isAdMuterEnabled = false;
let isMuted = false;
let isAdPlaying = false;
let adStartTime = 0;
let errorCount = 0;
const MAX_ERRORS = 5;
const ERROR_RESET_INTERVAL = 60000; // 1 minute

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
    } else if (request.action === 'initializeAdDetection') {
        chrome.storage.sync.get(['adMuterEnabled'], (result) => {
            isAdMuterEnabled = result.adMuterEnabled;
            if (isAdMuterEnabled) {
                initAdDetection();
            }
            sendResponse({ success: true });
        });
    }
    return true;
});

function checkForYouTubeAds() {
    if (!isAdMuterEnabled) return;

    try {
        const adOverlay = document.querySelector('.ytp-ad-player-overlay, .video-ads.ytp-ad-module');
        const skipButton = document.querySelector('.ytp-ad-skip-button, .videoAdUiSkipButton, [id^="skip-button"], .ytp-ad-skip-button-modern');
        const adText = document.querySelector('.ytp-ad-text, .videoAdUiAttribution, .ytp-ad-preview-text');
        const adDisplayContainer = document.querySelector('.ad-showing, .ytp-ad-overlay-container');

        const newAdPlaying = !!(adOverlay && (skipButton || adText || adDisplayContainer));

        console.log('Checking for ads:', { 
            adOverlay: !!adOverlay, 
            skipButton: !!skipButton, 
            adText: !!adText,
            adDisplayContainer: !!adDisplayContainer,
            newAdPlaying: newAdPlaying,
            currentAdPlayingState: isAdPlaying
        });

        if (newAdPlaying && !isAdPlaying) {
            isAdPlaying = true;
            adStartTime = Date.now();
            handleAdStart();
        } else if (!newAdPlaying && isAdPlaying) {
            isAdPlaying = false;
            handleAdEnd();
        }

        if (isAdPlaying && skipButton) {
            attemptSkipAd(skipButton);
        }

        // Reset error count on successful check
        errorCount = 0;
    } catch (error) {
        console.error('Error checking for YouTube ads:', error);
        handleExtensionError(error);
    }
}

function handleExtensionError(error) {
    console.log('Handling extension error:', error);
    errorCount++;

    if (errorCount >= MAX_ERRORS) {
        console.log('Max errors reached. Disabling ad detection temporarily.');
        stopAdDetection();
        setTimeout(() => {
            console.log('Attempting to re-enable ad detection');
            errorCount = 0;
            initAdDetection();
        }, ERROR_RESET_INTERVAL);
    } else if (error.message.includes('Extension context invalidated')) {
        console.log('Extension context invalidated. Reloading ad detection.');
        stopAdDetection();
        setTimeout(() => {
            initAdDetection();
        }, 1000);
    } else if (error.message.includes('Permission denied')) {
        console.log('Permission denied error. This may affect some functionality.');
    }
}

function handleAdStart() {
    if (!isAdMuterEnabled) return;
    
    console.log('Ad detected, attempting to mute tab');
    chrome.runtime.sendMessage({ action: 'muteTab' })
        .then(response => {
            if (response && response.success) {
                console.log('Tab muted successfully');
                isMuted = true;
            } else {
                console.log('Failed to mute tab:', response ? response.error : 'Unknown error');
                throw new Error('Failed to mute tab');
            }
        })
        .catch(error => {
            console.log('Error sending mute message:', error);
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
function updateMetrics() {
    const muteDuration = Math.round((Date.now() - adStartTime) / 1000);
    chrome.runtime.sendMessage({ 
        action: 'updateMetrics', 
        muteDuration: muteDuration
    }).catch(error => {
        console.error('Error updating metrics:', error);
        handleExtensionError(error);
    });
}

function attemptSkipAd(skipButton) {
    if (skipButton && skipButton.offsetParent !== null) {
        console.log('Skip button detected, attempting to skip');
        
        const skipMethods = [
            () => skipButton.click(),
            () => skipButton.dispatchEvent(new MouseEvent('click', { bubbles: true })),
            () => {
                const rect = skipButton.getBoundingClientRect();
                skipButton.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2
                }));
            }
        ];

        let attemptCount = 0;
        const maxAttempts = 5;

        function trySkip() {
            if (attemptCount >= maxAttempts) {
                console.log('Max skip attempts reached. Unable to skip ad.');
                return;
            }

            const method = skipMethods[attemptCount % skipMethods.length];
            try {
                method();
                console.log('Skip attempt made');
            } catch (error) {
                console.log('Error during skip attempt:', error);
                handleExtensionError(error);
            }

            // Check if ad is still playing after a short delay
            setTimeout(() => {
                if (document.querySelector('.ad-showing')) {
                    console.log('Ad still playing. Retrying skip...');
                    attemptCount++;
                    trySkip();
                } else {
                    console.log('Ad skipped successfully');
                }
            }, 500);
        }

        trySkip();
    }
}

function initAdDetection() {
    if (adObserver) {
        adObserver.disconnect();
    }
    adObserver = new MutationObserver(() => {
        checkForYouTubeAds();
    });
    const config = { childList: true, subtree: true };

    function observePlayer() {
        const playerContainer = document.querySelector('#player-container') || document.body;
        if (playerContainer) {
            console.log('Player container found, initializing ad detection');
            adObserver.observe(playerContainer, config);
        } else {
            console.log('Player container not found, will retry');
            setTimeout(observePlayer, 1000); // Retry after 1 second
        }
    }

    observePlayer();

    console.log('YouTube ad detection initialized');

    // Set up periodic checks
    setInterval(checkForYouTubeAds, 1000);
}

function stopAdDetection() {
    if (adObserver) {
        adObserver.disconnect();
        adObserver = null;
    }
    console.log('YouTube ad detection stopped');
}

// Initialize on load
chrome.storage.sync.get(['adMuterEnabled'], (result) => {
    isAdMuterEnabled = result.adMuterEnabled === true;
    if (isAdMuterEnabled) {
        initAdDetection();
    }
});

console.log('YouTube content script loaded');