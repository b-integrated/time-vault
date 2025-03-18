// Content script for TimeVault Chrome extension

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPageInfo') {
    // Get current page information
    const pageInfo = {
      title: document.title,
      url: window.location.href,
      domain: window.location.hostname
    };
    
    sendResponse(pageInfo);
  }
});

// Function to check if the current page is a project management tool
function detectProjectManagementTool() {
  const url = window.location.href.toLowerCase();
  const domain = window.location.hostname.toLowerCase();
  
  // Check for common project management tools
  const tools = {
    'github.com': {
      name: 'GitHub',
      projectRegex: /github\.com\/[^\/]+\/[^\/]+\/issues\/\d+/,
      getProjectInfo: function() {
        const parts = window.location.pathname.split('/');
        return {
          owner: parts[1],
          repo: parts[2],
          issueNumber: parts[4],
          issueTitle: document.querySelector('.js-issue-title')?.textContent.trim() || document.title
        };
      }
    },
    'trello.com': {
      name: 'Trello',
      projectRegex: /trello\.com\/c\//,
      getProjectInfo: function() {
        return {
          board: document.querySelector('.board-header-btn-text')?.textContent.trim(),
          card: document.querySelector('.js-card-detail-title-input')?.value || document.title
        };
      }
    },
    'asana.com': {
      name: 'Asana',
      projectRegex: /app\.asana\.com\//,
      getProjectInfo: function() {
        return {
          project: document.querySelector('.ProjectPageHeader-projectName')?.textContent.trim(),
          task: document.querySelector('.TaskName textarea')?.value || document.title
        };
      }
    },
    'jira': {
      name: 'Jira',
      projectRegex: /\/browse\/[A-Z]+-\d+/,
      getProjectInfo: function() {
        const issueKey = document.querySelector('#key-val')?.textContent.trim();
        return {
          project: issueKey?.split('-')[0],
          issue: issueKey,
          summary: document.querySelector('#summary-val')?.textContent.trim() || document.title
        };
      }
    }
  };
  
  // Check if current site matches any known tool
  for (const [key, tool] of Object.entries(tools)) {
    if (domain.includes(key) || url.includes(key)) {
      if (tool.projectRegex.test(url)) {
        const info = tool.getProjectInfo();
        return {
          tool: tool.name,
          detected: true,
          info: info
        };
      }
    }
  }
  
  return {
    detected: false,
    url: url,
    title: document.title
  };
}

// Check for project management tools when page loads
const projectInfo = detectProjectManagementTool();
if (projectInfo.detected) {
  // Send information to background script
  chrome.runtime.sendMessage({
    action: 'projectDetected',
    projectInfo: projectInfo
  });
  
  // Add a small notification to the page
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.bottom = '20px';
  notification.style.right = '20px';
  notification.style.padding = '10px 15px';
  notification.style.backgroundColor = '#4a86e8';
  notification.style.color = 'white';
  notification.style.borderRadius = '4px';
  notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
  notification.style.zIndex = '9999';
  notification.style.fontSize = '14px';
  notification.style.fontFamily = 'Arial, sans-serif';
  notification.style.cursor = 'pointer';
  notification.innerHTML = `
    <div style="display: flex; align-items: center;">
      <span style="margin-right: 10px;">Track time for this ${projectInfo.tool} task</span>
      <button id="tv-track-btn" style="background: white; color: #4a86e8; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Track</button>
    </div>
  `;
  
  // Add to page
  document.body.appendChild(notification);
  
  // Add click handler
  document.getElementById('tv-track-btn').addEventListener('click', function() {
    chrome.runtime.sendMessage({
      action: 'startTrackingFromPage',
      projectInfo: projectInfo
    });
    
    // Update notification
    notification.innerHTML = `
      <div style="display: flex; align-items: center;">
        <span style="margin-right: 10px;">TimeVault is tracking this task</span>
        <button id="tv-stop-btn" style="background: white; color: #4a86e8; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Stop</button>
      </div>
    `;
    
    // Add stop handler
    document.getElementById('tv-stop-btn').addEventListener('click', function() {
      chrome.runtime.sendMessage({
        action: 'stopTrackingFromPage'
      });
      
      // Remove notification
      document.body.removeChild(notification);
    });
  });
  
  // Auto-hide after 10 seconds
  setTimeout(function() {
    if (document.body.contains(notification)) {
      notification.style.opacity = '0.7';
    }
  }, 10000);
}