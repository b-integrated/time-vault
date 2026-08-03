// FirstTimeSetup component for creating the first admin user

function FirstTimeSetup({ onSetupComplete }) {
  // State for form data and UI state
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  
  // API URL
  const API_URL = '/api';
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    // Validate form
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    
    // Send request to create first admin user
    fetch(`${API_URL}/auth/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        email,
        password,
        isAdmin: true
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to create admin user');
      }
      return response.json();
    })
    .then(data => {
      // Call onSetupComplete callback with token and user data
      onSetupComplete(data.token, data.user);
    })
    .catch(error => {
      console.error('Setup error:', error);
      setError(error.message);
      setIsLoading(false);
    });
  };
  
  return React.createElement('div', { className: 'first-time-setup-container' },
    React.createElement('div', { className: 'setup-header' },
      React.createElement('h1', null, 'Welcome to TimeVault'),
      React.createElement('h2', null, 'First-Time Setup')
    ),
    
    React.createElement('div', { className: 'setup-description' },
      React.createElement('p', null, 'It looks like this is the first time you\'re using TimeVault. Let\'s set up your admin account to get started.'),
      React.createElement('p', null, 'This account will have full administrative privileges and will be used to manage the application.')
    ),
    
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    
    React.createElement('form', { onSubmit: handleSubmit, className: 'setup-form' },
      // Name field
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'name', className: 'form-label' }, 'Name'),
        React.createElement('input', {
          type: 'text',
          id: 'name',
          className: 'form-control',
          value: name,
          onChange: (e) => setName(e.target.value),
          required: true
        })
      ),
      
      // Email field
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'email', className: 'form-label' }, 'Email'),
        React.createElement('input', {
          type: 'email',
          id: 'email',
          className: 'form-control',
          value: email,
          onChange: (e) => setEmail(e.target.value),
          required: true
        })
      ),
      
      // Password field
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'password', className: 'form-label' }, 'Password'),
        React.createElement('input', {
          type: 'password',
          id: 'password',
          className: 'form-control',
          value: password,
          onChange: (e) => setPassword(e.target.value),
          required: true
        })
      ),
      
      // Confirm Password field
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'confirm-password', className: 'form-label' }, 'Confirm Password'),
        React.createElement('input', {
          type: 'password',
          id: 'confirm-password',
          className: 'form-control',
          value: confirmPassword,
          onChange: (e) => setConfirmPassword(e.target.value),
          required: true
        })
      ),
      
      // Submit button
      React.createElement('div', { className: 'form-group' },
        React.createElement('button', { 
          type: 'submit', 
          className: 'btn btn-primary btn-lg',
          disabled: isLoading
        },
          isLoading ? 'Creating Admin User...' : 'Create Admin User'
        )
      )
    ),
    
    React.createElement('div', { className: 'setup-footer' },
      React.createElement('p', null, 'After creating your admin account, you\'ll be able to:'),
      React.createElement('ul', null,
        React.createElement('li', null, 'Add clients and projects'),
        React.createElement('li', null, 'Track time spent on projects'),
        React.createElement('li', null, 'Generate invoices'),
        React.createElement('li', null, 'View detailed reports'),
        React.createElement('li', null, 'Manage application settings')
      )
    )
  );
}

// Make FirstTimeSetup component globally available
window.FirstTimeSetup = FirstTimeSetup;