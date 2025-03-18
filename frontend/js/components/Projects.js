// Projects component for managing projects

function Projects({ user }) {
  // State for projects data
  const [projects, setProjects] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  
  // State for form
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentProject, setCurrentProject] = React.useState(null);
  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    clientId: '',
    rate: '',
    status: 'active'
  });
  
  // State for filtering and sorting
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterClient, setFilterClient] = React.useState('all');
  const [sortField, setSortField] = React.useState('name');
  const [sortDirection, setSortDirection] = React.useState('asc');
  
  // API URL
  const API_URL = 'http://localhost:8080/api';
  
  // Fetch projects and clients on component mount
  React.useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Fetch clients
    fetch(`${API_URL}/clients`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch clients');
      }
      return response.json();
    })
    .then(data => {
      setClients(data);
      
      // Fetch projects
      return fetch(`${API_URL}/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      return response.json();
    })
    .then(data => {
      setProjects(data);
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
      setIsLoading(false);
    });
  }, []);
  
  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.name || !formData.clientId) {
      setError('Name and client are required');
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Prepare project data
    const projectData = {
      name: formData.name,
      description: formData.description,
      clientId: parseInt(formData.clientId),
      rate: parseFloat(formData.rate) || 0,
      status: formData.status
    };
    
    // Determine if creating or updating
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing 
      ? `${API_URL}/projects/${currentProject.id}`
      : `${API_URL}/projects`;
    
    // Send request
    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(projectData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} project`);
      }
      return response.json();
    })
    .then(data => {
      if (isEditing) {
        // Update project in list
        setProjects(projects.map(project => 
          project.id === data.id ? data : project
        ));
      } else {
        // Add new project to list
        setProjects([...projects, data]);
      }
      
      // Reset form
      resetForm();
    })
    .catch(error => {
      console.error('Error saving project:', error);
      setError(`Failed to ${isEditing ? 'update' : 'create'} project`);
    });
  };
  
  // Handle edit project
  const handleEdit = (project) => {
    setCurrentProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      clientId: project.clientId.toString(),
      rate: project.rate.toString(),
      status: project.status
    });
    setIsEditing(true);
    setError('');
  };
  
  // Handle delete project
  const handleDelete = (projectId) => {
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Send delete request
    fetch(`${API_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to delete project');
      }
      
      // Remove project from list
      setProjects(projects.filter(project => project.id !== projectId));
    })
    .catch(error => {
      console.error('Error deleting project:', error);
      setError('Failed to delete project');
    });
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      clientId: '',
      rate: '',
      status: 'active'
    });
    setCurrentProject(null);
    setIsEditing(false);
    setError('');
  };
  
  // Get client name by ID
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };
  
  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      // Filter by status
      if (filterStatus !== 'all' && project.status !== filterStatus) {
        return false;
      }
      
      // Filter by client
      if (filterClient !== 'all' && project.clientId !== parseInt(filterClient)) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by field
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'client':
          comparison = getClientName(a.clientId).localeCompare(getClientName(b.clientId));
          break;
        case 'rate':
          comparison = a.rate - b.rate;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };
  
  // Render loading state
  if (isLoading) {
    return React.createElement('div', { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading projects...')
    );
  }
  
  // Render projects
  return React.createElement('div', { className: 'projects' },
    React.createElement('h1', null, 'Projects'),
    
    // Error message
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    
    // Project form
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, isEditing ? 'Edit Project' : 'Create Project')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', { onSubmit: handleSubmit },
          // Project name
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'name', className: 'form-label' }, 'Project Name'),
            React.createElement('input', {
              type: 'text',
              id: 'name',
              name: 'name',
              className: 'form-control',
              value: formData.name,
              onChange: handleInputChange,
              required: true
            })
          ),
          
          // Client
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'clientId', className: 'form-label' }, 'Client'),
            React.createElement('select', {
              id: 'clientId',
              name: 'clientId',
              className: 'form-control',
              value: formData.clientId,
              onChange: handleInputChange,
              required: true
            },
              React.createElement('option', { value: '' }, 'Select a client'),
              clients.map(client => 
                React.createElement('option', { 
                  key: client.id, 
                  value: client.id 
                }, client.name)
              )
            )
          ),
          
          // Description
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'description', className: 'form-label' }, 'Description'),
            React.createElement('textarea', {
              id: 'description',
              name: 'description',
              className: 'form-control',
              value: formData.description,
              onChange: handleInputChange,
              rows: 2
            })
          ),
          
          // Rate
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'rate', className: 'form-label' }, 'Hourly Rate ($)'),
            React.createElement('input', {
              type: 'number',
              id: 'rate',
              name: 'rate',
              className: 'form-control',
              value: formData.rate,
              onChange: handleInputChange,
              min: 0,
              step: 0.01
            })
          ),
          
          // Status
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'status', className: 'form-label' }, 'Status'),
            React.createElement('select', {
              id: 'status',
              name: 'status',
              className: 'form-control',
              value: formData.status,
              onChange: handleInputChange
            },
              React.createElement('option', { value: 'active' }, 'Active'),
              React.createElement('option', { value: 'archived' }, 'Archived')
            )
          ),
          
          // Form buttons
          React.createElement('div', { className: 'form-group' },
            React.createElement('button', { 
              type: 'submit', 
              className: 'btn btn-primary mr-2' 
            }, isEditing ? 'Update Project' : 'Create Project'),
            
            isEditing && React.createElement('button', { 
              type: 'button', 
              className: 'btn btn-secondary', 
              onClick: resetForm 
            }, 'Cancel')
          )
        )
      )
    ),
    
    // Filters and sorting
    React.createElement('div', { className: 'filters mb-3' },
      React.createElement('div', { className: 'row' },
        // Status filter
        React.createElement('div', { className: 'col-md-3' },
          React.createElement('label', { htmlFor: 'filter-status', className: 'form-label' }, 'Status'),
          React.createElement('select', {
            id: 'filter-status',
            className: 'form-control',
            value: filterStatus,
            onChange: (e) => setFilterStatus(e.target.value)
          },
            React.createElement('option', { value: 'all' }, 'All Statuses'),
            React.createElement('option', { value: 'active' }, 'Active'),
            React.createElement('option', { value: 'archived' }, 'Archived')
          )
        ),
        
        // Client filter
        React.createElement('div', { className: 'col-md-3' },
          React.createElement('label', { htmlFor: 'filter-client', className: 'form-label' }, 'Client'),
          React.createElement('select', {
            id: 'filter-client',
            className: 'form-control',
            value: filterClient,
            onChange: (e) => setFilterClient(e.target.value)
          },
            React.createElement('option', { value: 'all' }, 'All Clients'),
            clients.map(client => 
              React.createElement('option', { 
                key: client.id, 
                value: client.id 
              }, client.name)
            )
          )
        ),
        
        // Sort field
        React.createElement('div', { className: 'col-md-3' },
          React.createElement('label', { htmlFor: 'sort-field', className: 'form-label' }, 'Sort By'),
          React.createElement('select', {
            id: 'sort-field',
            className: 'form-control',
            value: sortField,
            onChange: (e) => setSortField(e.target.value)
          },
            React.createElement('option', { value: 'name' }, 'Name'),
            React.createElement('option', { value: 'client' }, 'Client'),
            React.createElement('option', { value: 'rate' }, 'Rate'),
            React.createElement('option', { value: 'status' }, 'Status')
          )
        ),
        
        // Sort direction
        React.createElement('div', { className: 'col-md-3' },
          React.createElement('label', { htmlFor: 'sort-direction', className: 'form-label' }, 'Direction'),
          React.createElement('select', {
            id: 'sort-direction',
            className: 'form-control',
            value: sortDirection,
            onChange: (e) => setSortDirection(e.target.value)
          },
            React.createElement('option', { value: 'asc' }, 'Ascending'),
            React.createElement('option', { value: 'desc' }, 'Descending')
          )
        )
      )
    ),
    
    // Projects list
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Projects List')
      ),
      React.createElement('div', { className: 'card-body' },
        filteredProjects.length === 0
          ? React.createElement('p', null, 'No projects found')
          : React.createElement('table', { className: 'table' },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', null, 'Name'),
                  React.createElement('th', null, 'Client'),
                  React.createElement('th', null, 'Rate'),
                  React.createElement('th', null, 'Status'),
                  React.createElement('th', null, 'Actions')
                )
              ),
              React.createElement('tbody', null,
                filteredProjects.map(project => 
                  React.createElement('tr', { key: project.id },
                    React.createElement('td', null, project.name),
                    React.createElement('td', null, getClientName(project.clientId)),
                    React.createElement('td', null, formatCurrency(project.rate)),
                    React.createElement('td', null, 
                      React.createElement('span', { 
                        className: `badge ${project.status === 'active' ? 'bg-success' : 'bg-secondary'}`
                      }, project.status)
                    ),
                    React.createElement('td', null,
                      React.createElement('button', {
                        className: 'btn btn-sm btn-primary mr-1',
                        onClick: () => handleEdit(project)
                      }, 'Edit'),
                      React.createElement('button', {
                        className: 'btn btn-sm btn-danger',
                        onClick: () => handleDelete(project.id)
                      }, 'Delete')
                    )
                  )
                )
              )
            )
      )
    )
  );
}

// Make Projects component globally available
window.Projects = Projects;