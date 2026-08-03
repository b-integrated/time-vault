// Clients component for managing clients

function Clients({ user }) {
  // State for clients data
  const [clients, setClients] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  
  // State for form
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentClient, setCurrentClient] = React.useState(null);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  
  // State for filtering and sorting
  const [searchTerm, setSearchTerm] = React.useState('');
  const [sortField, setSortField] = React.useState('name');
  const [sortDirection, setSortDirection] = React.useState('asc');
  
  // API URL
  const API_URL = '/api';
  
  // Fetch clients on component mount
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
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error fetching clients:', error);
      setError('Failed to load clients');
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
    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Prepare client data
    const clientData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address
    };
    
    // Determine if creating or updating
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing 
      ? `${API_URL}/clients/${currentClient.id}`
      : `${API_URL}/clients`;
    
    // Send request
    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(clientData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} client`);
      }
      return response.json();
    })
    .then(data => {
      if (isEditing) {
        // Update client in list
        setClients(clients.map(client => 
          client.id === data.id ? data : client
        ));
      } else {
        // Add new client to list
        setClients([...clients, data]);
      }
      
      // Reset form
      resetForm();
    })
    .catch(error => {
      console.error('Error saving client:', error);
      setError(`Failed to ${isEditing ? 'update' : 'create'} client`);
    });
  };
  
  // Handle edit client
  const handleEdit = (client) => {
    setCurrentClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      address: client.address || ''
    });
    setIsEditing(true);
    setError('');
  };
  
  // Handle delete client
  const handleDelete = (clientId) => {
    if (!confirm('Are you sure you want to delete this client?')) {
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Send delete request
    fetch(`${API_URL}/clients/${clientId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to delete client');
      }
      
      // Remove client from list
      setClients(clients.filter(client => client.id !== clientId));
    })
    .catch(error => {
      console.error('Error deleting client:', error);
      setError('Failed to delete client');
    });
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: ''
    });
    setCurrentClient(null);
    setIsEditing(false);
    setError('');
  };
  
  // Filter and sort clients
  const filteredClients = clients
    .filter(client => {
      // Search by name or email
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          client.name.toLowerCase().includes(term) ||
          client.email.toLowerCase().includes(term)
        );
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
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  
  // Render loading state
  if (isLoading) {
    return React.createElement('div', { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading clients...')
    );
  }
  
  // Render clients
  return React.createElement('div', { className: 'clients' },
    React.createElement('h1', null, 'Clients'),
    
    // Error message
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    
    // Client form
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, isEditing ? 'Edit Client' : 'Create Client')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', { onSubmit: handleSubmit },
          // Client name
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'name', className: 'form-label' }, 'Client Name'),
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
          
          // Email
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'email', className: 'form-label' }, 'Email'),
            React.createElement('input', {
              type: 'email',
              id: 'email',
              name: 'email',
              className: 'form-control',
              value: formData.email,
              onChange: handleInputChange,
              required: true
            })
          ),
          
          // Phone
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'phone', className: 'form-label' }, 'Phone'),
            React.createElement('input', {
              type: 'tel',
              id: 'phone',
              name: 'phone',
              className: 'form-control',
              value: formData.phone,
              onChange: handleInputChange
            })
          ),
          
          // Address
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'address', className: 'form-label' }, 'Address'),
            React.createElement('textarea', {
              id: 'address',
              name: 'address',
              className: 'form-control',
              value: formData.address,
              onChange: handleInputChange,
              rows: 2
            })
          ),
          
          // Form buttons
          React.createElement('div', { className: 'form-group' },
            React.createElement('button', { 
              type: 'submit', 
              className: 'btn btn-primary mr-2' 
            }, isEditing ? 'Update Client' : 'Create Client'),
            
            isEditing && React.createElement('button', { 
              type: 'button', 
              className: 'btn btn-secondary', 
              onClick: resetForm 
            }, 'Cancel')
          )
        )
      )
    ),
    
    // Search and sorting
    React.createElement('div', { className: 'filters mb-3' },
      React.createElement('div', { className: 'row' },
        // Search
        React.createElement('div', { className: 'col-md-6' },
          React.createElement('label', { htmlFor: 'search', className: 'form-label' }, 'Search'),
          React.createElement('input', {
            type: 'text',
            id: 'search',
            className: 'form-control',
            placeholder: 'Search by name or email',
            value: searchTerm,
            onChange: (e) => setSearchTerm(e.target.value)
          })
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
            React.createElement('option', { value: 'email' }, 'Email')
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
    
    // Clients list
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Clients List')
      ),
      React.createElement('div', { className: 'card-body' },
        filteredClients.length === 0
          ? React.createElement('p', null, 'No clients found')
          : React.createElement('table', { className: 'table' },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', null, 'Name'),
                  React.createElement('th', null, 'Email'),
                  React.createElement('th', null, 'Phone'),
                  React.createElement('th', null, 'Actions')
                )
              ),
              React.createElement('tbody', null,
                filteredClients.map(client => 
                  React.createElement('tr', { key: client.id },
                    React.createElement('td', null, client.name),
                    React.createElement('td', null, client.email),
                    React.createElement('td', null, client.phone || '-'),
                    React.createElement('td', null,
                      React.createElement('button', {
                        className: 'btn btn-sm btn-primary mr-1',
                        onClick: () => handleEdit(client)
                      }, 'Edit'),
                      React.createElement('button', {
                        className: 'btn btn-sm btn-danger',
                        onClick: () => handleDelete(client.id)
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

// Make Clients component globally available
window.Clients = Clients;