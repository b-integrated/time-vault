// Dashboard component for TimeVault

function Dashboard({ user }) {
  // State for dashboard data
  const [stats, setStats] = React.useState({
    hoursThisWeek: 0,
    hoursThisMonth: 0,
    activeProjects: 0,
    pendingInvoices: 0,
    totalEarnings: 0
  });
  const [recentEntries, setRecentEntries] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  
  // API URL
  const API_URL = 'http://localhost:8080/api';
  
  // Fetch dashboard data on component mount
  React.useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Fetch user's time entries
    fetch(`${API_URL}/users/${user.id}/time-entries`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch time entries');
      }
      return response.json();
    })
    .then(timeEntries => {
      // Calculate stats
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Calculate hours this week
      const hoursThisWeek = timeEntries
        .filter(entry => new Date(entry.startTime) >= startOfWeek)
        .reduce((total, entry) => total + (entry.duration / 3600), 0);
      
      // Calculate hours this month
      const hoursThisMonth = timeEntries
        .filter(entry => new Date(entry.startTime) >= startOfMonth)
        .reduce((total, entry) => total + (entry.duration / 3600), 0);
      
      // Get recent entries (last 5)
      const recent = timeEntries
        .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
        .slice(0, 5);
      
      setRecentEntries(recent);
      
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
    .then(projects => {
      // Count active projects
      const activeProjects = projects.filter(project => project.status === 'active').length;
      
      // Fetch invoices
      return fetch(`${API_URL}/invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch invoices');
        }
        return response.json();
      })
      .then(invoices => {
        // Count pending invoices
        const pendingInvoices = invoices.filter(invoice => invoice.status === 'draft' || invoice.status === 'sent').length;
        
        // Calculate total earnings (from paid invoices)
        const totalEarnings = invoices
          .filter(invoice => invoice.status === 'paid')
          .reduce((total, invoice) => total + invoice.total, 0);
        
        // Update stats
        setStats({
          hoursThisWeek: Math.round(stats.hoursThisWeek * 10) / 10,
          hoursThisMonth: Math.round(stats.hoursThisMonth * 10) / 10,
          activeProjects,
          pendingInvoices,
          totalEarnings
        });
        
        setIsLoading(false);
      });
    })
    .catch(error => {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
      setIsLoading(false);
    });
  }, [user.id]);
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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
  
  // Format duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };
  
  // Render loading state
  if (isLoading) {
    return React.createElement('div', { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading dashboard...')
    );
  }
  
  // Render error state
  if (error) {
    return React.createElement('div', { className: 'error-container' },
      React.createElement('p', { className: 'error-message' }, error),
      React.createElement('button', {
        className: 'btn btn-primary',
        onClick: () => window.location.reload()
      }, 'Retry')
    );
  }
  
  // Render dashboard
  return React.createElement('div', { className: 'dashboard' },
    // Welcome message
    React.createElement('div', { className: 'welcome-message mb-4' },
      React.createElement('h1', null, `Welcome back, ${user.name}!`),
      React.createElement('p', null, 'Here\'s an overview of your time tracking and invoicing.')
    ),
    
    // Stats cards
    React.createElement('div', { className: 'dashboard-stats' },
      // Hours this week
      React.createElement('div', { className: 'stat-card' },
        React.createElement('div', { className: 'stat-title' }, 'Hours This Week'),
        React.createElement('div', { className: 'stat-value' }, stats.hoursThisWeek),
        React.createElement('div', { className: 'stat-description' }, 'Total hours tracked this week')
      ),
      
      // Hours this month
      React.createElement('div', { className: 'stat-card' },
        React.createElement('div', { className: 'stat-title' }, 'Hours This Month'),
        React.createElement('div', { className: 'stat-value' }, stats.hoursThisMonth),
        React.createElement('div', { className: 'stat-description' }, 'Total hours tracked this month')
      ),
      
      // Active projects
      React.createElement('div', { className: 'stat-card' },
        React.createElement('div', { className: 'stat-title' }, 'Active Projects'),
        React.createElement('div', { className: 'stat-value' }, stats.activeProjects),
        React.createElement('div', { className: 'stat-description' }, 'Number of active projects')
      ),
      
      // Pending invoices
      React.createElement('div', { className: 'stat-card' },
        React.createElement('div', { className: 'stat-title' }, 'Pending Invoices'),
        React.createElement('div', { className: 'stat-value' }, stats.pendingInvoices),
        React.createElement('div', { className: 'stat-description' }, 'Invoices awaiting payment')
      ),
      
      // Total earnings
      React.createElement('div', { className: 'stat-card' },
        React.createElement('div', { className: 'stat-title' }, 'Total Earnings'),
        React.createElement('div', { className: 'stat-value' }, formatCurrency(stats.totalEarnings)),
        React.createElement('div', { className: 'stat-description' }, 'Total earnings from paid invoices')
      )
    ),
    
    // Recent time entries
    React.createElement('div', { className: 'card mt-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Recent Time Entries')
      ),
      React.createElement('div', { className: 'card-body' },
        recentEntries.length === 0
          ? React.createElement('p', null, 'No recent time entries')
          : React.createElement('table', { className: 'table' },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', null, 'Date'),
                  React.createElement('th', null, 'Project'),
                  React.createElement('th', null, 'Description'),
                  React.createElement('th', null, 'Duration')
                )
              ),
              React.createElement('tbody', null,
                recentEntries.map(entry => 
                  React.createElement('tr', { key: entry.id },
                    React.createElement('td', null, formatDate(entry.startTime)),
                    React.createElement('td', null, entry.projectId), // Would show project name in a real app
                    React.createElement('td', null, entry.description || 'No description'),
                    React.createElement('td', null, formatDuration(entry.duration))
                  )
                )
              )
            )
      )
    ),
    
    // Quick actions
    React.createElement('div', { className: 'quick-actions mt-4' },
      React.createElement('h2', null, 'Quick Actions'),
      React.createElement('div', { className: 'action-buttons' },
        React.createElement('button', { 
          className: 'btn btn-primary mr-2',
          onClick: () => window.location.hash = '#time-tracker'
        }, 'Start Tracking Time'),
        React.createElement('button', { 
          className: 'btn btn-secondary mr-2',
          onClick: () => window.location.hash = '#invoices'
        }, 'Create Invoice'),
        React.createElement('button', { 
          className: 'btn btn-secondary',
          onClick: () => window.location.hash = '#reports'
        }, 'View Reports')
      )
    )
  );
}

// Make Dashboard component globally available
window.Dashboard = Dashboard;