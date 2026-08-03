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
  const API_URL = '/api';

  const clearStoredSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentPage('login');
  };
  
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
          fetch(`${API_URL}/projects`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          .then(response => {
            if (response.status === 401) {
              clearStoredSession();
              setIsLoading(false);
              return;
            }

            setIsAuthenticated(true);
            setCurrentUser(user);
            setCurrentPage('dashboard');
            setIsLoading(false);
          })
          .catch(error => {
            console.error('Error validating stored session:', error);
            setIsAuthenticated(true);
            setCurrentUser(user);
            setCurrentPage('dashboard');
            setIsLoading(false);
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
    clearStoredSession();
  };
  
  // Handle navigation
  const handleNavigation = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Expose handleNavigation to window for access from other components
  window.handleNavigation = handleNavigation;
  window.handleUnauthorized = clearStoredSession;
  
  const navItems = [
    { page: 'dashboard', label: 'Dashboard', icon: 'bi-speedometer2' },
    { page: 'time-tracker', label: 'Time', icon: 'bi-stopwatch' },
    { page: 'projects', label: 'Projects', icon: 'bi-kanban' },
    { page: 'clients', label: 'Clients', icon: 'bi-buildings' },
    { page: 'invoices', label: 'Invoices', icon: 'bi-receipt' },
    { page: 'reports', label: 'Reports', icon: 'bi-bar-chart' },
    { page: 'settings', label: 'Settings', icon: 'bi-gear' }
  ];
  
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
  return React.createElement('div', { className: 'app-shell' },
    // Header
    React.createElement('header', { className: 'app-header' },
      React.createElement('div', { className: 'container' },
        React.createElement('a', { href: '#', className: 'logo', onClick: (e) => {
          e.preventDefault();
          handleNavigation('dashboard');
        } },
          React.createElement('img', { className: 'logo-image', src: 'images/time-vault-logo-192.png?v=20260803-1348', alt: '' }),
          React.createElement('span', { className: 'logo-text' }, 'TimeVault')
        ),
        React.createElement('div', { className: 'user-menu' },
          React.createElement('span', { className: 'user-name' }, currentUser ? currentUser.name : ''),
          React.createElement('button', { 
            className: 'btn btn-secondary logout-btn', 
            onClick: handleLogout 
          },
            React.createElement('i', { className: 'bi bi-box-arrow-right' }),
            React.createElement('span', null, 'Logout')
          )
        )
      )
    ),
    
    // Navigation
    React.createElement('nav', { className: 'main-nav' },
      React.createElement('div', { className: 'container' },
        React.createElement('ul', { className: 'nav-list' },
          navItems.map(item =>
            React.createElement('li', { className: 'nav-item', key: item.page },
              React.createElement('a', { 
                href: '#', 
                className: `nav-link ${currentPage === item.page ? 'active' : ''}`,
                onClick: (e) => {
                  e.preventDefault();
                  handleNavigation(item.page);
                }
              },
                React.createElement('i', { className: `bi ${item.icon} nav-icon` }),
                React.createElement('span', null, item.label)
              )
            )
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
        currentPage === 'harvest-import' && React.createElement(HarvestImport, { user: currentUser }),
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
