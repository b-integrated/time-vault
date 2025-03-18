// Main App component for TimeVault

// App component
function App() {
  // State for authentication and current page
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState(null);
  const [currentPage, setCurrentPage] = React.useState('login');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = React.useState(false);
  
  // API URL
  const API_URL = 'http://localhost:8080/api';
  
  // Check if user is authenticated on component mount
  React.useEffect(() => {
    // First, check if any users exist in the system
    fetch(`${API_URL}/auth/check-users`)
      .then(response => response.json())
      .then(data => {
        if (data.usersExist === false) {
          // No users exist, show first-time setup
          setIsFirstTimeSetup(true);
          setIsLoading(false);
          return;
        }
        
        // Users exist, proceed with normal authentication flow
        // Check for token in localStorage
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        
        if (token && user) {
          // Validate token with the server
          fetch(`${API_URL}/auth/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          })
          .then(response => {
            if (response.ok) {
              // Token is valid
              setIsAuthenticated(true);
              setCurrentUser(user);
              setCurrentPage('dashboard');
            } else {
              // Token is invalid, clear localStorage
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setCurrentPage('login');
            }
            setIsLoading(false);
          })
          .catch(error => {
            console.error('Error validating token:', error);
            setIsLoading(false);
            setCurrentPage('login');
          });
        } else {
          setIsLoading(false);
          setCurrentPage('login');
        }
      })
      .catch(error => {
        console.error('Error checking if users exist:', error);
        setIsLoading(false);
        setCurrentPage('login');
      });
  }, []);
  
  // Handle login
  const handleLogin = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setIsAuthenticated(true);
    setCurrentUser(user);
    setCurrentPage('dashboard');
  };
  
  // Handle first-time setup completion
  const handleSetupComplete = (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setIsFirstTimeSetup(false);
    setIsAuthenticated(true);
    setCurrentUser(user);
    setCurrentPage('dashboard');
  };
  
  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentPage('login');
  };
  
  // Handle navigation
  const handleNavigation = (page) => {
    setCurrentPage(page);
  };
  
  // Expose handleNavigation to window for access from other components
  window.handleNavigation = handleNavigation;
  
  // Render loading state
  if (isLoading) {
    return React.createElement('div', { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading...')
    );
  }
  
  // Render first-time setup page if no users exist
  if (isFirstTimeSetup) {
    return React.createElement(FirstTimeSetup, {
      onSetupComplete: handleSetupComplete
    });
  }
  
  // Render login/register page if not authenticated
  if (!isAuthenticated) {
    return React.createElement(Auth, {
      onLogin: handleLogin
    });
  }
  
  // Render main application
  return React.createElement(React.Fragment, null,
    // Header
    React.createElement('header', { className: 'app-header' },
      React.createElement('div', { className: 'container' },
        React.createElement('a', { href: '#', className: 'logo' }, 'TimeVault'),
        React.createElement('div', { className: 'user-menu' },
          React.createElement('span', { className: 'user-name' }, currentUser ? currentUser.name : ''),
          React.createElement('button', { 
            className: 'btn btn-secondary', 
            onClick: handleLogout 
          }, 'Logout')
        )
      )
    ),
    
    // Navigation
    React.createElement('nav', { className: 'main-nav' },
      React.createElement('div', { className: 'container' },
        React.createElement('ul', { className: 'nav-list' },
          React.createElement('li', { className: 'nav-item' },
            React.createElement('a', { 
              href: '#', 
              className: `nav-link ${currentPage === 'dashboard' ? 'active' : ''}`,
              onClick: (e) => {
                e.preventDefault();
                handleNavigation('dashboard');
              }
            }, 'Dashboard')
          ),
          React.createElement('li', { className: 'nav-item' },
            React.createElement('a', { 
              href: '#', 
              className: `nav-link ${currentPage === 'time-tracker' ? 'active' : ''}`,
              onClick: (e) => {
                e.preventDefault();
                handleNavigation('time-tracker');
              }
            }, 'Time Tracker')
          ),
          React.createElement('li', { className: 'nav-item' },
            React.createElement('a', { 
              href: '#', 
              className: `nav-link ${currentPage === 'projects' ? 'active' : ''}`,
              onClick: (e) => {
                e.preventDefault();
                handleNavigation('projects');
              }
            }, 'Projects')
          ),
          React.createElement('li', { className: 'nav-item' },
            React.createElement('a', { 
              href: '#', 
              className: `nav-link ${currentPage === 'clients' ? 'active' : ''}`,
              onClick: (e) => {
                e.preventDefault();
                handleNavigation('clients');
              }
            }, 'Clients')
          ),
          React.createElement('li', { className: 'nav-item' },
            React.createElement('a', { 
              href: '#', 
              className: `nav-link ${currentPage === 'invoices' ? 'active' : ''}`,
              onClick: (e) => {
                e.preventDefault();
                handleNavigation('invoices');
              }
            }, 'Invoices')
          ),
          React.createElement('li', { className: 'nav-item' },
            React.createElement('a', { 
              href: '#', 
              className: `nav-link ${currentPage === 'reports' ? 'active' : ''}`,
              onClick: (e) => {
                e.preventDefault();
                handleNavigation('reports');
              }
            }, 'Reports')
          ),
          React.createElement('li', { className: 'nav-item' },
            React.createElement('a', { 
              href: '#', 
              className: `nav-link ${currentPage === 'settings' ? 'active' : ''}`,
              onClick: (e) => {
                e.preventDefault();
                handleNavigation('settings');
              }
            }, 'Settings')
          )
        )
      )
    ),
    
    // Main content
    React.createElement('main', { className: 'main-content' },
      React.createElement('div', { className: 'container' },
        // Render different components based on current page
        currentPage === 'dashboard' && React.createElement(Dashboard, { user: currentUser }),
        currentPage === 'time-tracker' && React.createElement(TimeTracker, { user: currentUser }),
        currentPage === 'projects' && React.createElement(Projects, { user: currentUser }),
        currentPage === 'clients' && React.createElement(Clients, { user: currentUser }),
        currentPage === 'invoices' && React.createElement(Invoices, { user: currentUser }),
        currentPage === 'reports' && React.createElement(Reports, { user: currentUser }),
        currentPage === 'settings' && React.createElement(Settings, { user: currentUser }),
        currentPage === 'user-management' && currentUser && currentUser.role === 'admin' && 
          React.createElement(UserManagement, { user: currentUser })
      )
    ),
    
    // Footer
    React.createElement('footer', { className: 'app-footer' },
      React.createElement('div', { className: 'container' },
        React.createElement('p', null, '© 2025 TimeVault. All rights reserved.')
      )
    )
  );
}

// Make App component globally available
window.App = App;