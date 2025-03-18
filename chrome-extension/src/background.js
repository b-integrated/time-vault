// Background script for TimeVault Chrome extension

// Listen for installation
chrome.runtime.onInstalled.addListener(function() {
  console.log('TimeVault extension installed');
});

// Set up alarm for periodic sync
chrome.alarms.create('syncData', { periodInMinutes: 5 });

// Listen for alarm
chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name === 'syncData') {
    syncTimeEntries();
  }
});

// Sync time entries with the server
function syncTimeEntries() {
  chrome.storage.local.get(['token', 'pendingTimeEntries'], function(result) {
    if (!result.token || !result.pendingTimeEntries || result.pendingTimeEntries.length === 0) {
      return;
    }

    const API_URL = 'http://localhost:8080/api';
    
    // Try to sync each pending time entry
    const pendingEntries = result.pendingTimeEntries;
    const promises = pendingEntries.map(entry => {
      return fetch(`${API_URL}/time-entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.token}`
        },
        body: JSON.stringify(entry)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to sync time entry');
        }
        return response.json();
      })
      .then(data => {
        // Return the ID of the successfully synced entry
        return entry.localId;
      })
      .catch(error => {
        console.error('Error syncing time entry:', error);
        // Return null to indicate failure
        return null;
      });
    });

    // Process results
    Promise.all(promises)
      .then(results => {
        // Filter out successfully synced entries
        const successfulIds = results.filter(id => id !== null);
        const newPendingEntries = pendingEntries.filter(entry => 
          !successfulIds.includes(entry.localId)
        );

        // Update storage
        chrome.storage.local.set({ pendingTimeEntries: newPendingEntries });
      });
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'startTimer') {
    // Start timer tracking in background
    chrome.storage.local.set({
      timerRunning: true,
      startTime: request.startTime,
      elapsedTime: request.elapsedTime || 0,
      currentProject: request.projectId,
      currentDescription: request.description,
      currentBillable: request.billable
    });
    
    sendResponse({ success: true });
  }
  else if (request.action === 'stopTimer') {
    // Stop timer and save time entry
    chrome.storage.local.get(['timerRunning', 'startTime', 'elapsedTime', 'currentProject', 'currentDescription', 'currentBillable', 'user', 'token', 'pendingTimeEntries'], function(result) {
      if (!result.timerRunning) {
        sendResponse({ success: false, error: 'Timer not running' });
        return;
      }
      
      // Calculate duration
      const startTime = new Date(result.startTime);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000) + (result.elapsedTime || 0);
      
      // Create time entry
      const timeEntry = {
        localId: Date.now().toString(), // Local ID for tracking sync status
        userId: result.user ? result.user.id : null,
        projectId: parseInt(result.currentProject),
        description: result.currentDescription || '',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        billable: result.currentBillable !== undefined ? result.currentBillable : true
      };
      
      // Try to save directly if online
      if (navigator.onLine && result.token && result.user) {
        const API_URL = 'http://localhost:8080/api';
        
        fetch(`${API_URL}/time-entries`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${result.token}`
          },
          body: JSON.stringify(timeEntry)
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Failed to save time entry');
          }
          return response.json();
        })
        .then(data => {
          // Clear timer state
          chrome.storage.local.remove(['timerRunning', 'startTime', 'elapsedTime', 'currentProject', 'currentDescription', 'currentBillable']);
          
          sendResponse({ success: true, timeEntry: data });
        })
        .catch(error => {
          console.error('Error saving time entry:', error);
          
          // Store for later sync
          const pendingEntries = result.pendingTimeEntries || [];
          pendingEntries.push(timeEntry);
          
          chrome.storage.local.set({ pendingTimeEntries: pendingEntries });
          chrome.storage.local.remove(['timerRunning', 'startTime', 'elapsedTime', 'currentProject', 'currentDescription', 'currentBillable']);
          
          sendResponse({ success: true, timeEntry: timeEntry, offline: true });
        });
        
        return true; // Indicates async response
      } else {
        // Store for later sync
        const pendingEntries = result.pendingTimeEntries || [];
        pendingEntries.push(timeEntry);
        
        chrome.storage.local.set({ pendingTimeEntries: pendingEntries });
        chrome.storage.local.remove(['timerRunning', 'startTime', 'elapsedTime', 'currentProject', 'currentDescription', 'currentBillable']);
        
        sendResponse({ success: true, timeEntry: timeEntry, offline: true });
      }
    });
    
    return true; // Indicates async response
  }
  else if (request.action === 'getTimerStatus') {
    // Get current timer status
    chrome.storage.local.get(['timerRunning', 'startTime', 'elapsedTime', 'currentProject', 'currentDescription', 'currentBillable'], function(result) {
      sendResponse({
        running: result.timerRunning || false,
        startTime: result.startTime,
        elapsedTime: result.elapsedTime || 0,
        projectId: result.currentProject,
        description: result.currentDescription,
        billable: result.currentBillable
      });
    });
    
    return true; // Indicates async response
  }
  else if (request.action === 'syncNow') {
    // Manually trigger sync
    syncTimeEntries();
    sendResponse({ success: true });
  }
});

// Listen for connectivity changes
window.addEventListener('online', function() {
  console.log('Online, syncing data...');
  syncTimeEntries();
});