function updateMetricsDisplay() {
    chrome.runtime.sendMessage({ action: "getMetrics" }, (response) => {
      if (response) {
        document.getElementById('adsMuted').textContent = response.adsMuted;
        document.getElementById('timeSaved').textContent = response.timeSaved;
      }
    });
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('enableAdMuter');
    const supportButton = document.getElementById('supportButton');
  
    chrome.storage.sync.get('adMuterEnabled', (data) => {
      checkbox.checked = data.adMuterEnabled;
    });
  
    checkbox.addEventListener('change', (event) => {
      chrome.storage.sync.set({ adMuterEnabled: event.target.checked });
    });
  
  
    supportButton.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/sameerhimati/mute-ad/issues' });
    });
  
    updateMetricsDisplay();

  // Update metrics display every 5 seconds while popup is open
  setInterval(updateMetricsDisplay, 5000);
});