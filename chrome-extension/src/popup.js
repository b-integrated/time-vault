// API URL
const API_URL = 'http://localhost:8080/api';

// DOM Elements
const userNameElement = document.getElementById('user-name');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const loginForm = document.getElementById('login-form');
const verifyForm = document.getElementById('verify-form');
const timeTracker = document.getElementById('time-tracker');
const authForm = document.getElementById('auth-form');
const verify2FAForm = document.getElementById('verify-2fa-form');
const projectSelect = document.getElementById('project');
const descriptionInput = document.getElementById('description');
const billableCheckbox = document.getElementById('billable');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const timerElement = document.getElementById('timer');
const recentEntriesList = document.getElementById('recent-entries-list');
const registerLink = document.getElementById('register-link');
const openDashboardLink = document.getElementById('open-dashboard');

// State
let isLoggedIn = false;
let isRegistering = false;
let currentUser = null;
let currentEmail = '';
let timerInterval = null;
let startTime = null;
let elapsedTime = 0;
let projects = [];
let timeEntries = [];

// Initialize
document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
  // Check if user is logged in
  chrome.storage.local.get(['token', 'user'], function(result) {
    if (result.token && result.user) {
      // Validate token
      fetch(`${API_URL}/auth/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${result.token}`
        }
      })
      .then(response => {
        if (response.ok) {
          // Token is valid
          currentUser = result.user;
          isLoggedIn = true;
          updateUI();
          loadProjects();
          loadRecentEntries();
        } else {
          // Token is invalid, clear storage
          chrome.storage.local.remove(['token', 'user']);
          showLoginForm();
        }
      })
      .catch(error => {
        console.error('Error validating token:', error);
        showLoginForm();
      });
    } else {
      showLoginForm();
    }
  });

  // Check if timer is running
  chrome.storage.local.get(['timerRunning', 'startTime', 'elapsedTime', 'currentProject', 'currentDescription', 'currentBillable'], function(result) {
    if (result.timerRunning) {
      startTime = new Date(result.startTime);
      elapsedTime = result.elapsedTime || 0;
      
      if (result.currentProject) {
        projectSelect.value = result.currentProject;
      }
      
      if (result.currentDescription) {
        descriptionInput.value = result.currentDescription;
      }
      
      if (result.currentBillable !== undefined) {
        billableCheckbox.checked = result.currentBillable;
      }
      
      startTimer();
    }
  });

  // Event Listeners
  loginButton.addEventListener('click', showLoginForm);
  logoutButton.addEventListener('click', logout);
  authForm.addEventListener('submit', handleAuth);
  verify2FAForm.addEventListener('submit', verify2FA);
  registerLink.addEventListener('click', toggleRegisterMode);
  startButton.addEventListener('click', startTracking);
  stopButton.addEventListener('click', stopTracking);
  openDashboardLink.addEventListener('click', openDashboard);
}

// UI Functions
function updateUI() {
  if (isLoggedIn && currentUser) {
    userNameElement.textContent = currentUser.name;
    loginButton.style.display = 'none';
    logoutButton.style.display = 'block';
    loginForm.style.display = 'none';
    verifyForm.style.display = 'none';
    timeTracker.style.display = 'block';
  } else {
    userNameElement.textContent = 'Not logged in';
    loginButton.style.display = 'block';
    logoutButton.style.display = 'none';
    timeTracker.style.display = 'none';
  }
}

function showLoginForm() {
  loginForm.style.display = 'block';
  verifyForm.style.display = 'none';
  timeTracker.style.display = 'none';
  
  // Reset form
  authForm.reset();
  
  // Update UI based on mode
  const submitButton = authForm.querySelector('button[type="submit"]');
  const formTitle = loginForm.querySelector('h2');
  
  if (isRegistering) {
    formTitle.textContent = 'Register';
    submitButton.textContent = 'Register';
    registerLink.textContent = 'Back to Login';
  } else {
    formTitle.textContent = 'Login';
    submitButton.textContent = 'Login';
    registerLink.textContent = 'Register';
  }
}

function showVerifyForm() {
  loginForm.style.display = 'none';
  verifyForm.style.display = 'block';
  timeTracker.style.display = 'none';
  
  // Reset form
  verify2FAForm.reset();
}

function toggleRegisterMode(e) {
  e.preventDefault();
  isRegistering = !isRegistering;
  showLoginForm();
}

// Authentication Functions
function handleAuth(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  
  currentEmail = email;
  
  const endpoint = isRegistering ? `${API_URL}/auth/register` : `${API_URL}/auth/login`;
  
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, name: email.split('@')[0] })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Authentication failed');
    }
    return response.json();
  })
  .then(data => {
    // Show 2FA verification form
    showVerifyForm();
  })
  .catch(error => {
    console.error('Error during authentication:', error);
    alert('Authentication failed. Please try again.');
  });
}

