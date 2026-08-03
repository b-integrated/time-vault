// TimeTracker component for client/project/task based time tracking.

function TimeTracker({ user }) {
  const API_URL = '/api';

  const [clientId, setClientId] = React.useState('');
  const [projectId, setProjectId] = React.useState('');
  const [taskId, setTaskId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [billable, setBillable] = React.useState(true);
  const [newTaskName, setNewTaskName] = React.useState('');
  const [newTaskBillable, setNewTaskBillable] = React.useState(true);
  const [newTaskRate, setNewTaskRate] = React.useState('');
  const [selectedDate, setSelectedDate] = React.useState(formatDateForInput(new Date()));

  const [isRunning, setIsRunning] = React.useState(false);
  const [startTime, setStartTime] = React.useState(null);
  const [elapsedTime, setElapsedTime] = React.useState(0);
  const [timerInterval, setTimerInterval] = React.useState(null);

  const [clients, setClients] = React.useState([]);
  const [projects, setProjects] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
  const [timeEntries, setTimeEntries] = React.useState([]);
  const [editingEntryId, setEditingEntryId] = React.useState(null);
  const [editForm, setEditForm] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    Promise.all([
      fetch(`${API_URL}/clients`, authHeaders(token)).then(response => handleApiResponse(response, 'Failed to fetch clients')),
      fetch(`${API_URL}/projects`, authHeaders(token)).then(response => handleApiResponse(response, 'Failed to fetch projects')),
      fetch(`${API_URL}/tasks`, authHeaders(token)).then(response => handleApiResponse(response, 'Failed to fetch tasks')),
      fetch(`${API_URL}/users/${user.id}/time-entries`, authHeaders(token)).then(response => handleApiResponse(response, 'Failed to fetch time entries'))
    ])
    .then(([clientData, projectData, taskData, entryData]) => {
      setClients(clientData);
      setProjects(projectData);
      setTasks(taskData);
      setTimeEntries(sortEntries(entryData));
      setIsLoading(false);
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Error fetching time tracker data:', err);
      setError('Failed to load data');
      setIsLoading(false);
    });

    const storedStartTime = localStorage.getItem('timerStartTime');
    if (storedStartTime) {
      const restoredStart = new Date(storedStartTime);
      const elapsed = Math.floor((new Date() - restoredStart) / 1000);
      setStartTime(restoredStart);
      setElapsedTime(elapsed);
      setIsRunning(true);
      setClientId(localStorage.getItem('timerClientId') || '');
      setProjectId(localStorage.getItem('timerProjectId') || '');
      setTaskId(localStorage.getItem('timerTaskId') || '');
      setDescription(localStorage.getItem('timerDescription') || '');
      setBillable(localStorage.getItem('timerBillable') !== 'false');
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date() - restoredStart) / 1000));
      }, 1000);
      setTimerInterval(interval);
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [user.id]);

  React.useEffect(() => {
    if (!isRunning || !startTime) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((new Date() - startTime) / 1000));
    }, 1000);
    setTimerInterval(interval);
    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  function authHeaders(token) {
    return { headers: { 'Authorization': `Bearer ${token}` } };
  }

  function handleApiResponse(response, message) {
    if (response.status === 401 && window.handleUnauthorized) {
      window.handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!response.ok) throw new Error(message);
    return response.json();
  }

  function sortEntries(entries) {
    return [...entries].sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }

  function projectsForClient(value) {
    return projects.filter(project => !value || project.clientId === parseInt(value));
  }

  function tasksForProject(value) {
    return tasks.filter(task => !value || task.projectId === parseInt(value));
  }

  function findProject(value) {
    return projects.find(project => project.id === parseInt(value));
  }

  function findTask(value) {
    return tasks.find(task => task.id === parseInt(value));
  }

  function getEntryClientId(entry) {
    if (entry.project && entry.project.clientId) return entry.project.clientId.toString();
    const project = findProject(entry.projectId);
    return project ? project.clientId.toString() : '';
  }

  function getClientName(value) {
    const client = clients.find(item => item.id === parseInt(value));
    return client ? client.name : 'Unknown Client';
  }

  function getProjectName(value) {
    const project = findProject(value);
    return project ? project.name : 'Unknown Project';
  }

  function getTaskName(value) {
    const task = findTask(value);
    return task ? task.name : 'General';
  }

  function handleClientChange(value) {
    setClientId(value);
    setProjectId('');
    setTaskId('');
  }

  function handleProjectChange(value) {
    setProjectId(value);
    setTaskId('');
  }

  function handleTaskChange(value) {
    setTaskId(value);
    const task = findTask(value);
    if (task) setBillable(task.billable);
  }

  function createTask() {
    if (!projectId || !newTaskName.trim()) {
      setError('Choose a project and enter a task name');
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    const payload = {
      projectId: parseInt(projectId),
      name: newTaskName.trim(),
      billable: newTaskBillable,
      rate: parseFloat(newTaskRate) || 0,
      status: 'active'
    };
    fetch(`${API_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
    .then(response => handleApiResponse(response, 'Failed to create task'))
    .then(task => {
      setTasks([...tasks, task].sort((a, b) => a.name.localeCompare(b.name)));
      setTaskId(task.id.toString());
      setBillable(task.billable);
      setNewTaskName('');
      setNewTaskRate('');
      setNewTaskBillable(true);
      setError('');
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Error creating task:', err);
      setError('Failed to create task');
    });
  }

  function validateSelection(source) {
    if (!source.clientId || !source.projectId || !source.taskId) {
      setError('Client, project, and task are required');
      return false;
    }
    return true;
  }

  function startTimer() {
    if (!validateSelection({ clientId, projectId, taskId })) return;

    const now = new Date();
    setStartTime(now);
    setElapsedTime(0);
    setIsRunning(true);
    localStorage.setItem('timerStartTime', now.toISOString());
    localStorage.setItem('timerClientId', clientId);
    localStorage.setItem('timerProjectId', projectId);
    localStorage.setItem('timerTaskId', taskId);
    localStorage.setItem('timerDescription', description);
    localStorage.setItem('timerBillable', billable.toString());
    setError('');
  }

  function stopTimer() {
    if (!startTime) return;
    const now = new Date();
    const duration = Math.max(0, Math.floor((now - startTime) / 1000));
    saveTimeEntry({
      userId: user.id,
      projectId: parseInt(projectId),
      taskId: parseInt(taskId),
      description,
      startTime: startTime.toISOString(),
      endTime: now.toISOString(),
      duration,
      billable
    });
  }

  function saveTimeEntry(timeEntry) {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/time-entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(timeEntry)
    })
    .then(response => handleApiResponse(response, 'Failed to save time entry'))
    .then(data => {
      setTimeEntries(sortEntries([data, ...timeEntries]));
      setSelectedDate(formatDateForInput(startTime));
      setClientId('');
      setProjectId('');
      setTaskId('');
      setDescription('');
      setBillable(true);
      setStartTime(null);
      setElapsedTime(0);
      setIsRunning(false);
      localStorage.removeItem('timerStartTime');
      localStorage.removeItem('timerClientId');
      localStorage.removeItem('timerProjectId');
      localStorage.removeItem('timerTaskId');
      localStorage.removeItem('timerDescription');
      localStorage.removeItem('timerBillable');
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Error saving time entry:', err);
      setError('Failed to save time entry');
    });
  }

  function startEditing(entry) {
    const entryClientId = getEntryClientId(entry);
    const entryTaskId = entry.taskId || (entry.task && entry.task.id) || '';
    setEditingEntryId(entry.id);
    setEditForm({
      clientId: entryClientId,
      projectId: entry.projectId ? entry.projectId.toString() : '',
      taskId: entryTaskId ? entryTaskId.toString() : '',
      description: entry.description || '',
      date: formatDateForInput(new Date(entry.startTime)),
      startTime: formatTimeForInput(new Date(entry.startTime)),
      hours: decimalHours(entry.duration),
      billable: !!entry.billable
    });
    setError('');
  }

  function cancelEditing() {
    setEditingEntryId(null);
    setEditForm(null);
  }

  function updateEditForm(field, value) {
    const next = { ...editForm, [field]: value };
    if (field === 'clientId') {
      next.projectId = '';
      next.taskId = '';
    }
    if (field === 'projectId') {
      next.taskId = '';
    }
    if (field === 'taskId') {
      const task = findTask(value);
      if (task) next.billable = task.billable;
    }
    setEditForm(next);
  }

  function saveEditedEntry(entry) {
    if (!validateSelection(editForm)) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const hours = parseFloat(editForm.hours) || 0;
    const duration = Math.max(0, Math.round(hours * 3600));
    const start = new Date(`${editForm.date}T${editForm.startTime || '12:00'}:00`);
    const end = new Date(start.getTime() + duration * 1000);
    const payload = {
      userId: entry.userId,
      projectId: parseInt(editForm.projectId),
      taskId: parseInt(editForm.taskId),
      description: editForm.description,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      duration,
      billable: editForm.billable
    };

    fetch(`${API_URL}/time-entries/${entry.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
    .then(response => handleApiResponse(response, 'Failed to update time entry'))
    .then(data => {
      setTimeEntries(sortEntries(timeEntries.map(item => item.id === data.id ? data : item)));
      setSelectedDate(formatDateForInput(new Date(data.startTime)));
      cancelEditing();
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Error updating time entry:', err);
      setError('Failed to update time entry');
    });
  }

  function deleteEntry(entry) {
    if (!confirm('Delete this time entry?')) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/time-entries/${entry.id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
      if (response.status === 401 && window.handleUnauthorized) {
        window.handleUnauthorized();
        throw new Error('Unauthorized');
      }
      if (!response.ok) throw new Error('Failed to delete time entry');
      setTimeEntries(timeEntries.filter(item => item.id !== entry.id));
      if (editingEntryId === entry.id) cancelEditing();
    })
    .catch(err => {
      if (err.message === 'Unauthorized') return;
      console.error('Error deleting time entry:', err);
      setError('Failed to delete time entry');
    });
  }

  function shiftSelectedDate(days) {
    const nextDate = new Date(`${selectedDate}T12:00:00`);
    nextDate.setDate(nextDate.getDate() + days);
    setSelectedDate(formatDateForInput(nextDate));
  }

  function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
  }

  function formatDateForInput(date) {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  function formatTimeForInput(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function formatSelectedDate(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  function decimalHours(seconds) {
    return (Math.round((seconds / 3600) * 100) / 100).toFixed(2);
  }

  if (isLoading) {
    return React.createElement('div', { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading time tracker...')
    );
  }

  const selectedEntries = timeEntries.filter(entry => formatDateForInput(new Date(entry.startTime)) === selectedDate);
  const selectedDuration = selectedEntries.reduce((total, entry) => total + entry.duration, 0);
  const selectedBillableDuration = selectedEntries.filter(entry => entry.billable).reduce((total, entry) => total + entry.duration, 0);

  function renderClientSelect(value, onChange, disabled, id) {
    return React.createElement('select', {
      id,
      className: 'form-control',
      value,
      onChange: (e) => onChange(e.target.value),
      disabled
    },
      React.createElement('option', { value: '' }, 'Select a client'),
      clients.map(client => React.createElement('option', { key: client.id, value: client.id }, client.name))
    );
  }

  function renderProjectSelect(value, sourceClientId, onChange, disabled, id) {
    return React.createElement('select', {
      id,
      className: 'form-control',
      value,
      onChange: (e) => onChange(e.target.value),
      disabled: disabled || !sourceClientId
    },
      React.createElement('option', { value: '' }, 'Select a project'),
      projectsForClient(sourceClientId).map(project => React.createElement('option', { key: project.id, value: project.id }, project.name))
    );
  }

  function renderTaskSelect(value, sourceProjectId, onChange, disabled, id) {
    return React.createElement('select', {
      id,
      className: 'form-control',
      value,
      onChange: (e) => onChange(e.target.value),
      disabled: disabled || !sourceProjectId
    },
      React.createElement('option', { value: '' }, 'Select a task'),
      tasksForProject(sourceProjectId).map(task => React.createElement('option', { key: task.id, value: task.id },
        `${task.name}${task.billable ? '' : ' (non-billable)'}`
      ))
    );
  }

  return React.createElement('div', { className: 'time-tracker' },
    React.createElement('h1', null, 'Time Tracker'),
    error && React.createElement('div', { className: 'alert alert-danger' }, error),

    React.createElement('div', { className: 'timer-display' }, formatTime(elapsedTime)),

    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', null,
          React.createElement('div', { className: 'time-entry-grid' },
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', { htmlFor: 'client', className: 'form-label' }, 'Client'),
              renderClientSelect(clientId, handleClientChange, isRunning, 'client')
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', { htmlFor: 'project', className: 'form-label' }, 'Project'),
              renderProjectSelect(projectId, clientId, handleProjectChange, isRunning, 'project')
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', { htmlFor: 'task', className: 'form-label' }, 'Task'),
              renderTaskSelect(taskId, projectId, handleTaskChange, isRunning, 'task')
            )
          ),
          projectId && React.createElement('div', { className: 'quick-task-row' },
            React.createElement('input', {
              className: 'form-control',
              type: 'text',
              value: newTaskName,
              onChange: (e) => setNewTaskName(e.target.value),
              disabled: isRunning,
              placeholder: 'New task'
            }),
            React.createElement('input', {
              className: 'form-control quick-task-rate',
              type: 'number',
              min: '0',
              step: '0.01',
              value: newTaskRate,
              onChange: (e) => setNewTaskRate(e.target.value),
              disabled: isRunning,
              placeholder: 'Rate'
            }),
            React.createElement('label', { className: 'form-check quick-task-billable' },
              React.createElement('input', {
                className: 'form-check-input',
                type: 'checkbox',
                checked: newTaskBillable,
                onChange: (e) => setNewTaskBillable(e.target.checked),
                disabled: isRunning
              }),
              React.createElement('span', { className: 'form-check-label' }, 'Billable')
            ),
            React.createElement('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: createTask,
              disabled: isRunning
            }, React.createElement('i', { className: 'bi bi-plus-lg' }), React.createElement('span', null, 'Add Task'))
          ),
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
              React.createElement('label', { htmlFor: 'billable', className: 'form-check-label' }, 'Billable')
            )
          ),
          React.createElement('div', { className: 'timer-controls' },
            !isRunning
              ? React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: startTimer }, 'Start Timer')
              : React.createElement('button', { type: 'button', className: 'btn btn-danger', onClick: stopTimer }, 'Stop Timer')
          )
        )
      )
    ),

    React.createElement('section', { className: 'day-selector-card' },
      React.createElement('button', { type: 'button', className: 'btn btn-secondary day-nav-btn', onClick: () => shiftSelectedDate(-1), 'aria-label': 'Previous day' },
        React.createElement('i', { className: 'bi bi-chevron-left' })
      ),
      React.createElement('div', { className: 'selected-day' },
        React.createElement('label', { htmlFor: 'selected-date', className: 'eyebrow' }, 'Selected Day'),
        React.createElement('input', { id: 'selected-date', className: 'form-control selected-day-input', type: 'date', value: selectedDate, onChange: (e) => setSelectedDate(e.target.value) }),
        React.createElement('div', { className: 'selected-day-label' }, formatSelectedDate(selectedDate))
      ),
      React.createElement('button', { type: 'button', className: 'btn btn-secondary day-nav-btn', onClick: () => shiftSelectedDate(1), 'aria-label': 'Next day' },
        React.createElement('i', { className: 'bi bi-chevron-right' })
      )
    ),

    React.createElement('div', { className: 'daily-summary' },
      React.createElement('div', { className: 'daily-summary-item' }, React.createElement('span', null, 'Total'), React.createElement('strong', null, formatDuration(selectedDuration))),
      React.createElement('div', { className: 'daily-summary-item' }, React.createElement('span', null, 'Billable'), React.createElement('strong', null, formatDuration(selectedBillableDuration))),
      React.createElement('div', { className: 'daily-summary-item' }, React.createElement('span', null, 'Entries'), React.createElement('strong', null, selectedEntries.length))
    ),

    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' }, React.createElement('h2', null, formatSelectedDate(selectedDate))),
      React.createElement('div', { className: 'card-body' },
        selectedEntries.length === 0
          ? React.createElement('p', { className: 'empty-day-message' }, 'No time entries for this day')
          : React.createElement('div', { className: 'entry-list day-entry-list' },
              selectedEntries.map(entry => editingEntryId === entry.id
                ? renderEditEntry(entry)
                : renderReadEntry(entry)
              )
            )
      )
    )
  );

  function renderReadEntry(entry) {
    const entryClientId = getEntryClientId(entry);
    const entryTaskId = entry.taskId || (entry.task && entry.task.id);
    return React.createElement('article', { className: 'entry-card', key: entry.id },
      React.createElement('div', { className: 'entry-card-main' },
        React.createElement('div', { className: 'entry-project' },
          `${getClientName(entryClientId)} / ${entry.project ? entry.project.name : getProjectName(entry.projectId)}`
        ),
        React.createElement('div', { className: 'entry-task' }, entry.task ? entry.task.name : getTaskName(entryTaskId)),
        React.createElement('div', { className: 'entry-description' }, entry.description || 'No description')
      ),
      React.createElement('div', { className: 'entry-meta-stack' },
        React.createElement('div', { className: 'entry-duration' }, formatDuration(entry.duration)),
        React.createElement('div', { className: `entry-billable ${entry.billable ? 'is-billable' : 'is-nonbillable'}` }, entry.billable ? 'Billable' : 'No bill'),
        React.createElement('div', { className: 'entry-actions' },
          React.createElement('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => startEditing(entry) }, React.createElement('i', { className: 'bi bi-pencil' }), React.createElement('span', null, 'Edit')),
          React.createElement('button', { type: 'button', className: 'btn btn-danger btn-sm', onClick: () => deleteEntry(entry) }, React.createElement('i', { className: 'bi bi-trash' }), React.createElement('span', null, 'Delete'))
        )
      )
    );
  }

  function renderEditEntry(entry) {
    return React.createElement('article', { className: 'entry-card entry-card-editing', key: entry.id },
      React.createElement('div', { className: 'edit-entry-grid' },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { className: 'form-label' }, 'Client'),
          renderClientSelect(editForm.clientId, (value) => updateEditForm('clientId', value), false, `edit-client-${entry.id}`)
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { className: 'form-label' }, 'Project'),
          renderProjectSelect(editForm.projectId, editForm.clientId, (value) => updateEditForm('projectId', value), false, `edit-project-${entry.id}`)
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { className: 'form-label' }, 'Task'),
          renderTaskSelect(editForm.taskId, editForm.projectId, (value) => updateEditForm('taskId', value), false, `edit-task-${entry.id}`)
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { className: 'form-label' }, 'Date'),
          React.createElement('input', { className: 'form-control', type: 'date', value: editForm.date, onChange: (e) => updateEditForm('date', e.target.value) })
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { className: 'form-label' }, 'Start'),
          React.createElement('input', { className: 'form-control', type: 'time', value: editForm.startTime, onChange: (e) => updateEditForm('startTime', e.target.value) })
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { className: 'form-label' }, 'Hours'),
          React.createElement('input', { className: 'form-control', type: 'number', min: '0', step: '0.01', value: editForm.hours, onChange: (e) => updateEditForm('hours', e.target.value) })
        )
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { className: 'form-label' }, 'Description'),
        React.createElement('textarea', { className: 'form-control', rows: 3, value: editForm.description, onChange: (e) => updateEditForm('description', e.target.value) })
      ),
      React.createElement('div', { className: 'entry-edit-footer' },
        React.createElement('label', { className: 'form-check entry-edit-billable' },
          React.createElement('input', { className: 'form-check-input', type: 'checkbox', checked: editForm.billable, onChange: (e) => updateEditForm('billable', e.target.checked) }),
          React.createElement('span', { className: 'form-check-label' }, 'Billable')
        ),
        React.createElement('div', { className: 'entry-actions' },
          React.createElement('button', { type: 'button', className: 'btn btn-primary btn-sm', onClick: () => saveEditedEntry(entry) }, React.createElement('i', { className: 'bi bi-check2' }), React.createElement('span', null, 'Save')),
          React.createElement('button', { type: 'button', className: 'btn btn-secondary btn-sm', onClick: cancelEditing }, React.createElement('i', { className: 'bi bi-x-lg' }), React.createElement('span', null, 'Cancel'))
        )
      )
    );
  }
}

window.TimeTracker = TimeTracker;
