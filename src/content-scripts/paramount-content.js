let adObserver = null;
let isAdMuterEnabled = false;
let isMuted = false;
let isAdPlaying = false;
let adStartTime = 0;
let consecutiveAdChecks = 0;
const AD_CHECK_THRESHOLD = 2;
const AD_CHECK_INTERVAL = 250; // milliseconds
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 2000; // milliseconds

function checkForParamountAds() {
    if (!isAdMuterEnabled) return;

    try {
        const adIframeActive = checkAdIframeState();
        const adClickElementVisible = checkAdClickElementVisibility();
        const adContainerActive = checkAdContainerState();
        const adCountdown = checkForAdCountdown();
        const visualMarkers = checkVisualAdMarkers();

        const adDetected = adIframeActive || adClickElementVisible || adContainerActive ||
                           (adCountdown && visualMarkers);

        console.log('Ad detection results:', {
            adIframeActive, adClickElementVisible, adContainerActive, adCountdown, visualMarkers
        });

        if (adDetected) {
            consecutiveAdChecks++;
            console.log(`Ad detected, consecutive checks: ${consecutiveAdChecks}`);
            if (consecutiveAdChecks >= AD_CHECK_THRESHOLD && !isAdPlaying) {
                isAdPlaying = true;
                adStartTime = Date.now();
                handleAdStart();
            }
        } else {
            if (isAdPlaying) {
                handleAdEnd();
            }
            consecutiveAdChecks = 0;
            isAdPlaying = false;
        }

        console.log('Paramount+ ad check:', { adDetected, consecutiveAdChecks, isAdPlaying });
        reconnectAttempts = 0;
    } catch (error) {
        console.error('Error checking for Paramount+ ads:', error);
        handleExtensionError(error);
    }
}

function checkAdIframeState() {
    const adIframe = document.querySelector('iframe[src*="imasdk.googleapis.com"]');
    if (adIframe) {
        const style = window.getComputedStyle(adIframe);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }
    return false;
}

function checkAdClickElementVisibility() {
    const adClickEl = document.querySelector('[data-role="adClickEl"]');
    if (adClickEl) {
        const style = window.getComputedStyle(adClickEl);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }
    return false;
}

function checkAdContainerState() {
    const adContainer = document.querySelector('[data-role="adContainer"]');
    if (adContainer) {
        const style = window.getComputedStyle(adContainer);
        return style.display !== 'none' && adContainer.innerHTML.trim() !== '';
    }
    return false;
}

function checkForAdCountdown() {
    const adCountdownElement = document.querySelector('.ad-info-manager-circular-loader-copy');
    if (adCountdownElement && adCountdownElement.offsetParent !== null) {
        const countdownValue = parseInt(adCountdownElement.textContent);
        if (!isNaN(countdownValue) && countdownValue > 0) {
            console.log('Ad countdown found:', countdownValue);
            return true;
        }
    }
    return false;
}

function checkVisualAdMarkers() {
    const adMarkers = [
        '.ad-container',
        '.ad-overlay',
        '.ad-banner',
        '[data-testid="ad-overlay"]',
        '[data-testid="ad-banner"]',
        '.video-player__overlay--ad-playing',
        '.ad-persistent-player',
        '.ad-ui-view',
        '[data-purpose="ad-banner"]',
        '[data-purpose="ad-container"]',
        '.ad-player-overlay',
        '.ad-playback-progress',
        '.video-ad-overlay'
    ];
    return adMarkers.some(marker => {
        const element = document.querySelector(marker);
        if (element) {
            const style = window.getComputedStyle(element);
            return style.display !== 'none' && style.visibility !== 'hidden' && element.innerHTML.trim() !== '';
        }
        return false;
    });
}

function handleAdStart() {
    console.log('Paramount+ ad detected, attempting to mute tab');
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
    if (!isMuted) return; // Prevent unnecessary unmuting

    console.log('Paramount+ ad ended, attempting to unmute tab');
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
        checkForParamountAds();
    });
    const config = { childList: true, subtree: true, attributes: true, characterData: true };

    function observePlayer() {
        const playerContainer = document.querySelector('#video-player') || document.body;
        if (playerContainer) {
            console.log('Player container found, initializing ad detection');
            adObserver.observe(playerContainer, config);
            setInterval(checkForParamountAds, AD_CHECK_INTERVAL);
        } else {
            console.log('Player container not found, will retry');
            setTimeout(observePlayer, 1000); // Retry after 1 second
        }
    }

    observePlayer();
    console.log('Paramount+ ad detection initialized');
}

function stopAdDetection() {
    if (adObserver) {
        adObserver.disconnect();
        adObserver = null;
    }
    console.log('Paramount+ ad detection stopped');
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

console.log('Paramount+ content script loaded');