function verify2FA(e) {
  e.preventDefault();
  
  const code = document.getElementById('code').value;
  
  fetch(`${API_URL}/auth/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email: currentEmail, code })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Verification failed');
    }
    return response.json();
  })
  .then(data => {
    // Save token and user data
    chrome.storage.local.set({
      token: data.token,
      user: data.user
    });
    
    currentUser = data.user;
    isLoggedIn = true;
    
    // Update UI
    updateUI();
    loadProjects();
    loadRecentEntries();
  })
  .catch(error => {
    console.error('Error during verification:', error);
    alert('Verification failed. Please try again.');
  });
}

function logout() {
  // Clear storage
  chrome.storage.local.remove(['token', 'user']);
  
  // Stop timer if running
  if (timerInterval) {
    stopTracking();
  }
  
  // Reset state
  isLoggedIn = false;
  currentUser = null;
  
  // Update UI
  updateUI();
  showLoginForm();
}

// Project Functions
function loadProjects() {
  chrome.storage.local.get(['token'], function(result) {
    if (!result.token) return;
    
    fetch(`${API_URL}/projects`, {
      headers: {
        'Authorization': `Bearer ${result.token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load projects');
      }
      return response.json();
    })
    .then(data => {
      projects = data;
      
      // Clear select options
      projectSelect.innerHTML = '<option value="">Select a project</option>';
      
      // Add projects to select
      projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        projectSelect.appendChild(option);
      });
    })
    .catch(error => {
      console.error('Error loading projects:', error);
    });
  });
}

// Time Tracking Functions
function startTracking() {
  const projectId = projectSelect.value;
  const description = descriptionInput.value;
  
  if (!projectId) {
    alert('Please select a project');
    return;
  }
  
  startTime = new Date();
  elapsedTime = 0;
  
  // Save state
  chrome.storage.local.set({
    timerRunning: true,
    startTime: startTime.toISOString(),
    elapsedTime: elapsedTime,
    currentProject: projectId,
    currentDescription: description,
    currentBillable: billableCheckbox.checked
  });
  
  // Update UI
  startButton.disabled = true;
  stopButton.disabled = false;
  projectSelect.disabled = true;
  
  // Start timer
  startTimer();
}

function stopTracking() {
  // Stop timer
  clearInterval(timerInterval);
  timerInterval = null;
  
  // Calculate final duration
  const endTime = new Date();
  const duration = Math.floor((endTime - startTime) / 1000) + elapsedTime;
  
  // Create time entry
  const timeEntry = {
    projectId: parseInt(projectSelect.value),
    description: descriptionInput.value,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: duration,
    billable: billableCheckbox.checked
  };
  
  // Save time entry
  saveTimeEntry(timeEntry);
  
  // Reset state
  chrome.storage.local.remove(['timerRunning', 'startTime', 'elapsedTime', 'currentProject', 'currentDescription', 'currentBillable']);
  
  // Update UI
  startButton.disabled = false;
  stopButton.disabled = true;
  projectSelect.disabled = false;
  timerElement.textContent = '00:00:00';
  
  // Reset form
  projectSelect.value = '';
  descriptionInput.value = '';
}

function startTimer() {
  timerInterval = setInterval(updateTimer, 1000);
  updateTimer(); // Update immediately
}

function updateTimer() {
  const now = new Date();
  const totalSeconds = Math.floor((now - startTime) / 1000) + elapsedTime;
  
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  
  timerElement.textContent = `${hours}:${minutes}:${seconds}`;
}

function saveTimeEntry(timeEntry) {
  chrome.storage.local.get(['token', 'user'], function(result) {
    if (!result.token || !result.user) return;
    
    // Add user ID
    timeEntry.userId = result.user.id;
    
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
      // Add to recent entries
      timeEntries.unshift(data);
      updateRecentEntries();
    })
    .catch(error => {
      console.error('Error saving time entry:', error);
      alert('Failed to save time entry. Please try again.');
    });
  });
}

// Recent Entries Functions
function loadRecentEntries() {
  chrome.storage.local.get(['token', 'user'], function(result) {
    if (!result.token || !result.user) return;
    
    fetch(`${API_URL}/users/${result.user.id}/time-entries`, {
      headers: {
        'Authorization': `Bearer ${result.token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to load time entries');
      }
      return response.json();
    })
    .then(data => {
      timeEntries = data;
      updateRecentEntries();
    })
    .catch(error => {
      console.error('Error loading time entries:', error);
    });
  });
}

function updateRecentEntries() {
  // Clear list
  recentEntriesList.innerHTML = '';
  
  // Add recent entries (limit to 5)
  const recentEntries = timeEntries.slice(0, 5);
  
  if (recentEntries.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No recent entries';
    recentEntriesList.appendChild(li);
    return;
  }
  
  recentEntries.forEach(entry => {
    const li = document.createElement('li');
    
    // Find project name
    const project = projects.find(p => p.id === entry.projectId);
    const projectName = project ? project.name : 'Unknown Project';
    
    // Format duration
    const hours = Math.floor(entry.duration / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((entry.duration % 3600) / 60).toString().padStart(2, '0');
    
    // Format date
    const date = new Date(entry.startTime);
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    
    li.innerHTML = `
      <strong>${projectName}</strong> - ${hours}:${minutes}<br>
      <small>${entry.description || 'No description'} (${formattedDate})</small>
    `;
    
    recentEntriesList.appendChild(li);
  });
}

// Dashboard Function
function openDashboard() {
  chrome.tabs.create({ url: 'http://localhost:3000' });
}