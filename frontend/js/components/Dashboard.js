// Dashboard component for TimeVault

function Dashboard({ user }) {
  // State for dashboard data
  const [stats, setStats] = React.useState({
    hoursThisWeek: 0,
    hoursThisMonth: 0,
    activeProjects: 0,
    pendingInvoices: 0,
    totalEarnings: 0,
    lastMonthInvoiced: 0,
    lastMonthLabel: ''
  });
  const [recentEntries, setRecentEntries] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  
  // API URL
  const API_URL = '/api';

  const getInvoiceTotal = (invoice) => {
    if (invoice.total != null) return Number(invoice.total) || 0;
    if (invoice.amount != null) return Number(invoice.amount) || 0;
    return 0;
  };

  const handleApiResponse = (response, message) => {
    if (response.status === 401 && window.handleUnauthorized) {
      window.handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!response.ok) {
      throw new Error(message);
    }
    return response.json();
  };
  
  // Fetch dashboard data on component mount
  React.useEffect(() => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    const now = new Date();
    const calculatedStats = {
      hoursThisWeek: 0,
      hoursThisMonth: 0
    };
    
    // Fetch user's time entries
    fetch(`${API_URL}/users/${user.id}/time-entries`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => handleApiResponse(response, 'Failed to fetch time entries'))
    .then(timeEntries => {
      // Calculate stats
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Calculate hours this week
      calculatedStats.hoursThisWeek = timeEntries
        .filter(entry => new Date(entry.startTime) >= startOfWeek)
        .reduce((total, entry) => total + (entry.duration / 3600), 0);
      
      // Calculate hours this month
      calculatedStats.hoursThisMonth = timeEntries
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
    .then(response => handleApiResponse(response, 'Failed to fetch projects'))
    .then(projects => {
      // Count active projects
      const activeProjects = projects.filter(project => project.status === 'active').length;
      
      // Fetch invoices
      return fetch(`${API_URL}/invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => handleApiResponse(response, 'Failed to fetch invoices'))
      .then(invoices => {
        // Count pending invoices
        const pendingInvoices = invoices.filter(invoice => ['draft', 'sent', 'open'].includes(invoice.status)).length;
        
        // Calculate total earnings (from paid invoices)
        const totalEarnings = invoices
          .filter(invoice => invoice.status === 'paid')
          .reduce((total, invoice) => total + getInvoiceTotal(invoice), 0);

        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthLabel = lastMonthStart.toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric'
        });
        const lastMonthInvoiced = invoices
          .filter(invoice => {
            const issueDate = new Date(invoice.issueDate);
            return issueDate >= lastMonthStart && issueDate < thisMonthStart;
          })
          .reduce((total, invoice) => total + getInvoiceTotal(invoice), 0);
        
        // Update stats
        setStats({
          hoursThisWeek: Math.round(calculatedStats.hoursThisWeek * 10) / 10,
          hoursThisMonth: Math.round(calculatedStats.hoursThisMonth * 10) / 10,
          activeProjects,
          pendingInvoices,
          totalEarnings,
          lastMonthInvoiced,
          lastMonthLabel
        });
        
        setIsLoading(false);
      });
    })
    .catch(error => {
      if (error.message === 'Unauthorized') return;
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
  const firstName = (user.name || 'there').split(' ')[0];
  
  return React.createElement('div', { className: 'dashboard' },
    // Welcome message
    React.createElement('div', { className: 'welcome-message mb-4' },
      React.createElement('div', { className: 'eyebrow' }, 'Dashboard'),
      React.createElement('h1', null, `Welcome back, ${firstName}`),
      React.createElement('p', null, 'Time, invoices, and billing work in one place.')
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

      // Last month invoiced
      React.createElement('div', { className: 'stat-card' },
        React.createElement('div', { className: 'stat-title' }, 'Last Month Invoiced'),
        React.createElement('div', { className: 'stat-value' }, formatCurrency(stats.lastMonthInvoiced)),
        React.createElement('div', { className: 'stat-description' }, stats.lastMonthLabel || 'Previous calendar month')
      ),
      
      // Total earnings
      React.createElement('div', { className: 'stat-card' },
        React.createElement('div', { className: 'stat-title' }, 'Total Paid'),
        React.createElement('div', { className: 'stat-value' }, formatCurrency(stats.totalEarnings)),
        React.createElement('div', { className: 'stat-description' }, 'All paid invoices')
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
          : React.createElement('div', { className: 'entry-list' },
              recentEntries.map(entry =>
                React.createElement('article', { className: 'entry-card', key: entry.id },
                  React.createElement('div', { className: 'entry-card-main' },
                    React.createElement('div', { className: 'entry-date' }, formatDate(entry.startTime)),
                    React.createElement('div', { className: 'entry-project' }, entry.project ? entry.project.name : `Project ${entry.projectId}`),
                    React.createElement('div', { className: 'entry-description' }, entry.description || 'No description')
                  ),
                  React.createElement('div', { className: 'entry-duration' }, formatDuration(entry.duration))
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
          onClick: () => window.handleNavigation('time-tracker')
        },
          React.createElement('i', { className: 'bi bi-play-fill' }),
          React.createElement('span', null, 'Start Timer')
        ),
        React.createElement('button', { 
          className: 'btn btn-secondary mr-2',
          onClick: () => window.handleNavigation('invoices')
        },
          React.createElement('i', { className: 'bi bi-receipt' }),
          React.createElement('span', null, 'Invoice')
        ),
        React.createElement('button', { 
          className: 'btn btn-secondary',
          onClick: () => window.handleNavigation('reports')
        },
          React.createElement('i', { className: 'bi bi-bar-chart' }),
          React.createElement('span', null, 'Reports')
        )
      )
    )
  );
}

// Make Dashboard component globally available
window.Dashboard = Dashboard;
