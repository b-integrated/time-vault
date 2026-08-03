// TimeTracker component for tracking time

function TimeTracker({ user }) {
  // State for form data
  const [projectId, setProjectId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [billable, setBillable] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState(formatDateForInput(new Date()));
  
  // State for timer
  const [isRunning, setIsRunning] = React.useState(false);
  const [startTime, setStartTime] = React.useState(null);
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [timerInterval, setTimerInterval] = React.useState(null);
  
  // State for data
  const [projects, setProjects] = React.useState([]);
  const [timeEntries, setTimeEntries] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  
  // API URL
  const API_URL = '/api';

  const handleApiResponse = (response, message) => {
    if (response.status === 401 && window.handleUnauthorized) {
      window.handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error(message);
    }
    return response.json();
  };
  
  // Fetch projects and time entries on component mount
  React.useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Fetch projects
    fetch(`${API_URL}/projects`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => handleApiResponse(response, 'Failed to fetch projects'))
    .then(data => {
      setProjects(data);
      
      // Fetch time entries
      return fetch(`${API_URL}/users/${user.id}/time-entries`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    })
    .then(response => handleApiResponse(response, 'Failed to fetch time entries'))
    .then(data => {
      // Sort time entries by start time (newest first)
      const sortedEntries = data.sort((a, b) => 
        new Date(b.startTime) - new Date(a.startTime)
      );
      
      setTimeEntries(sortedEntries);
      setIsLoading(false);
    })
    .catch(error => {
      if (error.message === 'Unauthorized') return;
      console.error('Error fetching data:', error);
      setError('Failed to load data');
      setIsLoading(false);
    });
    
    // Check if timer is already running in localStorage
    const storedStartTime = localStorage.getItem('timerStartTime');
    const storedProjectId = localStorage.getItem('timerProjectId');
    const storedDescription = localStorage.getItem('timerDescription');
    const storedBillable = localStorage.getItem('timerBillable');
    
    if (storedStartTime) {
      const startTime = new Date(storedStartTime);
      const now = new Date();
      const elapsed = Math.floor((now - startTime) / 1000);
      
      setStartTime(startTime);
      setElapsedTime(elapsed);
      setIsRunning(true);
      
      if (storedProjectId) setProjectId(storedProjectId);
      if (storedDescription) setDescription(storedDescription);
      if (storedBillable !== null) setBillable(storedBillable === 'true');
      
      // Start timer
      const interval = setInterval(updateTimer, 1000);
      setTimerInterval(interval);
    }
    
    // Cleanup interval on unmount
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [user.id]);
  
  // Update timer
  const updateTimer = () => {
    if (!startTime) return;
    
    const now = new Date();
    const elapsed = Math.floor((now - startTime) / 1000);
    setElapsedTime(elapsed);
  };
  
  // Format time
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${secs}`;
  };
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  function formatDateForInput(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  const formatSelectedDate = (dateString) => {
    const date = new Date(`${dateString}T12:00:00`);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
  };
  
  // Format duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };
  
  // Get project name by ID
  const getProjectName = (id) => {
    const project = projects.find(p => p.id === id);
    return project ? project.name : 'Unknown Project';
  };

  const shiftSelectedDate = (days) => {
    const nextDate = new Date(`${selectedDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + days);
    setSelectedDate(formatDateForInput(nextDate));
  };
  
  // Start timer
  const startTimer = () => {
    // Validate form
    if (!projectId) {
      setError('Please select a project');
      return;
    }
    
    // Set start time
    const now = new Date();
    setStartTime(now);
    setElapsedTime(0);
    setIsRunning(true);
    
    // Store timer state in localStorage
    localStorage.setItem('timerStartTime', now.toISOString());
    localStorage.setItem('timerProjectId', projectId);
    localStorage.setItem('timerDescription', description);
    localStorage.setItem('timerBillable', billable.toString());
    
    // Start interval
    const interval = setInterval(updateTimer, 1000);
    setTimerInterval(interval);
    
    // Clear error
    setError('');
  };
  
  // Stop timer
  const stopTimer = () => {
    // Clear interval
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    
    // Calculate duration
    const now = new Date();
    const duration = Math.floor((now - startTime) / 1000);
    
    // Create time entry
    const timeEntry = {
      userId: user.id,
      projectId: parseInt(projectId),
      description: description,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      duration: duration,
      billable: billable
    };
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Save time entry
    fetch(`${API_URL}/time-entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
      // Add new time entry to list
      setTimeEntries([data, ...timeEntries]);
      setSelectedDate(formatDateForInput(startTime));
      
      // Reset form
      setProjectId('');
      setDescription('');
      setBillable(true);
      
      // Reset timer
      setStartTime(null);
      setElapsedTime(0);
      setIsRunning(false);
      
      // Clear localStorage
      localStorage.removeItem('timerStartTime');
      localStorage.removeItem('timerProjectId');
      localStorage.removeItem('timerDescription');
      localStorage.removeItem('timerBillable');
    })
    .catch(error => {
      console.error('Error saving time entry:', error);
      setError('Failed to save time entry');
    });
  };
  
  // Render loading state
  if (isLoading) {
    return React.createElement('div', { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading time tracker...')
    );
  }

  const selectedEntries = timeEntries.filter(entry => 
    formatDateForInput(new Date(entry.startTime)) === selectedDate
  );
  const selectedDuration = selectedEntries.reduce((total, entry) => total + entry.duration, 0);
  const selectedBillableDuration = selectedEntries
    .filter(entry => entry.billable)
    .reduce((total, entry) => total + entry.duration, 0);
  
  // Render time tracker
  return React.createElement('div', { className: 'time-tracker' },
    React.createElement('h1', null, 'Time Tracker'),
    
    // Error message
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    
    // Timer display
    React.createElement('div', { className: 'timer-display' },
      formatTime(elapsedTime)
    ),
    
    // Time entry form
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', null,
          // Project select
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'project', className: 'form-label' }, 'Project'),
            React.createElement('select', {
              id: 'project',
              className: 'form-control',
              value: projectId,
              onChange: (e) => setProjectId(e.target.value),
              disabled: isRunning
            },
              React.createElement('option', { value: '' }, 'Select a project'),
              projects.map(project => 
                React.createElement('option', { 
                  key: project.id, 
                  value: project.id 
                }, project.name)
              )
            )
          ),
          
          // Description
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'description', className: 'form-label' }, 'Description'),
            React.createElement('textarea', {
              id: 'description',
              className: 'form-control',
              value: description,
              onChange: (e) => setDescription(e.target.value),
              disabled: isRunning,
              placeholder: 'What are you working on?',
              rows: 2
            })
          ),
          
          // Billable checkbox
          React.createElement('div', { className: 'form-group' },
            React.createElement('div', { className: 'form-check' },
              React.createElement('input', {
                id: 'billable',
                className: 'form-check-input',
                type: 'checkbox',
                checked: billable,
                onChange: (e) => setBillable(e.target.checked),
                disabled: isRunning
              }),
              React.createElement('label', { 
                htmlFor: 'billable', 
                className: 'form-check-label' 
              }, 'Billable')
            )
          ),
          
          // Timer controls
          React.createElement('div', { className: 'timer-controls' },
            !isRunning
              ? React.createElement('button', {
                  type: 'button',
                  className: 'btn btn-primary',
                  onClick: startTimer
                }, 'Start Timer')
              : React.createElement('button', {
                  type: 'button',
                  className: 'btn btn-danger',
                  onClick: stopTimer
                }, 'Stop Timer')
          )
        )
      )
    ),
    
    // Day selector
    React.createElement('section', { className: 'day-selector-card' },
      React.createElement('button', {
        type: 'button',
        className: 'btn btn-secondary day-nav-btn',
        onClick: () => shiftSelectedDate(-1),
        'aria-label': 'Previous day'
      }, React.createElement('i', { className: 'bi bi-chevron-left' })),
      React.createElement('div', { className: 'selected-day' },
        React.createElement('label', { htmlFor: 'selected-date', className: 'eyebrow' }, 'Selected Day'),
        React.createElement('input', {
          id: 'selected-date',
          className: 'form-control selected-day-input',
          type: 'date',
          value: selectedDate,
          onChange: (e) => setSelectedDate(e.target.value)
        }),
        React.createElement('div', { className: 'selected-day-label' }, formatSelectedDate(selectedDate))
      ),
      React.createElement('button', {
        type: 'button',
        className: 'btn btn-secondary day-nav-btn',
        onClick: () => shiftSelectedDate(1),
        'aria-label': 'Next day'
      }, React.createElement('i', { className: 'bi bi-chevron-right' }))
    ),

    React.createElement('div', { className: 'daily-summary' },
      React.createElement('div', { className: 'daily-summary-item' },
        React.createElement('span', null, 'Total'),
        React.createElement('strong', null, formatDuration(selectedDuration))
      ),
      React.createElement('div', { className: 'daily-summary-item' },
        React.createElement('span', null, 'Billable'),
        React.createElement('strong', null, formatDuration(selectedBillableDuration))
      ),
      React.createElement('div', { className: 'daily-summary-item' },
        React.createElement('span', null, 'Entries'),
        React.createElement('strong', null, selectedEntries.length)
      )
    ),

    // Selected day entries
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, formatSelectedDate(selectedDate))
      ),
      React.createElement('div', { className: 'card-body' },
        selectedEntries.length === 0
          ? React.createElement('p', { className: 'empty-day-message' }, 'No time entries for this day')
          : React.createElement('div', { className: 'entry-list day-entry-list' },
              selectedEntries.map(entry =>
                React.createElement('article', { className: 'entry-card', key: entry.id },
                  React.createElement('div', { className: 'entry-card-main' },
                    React.createElement('div', { className: 'entry-project' }, entry.project ? entry.project.name : getProjectName(entry.projectId)),
                    React.createElement('div', { className: 'entry-description' }, entry.description || 'No description')
                  ),
                  React.createElement('div', { className: 'entry-meta-stack' },
                    React.createElement('div', { className: 'entry-duration' }, formatDuration(entry.duration)),
                    React.createElement('div', { className: `entry-billable ${entry.billable ? 'is-billable' : 'is-nonbillable'}` }, entry.billable ? 'Billable' : 'No bill')
                  )
                )
              )
            )
      )
    )
  );
}

// Make TimeTracker component globally available
window.TimeTracker = TimeTracker;
