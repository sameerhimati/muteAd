let adObserver = null;
let isAdMuterEnabled = false;
let isMuted = false;
let isAdPlaying = false;
let adStartTime = 0;
let consecutiveAdChecks = 0;
const AD_CHECK_THRESHOLD = 3;
const AD_CHECK_INTERVAL = 500;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 2000; // 2 seconds

function checkForHBOMaxAds() {
    if (!isAdMuterEnabled) return;

    try {
        const adDetected = checkVisualAdMarkers() || 
                           checkPlayerStateChanges() || 
                           checkAudioLevels();

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

        console.log('HBO Max ad check:', { adDetected, consecutiveAdChecks, isAdPlaying });
        reconnectAttempts = 0; // Reset reconnect attempts on successful check
    } catch (error) {
        console.error('Error checking for HBO Max ads:', error);
        handleExtensionError(error);
    }
}

function checkVisualAdMarkers() {
    const adMarkers = [
        '.ad-container', '.ad-overlay', '.ad-banner',
        '[data-testid="ad-overlay"]', '[data-testid="ad-banner"]',
        '.player-ad-overlay', '.ad-pause-card'
    ];
    return adMarkers.some(marker => document.querySelector(marker));
}

function checkPlayerStateChanges() {
    const player = document.querySelector('video');
    if (player) {
        // Implement HBO Max-specific player state checks
        // This is a placeholder and should be adjusted based on HBO Max's player behavior
    }
    return false;
}

function checkAudioLevels() {
    // Implement HBO Max-specific audio level checks if possible
    return false;
}

function handleAdStart() {
    console.log('HBO Max ad detected, attempting to mute tab');
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
    console.log('HBO Max ad ended, attempting to unmute tab');
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

function initAdDetection() {
    if (adObserver) {
        adObserver.disconnect();
    }
    adObserver = new MutationObserver(() => {
        checkForHBOMaxAds();
    });
    const config = { childList: true, subtree: true, attributes: true, characterData: true };

    function observePlayer() {
        const playerContainer = document.querySelector('.video-player') || document.body;
        if (playerContainer) {
            console.log('Player container found, initializing ad detection');
            adObserver.observe(playerContainer, config);
            setInterval(checkForHBOMaxAds, AD_CHECK_INTERVAL);
        } else {
            console.log('Player container not found, will retry');
            setTimeout(observePlayer, 1000); // Retry after 1 second
        }
    }

    observePlayer();
    console.log('HBO Max ad detection initialized');
}

function stopAdDetection() {
    if (adObserver) {
        adObserver.disconnect();
        adObserver = null;
    }
    console.log('HBO Max ad detection stopped');
}

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}

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

console.log('HBO Max content script loaded');