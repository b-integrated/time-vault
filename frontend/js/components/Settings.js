// Settings component for managing user settings

function Settings({ user, onUserUpdate }) {
  // State for profile settings
  const [profileData, setProfileData] = React.useState({
    name: user ? user.name : '',
    email: user ? user.email : '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // State for 2FA settings
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(user ? user.twoFactorEnabled : false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = React.useState(false);
  const [verificationCode, setVerificationCode] = React.useState('');
  
  // State for notification settings
  const [notificationSettings, setNotificationSettings] = React.useState({
    emailNotifications: true,
    reminderNotifications: true,
    invoiceNotifications: true
  });
  
  // State for theme settings
  const [theme, setTheme] = React.useState('light');
  
  // State for loading and errors
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  
  // API URL
  const API_URL = '/api';
  
  // Load user settings on component mount
  React.useEffect(() => {
    if (!user) return;
    
    // Set profile data from user
    setProfileData({
      ...profileData,
      name: user.name,
      email: user.email
    });
    
    // Set 2FA status from user
    setTwoFactorEnabled(user.twoFactorEnabled);
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Fetch user settings
    fetch(`${API_URL}/users/${user.id}/settings`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch user settings');
      }
      return response.json();
    })
    .then(data => {
      // Set notification settings
      setNotificationSettings({
        emailNotifications: data.emailNotifications !== false,
        reminderNotifications: data.reminderNotifications !== false,
        invoiceNotifications: data.invoiceNotifications !== false
      });
      
      // Set theme
      if (data.theme) {
        setTheme(data.theme);
        document.body.setAttribute('data-theme', data.theme);
      }
    })
    .catch(error => {
      console.error('Error fetching user settings:', error);
      // Don't show error to user, just use defaults
    });
  }, [user]);
  
  // Handle profile input change
  const handleProfileInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value
    });
  };
  
  // Handle notification setting change
  const handleNotificationChange = (e) => {
    const { name, checked } = e.target;
    setNotificationSettings({
      ...notificationSettings,
      [name]: checked
    });
  };
  
  // Handle theme change
  const handleThemeChange = (e) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    document.body.setAttribute('data-theme', newTheme);
  };
  
  // Save profile settings
  const saveProfileSettings = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    // Validate form
    if (!profileData.name) {
      setError('Name is required');
      setIsLoading(false);
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileData.email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }
    
    // Validate password if changing
    if (profileData.newPassword) {
      if (!profileData.currentPassword) {
        setError('Current password is required to set a new password');
        setIsLoading(false);
        return;
      }
      
      if (profileData.newPassword.length < 8) {
        setError('New password must be at least 8 characters');
        setIsLoading(false);
        return;
      }
      
      if (profileData.newPassword !== profileData.confirmPassword) {
        setError('New password and confirmation do not match');
        setIsLoading(false);
        return;
      }
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Prepare update data
    const updateData = {
      name: profileData.name,
      email: profileData.email
    };
    
    // Add password if changing
    if (profileData.newPassword) {
      updateData.currentPassword = profileData.currentPassword;
      updateData.newPassword = profileData.newPassword;
    }
    
    // Send update request
    fetch(`${API_URL}/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updateData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      return response.json();
    })
    .then(data => {
      // Update user in parent component
      if (onUserUpdate) {
        onUserUpdate(data);
      }
      
      // Clear password fields
      setProfileData({
        ...profileData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      setSuccess('Profile updated successfully');
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error updating profile:', error);
      setError('Failed to update profile. Please check your current password.');
      setIsLoading(false);
    });
  };
  
  // Toggle 2FA
  const toggleTwoFactor = () => {
    if (twoFactorEnabled) {
      // Disable 2FA
      disableTwoFactor();
    } else {
      // Show 2FA setup
      setShowTwoFactorSetup(true);
    }
  };
  
  // Enable 2FA
  const enableTwoFactor = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    // Validate verification code
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code');
      setIsLoading(false);
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Send enable 2FA request
    fetch(`${API_URL}/auth/2fa/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        code: verificationCode
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to enable 2FA');
      }
      return response.json();
    })
    .then(data => {
      setTwoFactorEnabled(true);
      setShowTwoFactorSetup(false);
      setVerificationCode('');
      setSuccess('Two-factor authentication enabled successfully');
      
      // Update user in parent component
      if (onUserUpdate) {
        onUserUpdate({
          ...user,
          twoFactorEnabled: true
        });
      }
      
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error enabling 2FA:', error);
      setError('Failed to enable 2FA. Please check your verification code.');
      setIsLoading(false);
    });
  };
  
  // Disable 2FA
  const disableTwoFactor = () => {
    setIsLoading(true);
    setError('');
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Send disable 2FA request
    fetch(`${API_URL}/auth/2fa/disable`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to disable 2FA');
      }
      return response.json();
    })
    .then(data => {
      setTwoFactorEnabled(false);
      setSuccess('Two-factor authentication disabled successfully');
      
      // Update user in parent component
      if (onUserUpdate) {
        onUserUpdate({
          ...user,
          twoFactorEnabled: false
        });
      }
      
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error disabling 2FA:', error);
      setError('Failed to disable 2FA');
      setIsLoading(false);
    });
  };
  
  // Save notification settings
  const saveNotificationSettings = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Send update request
    fetch(`${API_URL}/users/${user.id}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...notificationSettings,
        theme: theme
      })
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to update settings');
      }
      return response.json();
    })
    .then(data => {
      setSuccess('Settings updated successfully');
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error updating settings:', error);
      setError('Failed to update settings');
      setIsLoading(false);
    });
  };
  
  // Render settings
  return React.createElement('div', { className: 'settings' },
    React.createElement('h1', null, 'Settings'),
    
    // Error and success messages
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    success && React.createElement('div', { className: 'alert alert-success' }, success),
    
    // Profile settings
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Profile Settings')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', { onSubmit: saveProfileSettings },
          // Name
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'name', className: 'form-label' }, 'Name'),
            React.createElement('input', {
              type: 'text',
              id: 'name',
              name: 'name',
              className: 'form-control',
              value: profileData.name,
              onChange: handleProfileInputChange,
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
              value: profileData.email,
              onChange: handleProfileInputChange,
              required: true
            })
          ),
          
          // Current password
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'currentPassword', className: 'form-label' }, 'Current Password'),
            React.createElement('input', {
              type: 'password',
              id: 'currentPassword',
              name: 'currentPassword',
              className: 'form-control',
              value: profileData.currentPassword,
              onChange: handleProfileInputChange,
              placeholder: 'Required to change password'
            })
          ),
          
          // New password
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'newPassword', className: 'form-label' }, 'New Password'),
            React.createElement('input', {
              type: 'password',
              id: 'newPassword',
              name: 'newPassword',
              className: 'form-control',
              value: profileData.newPassword,
              onChange: handleProfileInputChange,
              placeholder: 'Leave blank to keep current password'
            })
          ),
          
          // Confirm password
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'confirmPassword', className: 'form-label' }, 'Confirm New Password'),
            React.createElement('input', {
              type: 'password',
              id: 'confirmPassword',
              name: 'confirmPassword',
              className: 'form-control',
              value: profileData.confirmPassword,
              onChange: handleProfileInputChange
            })
          ),
          
          // Save button
          React.createElement('div', { className: 'form-group' },
            React.createElement('button', { 
              type: 'submit', 
              className: 'btn btn-primary',
              disabled: isLoading
            }, isLoading ? 'Saving...' : 'Save Profile')
          )
        )
      )
    ),
    
    // Two-factor authentication
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Two-Factor Authentication')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('div', { className: 'mb-3' },
          React.createElement('p', null, 
            twoFactorEnabled 
              ? 'Two-factor authentication is currently enabled for your account.' 
              : 'Two-factor authentication is currently disabled for your account.'
          ),
          React.createElement('button', {
            type: 'button',
            className: `btn ${twoFactorEnabled ? 'btn-danger' : 'btn-success'}`,
            onClick: toggleTwoFactor,
            disabled: isLoading
          }, twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA')
        ),
        
        // 2FA setup form
        showTwoFactorSetup && React.createElement('div', { className: 'two-factor-setup mt-4' },
          React.createElement('h3', null, 'Set Up Two-Factor Authentication'),
          React.createElement('p', null, 'A verification code has been sent to your email address. Please enter it below to enable two-factor authentication.'),
          React.createElement('form', { onSubmit: enableTwoFactor },
            React.createElement('div', { className: 'form-group' },
              React.createElement('label', { htmlFor: 'verificationCode', className: 'form-label' }, 'Verification Code'),
              React.createElement('input', {
                type: 'text',
                id: 'verificationCode',
                className: 'form-control',
                value: verificationCode,
                onChange: (e) => setVerificationCode(e.target.value),
                placeholder: 'Enter 6-digit code',
                maxLength: 6,
                required: true
              })
            ),
            React.createElement('div', { className: 'form-group' },
              React.createElement('button', { 
                type: 'submit', 
                className: 'btn btn-primary',
                disabled: isLoading
              }, isLoading ? 'Verifying...' : 'Verify and Enable')
            )
          )
        )
      )
    ),
    
    // Notification and theme settings
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Preferences')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', { onSubmit: saveNotificationSettings },
          // Notification settings
          React.createElement('h3', { className: 'mb-3' }, 'Notifications'),
          
          // Email notifications
          React.createElement('div', { className: 'form-check mb-2' },
            React.createElement('input', {
              type: 'checkbox',
              id: 'emailNotifications',
              name: 'emailNotifications',
              className: 'form-check-input',
              checked: notificationSettings.emailNotifications,
              onChange: handleNotificationChange
            }),
            React.createElement('label', { htmlFor: 'emailNotifications', className: 'form-check-label' }, 
              'Email notifications'
            )
          ),
          
          // Reminder notifications
          React.createElement('div', { className: 'form-check mb-2' },
            React.createElement('input', {
              type: 'checkbox',
              id: 'reminderNotifications',
              name: 'reminderNotifications',
              className: 'form-check-input',
              checked: notificationSettings.reminderNotifications,
              onChange: handleNotificationChange
            }),
            React.createElement('label', { htmlFor: 'reminderNotifications', className: 'form-check-label' }, 
              'Timer reminders'
            )
          ),
          
          // Invoice notifications
          React.createElement('div', { className: 'form-check mb-4' },
            React.createElement('input', {
              type: 'checkbox',
              id: 'invoiceNotifications',
              name: 'invoiceNotifications',
              className: 'form-check-input',
              checked: notificationSettings.invoiceNotifications,
              onChange: handleNotificationChange
            }),
            React.createElement('label', { htmlFor: 'invoiceNotifications', className: 'form-check-label' }, 
              'Invoice status updates'
            )
          ),
          
          // Theme settings
          React.createElement('h3', { className: 'mb-3' }, 'Theme'),
          React.createElement('div', { className: 'form-group' },
            React.createElement('select', {
              id: 'theme',
              className: 'form-control',
              value: theme,
              onChange: handleThemeChange
            },
              React.createElement('option', { value: 'light' }, 'Light Theme'),
              React.createElement('option', { value: 'dark' }, 'Dark Theme')
            )
          ),
          
          // Save button
          React.createElement('div', { className: 'form-group mt-4' },
            React.createElement('button', { 
              type: 'submit', 
              className: 'btn btn-primary',
              disabled: isLoading
            }, isLoading ? 'Saving...' : 'Save Preferences')
          )
        )
      )
    ),
    
    // Import tools section
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Import Tools')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('p', null, 'Import legacy Harvest time CSVs when you need to migrate or resync older data.'),
        React.createElement('button', {
          className: 'btn btn-secondary',
          onClick: () => window.handleNavigation('harvest-import')
        },
          React.createElement('i', { className: 'bi bi-upload me-2' }),
          'Open Harvest Import'
        )
      )
    ),
    
    // User Management section (only for admins)
    user && user.role === 'admin' && React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'User Management')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('p', null, 'As an administrator, you can manage users in the system. Add new users, edit existing ones, or remove users as needed.'),
        React.createElement('button', {
          className: 'btn btn-primary',
          onClick: () => window.handleNavigation('user-management')
        }, 'Manage Users')
      )
    )
  );
}

// Make Settings component globally available
window.Settings = Settings;
