import React, { useState, useEffect } from 'react';
import { Moon, Sun, VolumeX, Clock } from 'lucide-react';

const PopupApp = () => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [metrics, setMetrics] = useState({ adsMuted: 0, timeSaved: '0s' });

  useEffect(() => {
    loadData();
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const loadData = () => {
    chrome.storage.sync.get(['adMuterEnabled', 'adsMuted', 'secondsSaved'], (result) => {
      setIsEnabled(result.adMuterEnabled !== undefined ? result.adMuterEnabled : true);
      setMetrics({
        adsMuted: result.adsMuted || 0,
        timeSaved: formatTime(result.secondsSaved || 0)
      });
    });
  };

  const handleStorageChange = (changes, namespace) => {
    if (namespace === 'sync') {
      for (let key in changes) {
        if (key === 'adMuterEnabled') {
          setIsEnabled(changes[key].newValue);
        } else if (key === 'adsMuted' || key === 'secondsSaved') {
          loadData();
        }
      }
    }
  };

  const toggleAdMuter = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    chrome.storage.sync.set({ adMuterEnabled: newState }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving ad muter state:', chrome.runtime.lastError);
        setIsEnabled(!newState);
      }
    });
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
    return `${remainingSeconds}s`;
  };

  return (
    <div className="w-80 h-[420px] p-6 bg-dark-900 text-gray-100">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-100">Ad Mute by Fend.ai</h1>
      </div>

      <div className="flex items-center justify-between mb-8">
        <span className="text-lg font-medium text-gray-300">Mute Ads</span>
        <button
          onClick={toggleAdMuter}
          className={`px-4 py-2 rounded-md transition-colors duration-300 focus:outline-none ${
            isEnabled ? 'bg-red-500 hover:bg-red-600 text-white'  : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>

      <div className="space-y-6 mb-8">
        <div className="flex items-center justify-between p-4 bg-dark-800 rounded-xl">
          <div className="flex items-center">
            <VolumeX size={24} className="mr-3 text-accent-400" />
            <span className="text-base font-medium text-gray-200">Ads Muted</span>
          </div>
          <span className="text-xl font-semibold text-gray-100">{metrics.adsMuted}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-dark-800 rounded-xl">
          <div className="flex items-center">
            <Clock size={24} className="mr-3 text-accent-400" />
            <span className="text-base font-medium text-gray-200">Time Saved</span>
          </div>
          <span className="text-xl font-semibold text-gray-100">{metrics.timeSaved}</span>
        </div>
      </div>

      <button
        onClick={() => chrome.tabs.create({ url: 'https://github.com/sameerhimati/muteAd/issues' })}
        className="w-full py-3 px-4 bg-gradient-to-r from-accent-600 to-accent-500 text-gray-100 rounded-xl shadow-lg hover:from-accent-700 hover:to-accent-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:ring-offset-dark-900 text-sm font-medium"
      >
        Support this extension
      </button>
    </div>
  );
};

export default PopupApp;