// Auth component for handling login, registration, and 2FA

function Auth({ onLogin }) {
  // State for form data and UI state
  const [isRegistering, setIsRegistering] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [name, setName] = React.useState('');
  const [verificationCode, setVerificationCode] = React.useState('');
  const [error, setError] = React.useState('');
  
  // API URL
  const API_URL = '/api';
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    if (!email || !password || (isRegistering && !name)) {
      setError('Please fill in all fields');
      return;
    }
    
    // Determine endpoint based on registration state
    const endpoint = isRegistering ? `${API_URL}/auth/register` : `${API_URL}/auth/login`;
    
    // Prepare request body
    const body = isRegistering
      ? { email, password, name }
      : { email, password };
    
    // Send request to server
    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(isRegistering ? 'Registration failed' : 'Login failed');
      }
      return response.json();
    })
    .then(data => {
      // Store email for verification
      setEmail(email);
      
      if (data.token) {
        onLogin(data.token, data.user);
        return;
      }
      
      // Check if we're in development mode and received a code
      if (data.Code) {
        console.log('Development mode: Using provided 2FA code:', data.Code);
        setVerificationCode(data.Code);
      }
      
      // Show verification form
      setIsVerifying(true);
    })
    .catch(error => {
      console.error('Authentication error:', error);
      setError(error.message);
    });
  };
  
  // Handle verification form submission
  const handleVerify = (e) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }
    
    // Send verification request
    fetch(`${API_URL}/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        code: verificationCode
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Verification failed');
      }
      return response.json();
    })
    .then(data => {
      // Call onLogin callback with token and user data
      onLogin(data.token, data.user);
    })
    .catch(error => {
      console.error('Verification error:', error);
      setError(error.message);
    });
  };
  
  // Toggle between login and registration
  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setError('');
  };
  
  // Render verification form
  if (isVerifying) {
    return React.createElement('div', { className: 'auth-container' },
      React.createElement('div', { className: 'auth-header' },
        React.createElement('h1', null, 'TimeVault'),
        React.createElement('h2', null, 'Verify Your Account')
      ),
      
      error && React.createElement('div', { className: 'alert alert-danger' }, error),
      
      React.createElement('p', null, 'A verification code has been sent to your email. Please enter it below.'),
      
      React.createElement('form', { onSubmit: handleVerify },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: 'verification-code', className: 'form-label' }, 'Verification Code'),
          React.createElement('input', {
            type: 'text',
            id: 'verification-code',
            className: 'form-control',
            value: verificationCode,
            onChange: (e) => setVerificationCode(e.target.value),
            required: true
          })
        ),
        
        React.createElement('div', { className: 'form-group' },
          React.createElement('button', { type: 'submit', className: 'btn btn-primary' }, 'Verify')
        )
      )
    );
  }
  
  // Render login/registration form
  return React.createElement('div', { className: 'auth-container' },
    React.createElement('div', { className: 'auth-header' },
      React.createElement('h1', null, 'TimeVault'),
      React.createElement('h2', null, isRegistering ? 'Create an Account' : 'Sign In')
    ),
    
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    
    React.createElement('form', { onSubmit: handleSubmit },
      // Name field (registration only)
      isRegistering && React.createElement('div', { className: 'form-group' },
        React.createElement('label', { htmlFor: 'name', className: 'form-label' }, 'Name'),
        React.createElement('input', {
          type: 'text',
          id: 'name',
          className: 'form-control',
          value: name,
          onChange: (e) => setName(e.target.value),
          required: isRegistering
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
      
      // Submit button
      React.createElement('div', { className: 'form-group' },
        React.createElement('button', { type: 'submit', className: 'btn btn-primary' },
          isRegistering ? 'Register' : 'Login'
        )
      )
    ),
    
    // Toggle link
    React.createElement('div', { className: 'auth-footer' },
      React.createElement('p', null,
        isRegistering ? 'Already have an account? ' : 'Don\'t have an account? ',
        React.createElement('a', { href: '#', onClick: (e) => {
          e.preventDefault();
          toggleMode();
        }}, isRegistering ? 'Sign In' : 'Register')
      )
    )
  );
}

// Make Auth component globally available
window.Auth = Auth;