// UserManagement component for administrators to manage users

function UserManagement({ user }) {
  // State for users list
  const [users, setUsers] = React.useState([]);
  
  // State for form data
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    twoFactorEnabled: false
  });
  
  // State for editing
  const [editingUser, setEditingUser] = React.useState(null);
  
  // State for UI
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [showAddForm, setShowAddForm] = React.useState(false);
  
  // API URL
  const API_URL = 'http://localhost:8080/api';
  
  // Load users on component mount
  React.useEffect(() => {
    fetchUsers();
  }, []);
  
  // Fetch all users
  const fetchUsers = () => {
    setIsLoading(true);
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }
    
    // Fetch users
    fetch(`${API_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    })
    .then(data => {
      setUsers(data);
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users. Please try again.');
      setIsLoading(false);
    });
  };
  
  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      twoFactorEnabled: false
    });
    setEditingUser(null);
    setShowAddForm(false);
  };
  
  // Handle form submission for adding/editing user
  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    // Validate form
    if (!formData.name || !formData.email) {
      setError('Name and email are required');
      setIsLoading(false);
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }
    
    // Validate password for new users
    if (!editingUser && (!formData.password || formData.password.length < 8)) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }
    
    // Validate password confirmation
    if (!editingUser && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }
    
    // Prepare request data
    const userData = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      twoFactorEnabled: formData.twoFactorEnabled
    };
    
    // Add password for new users
    if (!editingUser) {
      userData.password = formData.password;
    }
    
    if (editingUser) {
      // Update existing user
      fetch(`${API_URL}/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to update user');
        }
        return response.json();
      })
      .then(data => {
        // Update users list
        setUsers(users.map(u => u.id === editingUser.id ? data : u));
        setSuccess('User updated successfully');
        resetForm();
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error updating user:', error);
        setError('Failed to update user. Please try again.');
        setIsLoading(false);
      });
    } else {
      // Create new user
      fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to create user');
        }
        return response.json();
      })
      .then(data => {
        // Add new user to list
        fetchUsers(); // Refresh the list
        setSuccess('User created successfully');
        resetForm();
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Error creating user:', error);
        setError('Failed to create user. The email may already be in use.');
        setIsLoading(false);
      });
    }
  };
  
  // Handle edit user
  const handleEditUser = (user) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      twoFactorEnabled: user.twoFactorEnabled
    });
    setEditingUser(user);
    setShowAddForm(true);
    setError('');
    setSuccess('');
  };
  
  // Handle delete user
  const handleDeleteUser = (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    setIsLoading(true);
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Authentication required');
      setIsLoading(false);
      return;
    }
    
    // Delete user
    fetch(`${API_URL}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to delete user');
      }
      
      // Remove user from list
      setUsers(users.filter(u => u.id !== userId));
      setSuccess('User deleted successfully');
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error deleting user:', error);
      setError('Failed to delete user. Please try again.');
      setIsLoading(false);
    });
  };
  
  // Toggle add form
  const toggleAddForm = () => {
    setShowAddForm(!showAddForm);
    if (!showAddForm) {
      resetForm();
    }
  };
  
  // Render user management
  return React.createElement('div', { className: 'user-management' },
    React.createElement('h1', null, 'User Management'),
    
    // Error and success messages
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    success && React.createElement('div', { className: 'alert alert-success' }, success),
    
    // Add user button
    React.createElement('div', { className: 'mb-4' },
      React.createElement('button', {
        className: `btn ${showAddForm ? 'btn-secondary' : 'btn-primary'}`,
        onClick: toggleAddForm
      }, showAddForm ? 'Cancel' : 'Add New User')
    ),
    
    // Add/Edit user form
    showAddForm && React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, editingUser ? 'Edit User' : 'Add New User')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', { onSubmit: handleSubmit },
          // Name
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'name', className: 'form-label' }, 'Name'),
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
          
          // Password (only for new users)
          !editingUser && React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'password', className: 'form-label' }, 'Password'),
            React.createElement('input', {
              type: 'password',
              id: 'password',
              name: 'password',
              className: 'form-control',
              value: formData.password,
              onChange: handleInputChange,
              required: !editingUser,
              minLength: 8
            })
          ),
          
          // Confirm Password (only for new users)
          !editingUser && React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'confirmPassword', className: 'form-label' }, 'Confirm Password'),
            React.createElement('input', {
              type: 'password',
              id: 'confirmPassword',
              name: 'confirmPassword',
              className: 'form-control',
              value: formData.confirmPassword,
              onChange: handleInputChange,
              required: !editingUser
            })
          ),
          
          // Role
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'role', className: 'form-label' }, 'Role'),
            React.createElement('select', {
              id: 'role',
              name: 'role',
              className: 'form-control',
              value: formData.role,
              onChange: handleInputChange
            },
              React.createElement('option', { value: 'user' }, 'User'),
              React.createElement('option', { value: 'admin' }, 'Administrator')
            )
          ),
          
          // Two-factor authentication
          React.createElement('div', { className: 'form-check mb-3' },
            React.createElement('input', {
              type: 'checkbox',
              id: 'twoFactorEnabled',
              name: 'twoFactorEnabled',
              className: 'form-check-input',
              checked: formData.twoFactorEnabled,
              onChange: handleInputChange
            }),
            React.createElement('label', { htmlFor: 'twoFactorEnabled', className: 'form-check-label' }, 
              'Enable Two-Factor Authentication'
            )
          ),
          
          // Submit button
          React.createElement('div', { className: 'form-group' },
            React.createElement('button', { 
              type: 'submit', 
              className: 'btn btn-primary',
              disabled: isLoading
            }, isLoading ? (editingUser ? 'Updating...' : 'Creating...') : (editingUser ? 'Update User' : 'Create User'))
          )
        )
      )
    ),
    
    // Users list
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Users')
      ),
      React.createElement('div', { className: 'card-body' },
        isLoading && !users.length ? 
          React.createElement('div', { className: 'text-center' }, 'Loading users...') :
          users.length === 0 ?
            React.createElement('div', { className: 'text-center' }, 'No users found.') :
            React.createElement('div', { className: 'table-responsive' },
              React.createElement('table', { className: 'table table-striped' },
                React.createElement('thead', null,
                  React.createElement('tr', null,
                    React.createElement('th', null, 'Name'),
                    React.createElement('th', null, 'Email'),
                    React.createElement('th', null, 'Role'),
                    React.createElement('th', null, '2FA'),
                    React.createElement('th', null, 'Created'),
                    React.createElement('th', null, 'Actions')
                  )
                ),
                React.createElement('tbody', null,
                  users.map(user => 
                    React.createElement('tr', { key: user.id },
                      React.createElement('td', null, user.name),
                      React.createElement('td', null, user.email),
                      React.createElement('td', null, 
                        React.createElement('span', { 
                          className: `badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}`
                        }, 
                          user.role === 'admin' ? 'Administrator' : 'User'
                        )
                      ),
                      React.createElement('td', null, 
                        user.twoFactorEnabled ? 
                          React.createElement('span', { className: 'badge bg-success' }, 'Enabled') : 
                          React.createElement('span', { className: 'badge bg-secondary' }, 'Disabled')
                      ),
                      React.createElement('td', null, new Date(user.createdAt).toLocaleDateString()),
                      React.createElement('td', null,
                        React.createElement('div', { className: 'btn-group' },
                          React.createElement('button', {
                            className: 'btn btn-sm btn-outline-primary',
                            onClick: () => handleEditUser(user),
                            disabled: isLoading
                          }, 'Edit'),
                          React.createElement('button', {
                            className: 'btn btn-sm btn-outline-danger',
                            onClick: () => handleDeleteUser(user.id),
                            disabled: isLoading || user.id === currentUser.id
                          }, 'Delete')
                        )
                      )
                    )
                  )
                )
              )
            )
      )
    )
  );
}

// Make UserManagement component globally available
window.UserManagement = UserManagement;