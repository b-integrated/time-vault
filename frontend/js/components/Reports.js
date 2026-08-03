// Reports component for generating and viewing reports

function Reports({ user }) {
  // State for report data
  const [reportType, setReportType] = React.useState('time');
  const [dateRange, setDateRange] = React.useState('week');
  const [startDate, setStartDate] = React.useState(formatDateForInput(getStartDate('week')));
  const [endDate, setEndDate] = React.useState(formatDateForInput(new Date()));
  const [clientFilter, setClientFilter] = React.useState('all');
  const [projectFilter, setProjectFilter] = React.useState('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = React.useState('all');
  const [reportData, setReportData] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [projects, setProjects] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [showReport, setShowReport] = React.useState(false);
  const [isExportingPDF, setIsExportingPDF] = React.useState(false);
  
  // API URL
  const API_URL = '/api';
  
  // Format date for input field
  function formatDateForInput(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();
    
    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;
    
    return [year, month, day].join('-');
  }
  
  // Format date for display
  function formatDateForDisplay(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }
  
  // Format currency
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
  
  // Format duration
  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  function getEntryBillableAmount(entry) {
    if (!entry.billable || !entry.project || !entry.project.rate) {
      return 0;
    }

    return (entry.duration / 3600) * entry.project.rate;
  }
  
  // Get start date based on range
  function getStartDate(range) {
    const now = new Date();
    const startDate = new Date(now);
    
    switch (range) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1); // Start of month
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'year':
        startDate.setMonth(0, 1); // Start of year
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setDate(now.getDate() - 7); // Last 7 days
        startDate.setHours(0, 0, 0, 0);
    }
    
    return startDate;
  }
  
  // Handle date range change
  const handleDateRangeChange = (e) => {
    const range = e.target.value;
    setDateRange(range);
    
    if (range !== 'custom') {
      setStartDate(formatDateForInput(getStartDate(range)));
      setEndDate(formatDateForInput(new Date()));
    }
  };
  
  // Fetch clients and projects on component mount
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
  
  function buildReportQueryParams() {
    let queryParams = new URLSearchParams({
      startDate: startDate,
      endDate: endDate,
      type: reportType
    });
    
    if (clientFilter !== 'all') {
      queryParams.append('clientId', clientFilter);
    }
    
    if (projectFilter !== 'all') {
      queryParams.append('projectId', projectFilter);
    }
    if (reportType === 'invoice' && invoiceStatusFilter !== 'all') {
      queryParams.append('status', invoiceStatusFilter);
    }

    return queryParams;
  }

  const exportInvoicePDF = (invoice) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/invoices/${invoice.id}/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to export invoice PDF');
      }
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setError('');
    })
    .catch(error => {
      console.error('Error exporting invoice PDF:', error);
      setError('Failed to export invoice PDF');
    });
  };

  // Generate report
  const generateReport = () => {
    setShowReport(false);
    setIsLoading(true);
    setError('');
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Fetch report data
    fetch(`${API_URL}/reports?${buildReportQueryParams().toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      return response.json();
    })
    .then(data => {
      setReportData(data);
      setShowReport(true);
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error generating report:', error);
      setError('Failed to generate report');
      setIsLoading(false);
    });
  };

  const exportReportPDF = () => {
    setIsExportingPDF(true);
    setError('');

    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/reports/pdf?${buildReportQueryParams().toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to export report PDF');
      }
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}-report-${startDate}-to-${endDate}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setIsExportingPDF(false);
    })
    .catch(error => {
      console.error('Error exporting report PDF:', error);
      setError('Failed to export report PDF');
      setIsExportingPDF(false);
    });
  };
  
  // Get client name by ID
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };
  
  // Get project name by ID
  const getProjectName = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  };
  
  // Render time report
  const renderTimeReport = () => {
    if (!reportData || reportData.length === 0) {
      return React.createElement('p', null, 'No data available for the selected criteria');
    }
    
    // Group data by client and project
    const groupedData = {};
    let totalDuration = 0;
    let totalBillableDuration = 0;
    let totalBillableAmount = 0;
    
    reportData.forEach(entry => {
      const clientId = entry.project.clientId;
      const projectId = entry.projectId;
      const clientName = getClientName(clientId);
      const projectName = getProjectName(projectId);
      const billableAmount = getEntryBillableAmount(entry);
      
      if (!groupedData[clientId]) {
        groupedData[clientId] = {
          name: clientName,
          projects: {},
          totalDuration: 0,
          billableDuration: 0,
          billableAmount: 0
        };
      }
      
      if (!groupedData[clientId].projects[projectId]) {
        groupedData[clientId].projects[projectId] = {
          name: projectName,
          entries: [],
          totalDuration: 0,
          billableDuration: 0,
          billableAmount: 0
        };
      }
      
      groupedData[clientId].projects[projectId].entries.push(entry);
      groupedData[clientId].projects[projectId].totalDuration += entry.duration;
      groupedData[clientId].totalDuration += entry.duration;
      totalDuration += entry.duration;

      if (entry.billable) {
        groupedData[clientId].projects[projectId].billableDuration += entry.duration;
        groupedData[clientId].projects[projectId].billableAmount += billableAmount;
        groupedData[clientId].billableDuration += entry.duration;
        groupedData[clientId].billableAmount += billableAmount;
        totalBillableDuration += entry.duration;
        totalBillableAmount += billableAmount;
      }
    });
    
    // Create report elements
    return React.createElement('div', { className: 'time-report' },
      React.createElement('h3', null, 'Time Report'),
      React.createElement('div', { className: 'report-summary' },
        React.createElement('div', { className: 'daily-summary-item' },
          React.createElement('span', null, 'Period'),
          React.createElement('strong', null, `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`)
        ),
        React.createElement('div', { className: 'daily-summary-item' },
          React.createElement('span', null, 'Total Time'),
          React.createElement('strong', null, formatDuration(totalDuration))
        ),
        React.createElement('div', { className: 'daily-summary-item' },
          React.createElement('span', null, 'Billable Time'),
          React.createElement('strong', null, formatDuration(totalBillableDuration))
        ),
        React.createElement('div', { className: 'daily-summary-item billable-value-summary' },
          React.createElement('span', null, 'Billable Value'),
          React.createElement('strong', null, formatCurrency(totalBillableAmount))
        )
      ),
      
      // Clients and projects
      Object.keys(groupedData).map(clientId => {
        const client = groupedData[clientId];
        
        return React.createElement('section', { key: clientId, className: 'report-client-group' },
          React.createElement('div', { className: 'report-group-header' },
            React.createElement('h4', null, client.name),
            React.createElement('span', null,
              React.createElement('strong', null, formatCurrency(client.billableAmount)),
              React.createElement('small', null, `${formatDuration(client.totalDuration)} total / ${formatDuration(client.billableDuration)} billable`)
            )
          ),
          
          // Projects for this client
          Object.keys(client.projects).map(projectId => {
            const project = client.projects[projectId];
            
            return React.createElement('div', { key: projectId, className: 'report-project-card' },
              React.createElement('div', { className: 'report-group-header project-header' },
                React.createElement('h5', null, project.name),
                React.createElement('span', null,
                  React.createElement('strong', null, formatCurrency(project.billableAmount)),
                  React.createElement('small', null, `${formatDuration(project.totalDuration)} total / ${formatDuration(project.billableDuration)} billable`)
                )
              ),
              React.createElement('div', { className: 'entry-list report-entry-list' },
                project.entries.map(entry =>
                  React.createElement('article', { className: 'entry-card', key: entry.id },
                    React.createElement('div', { className: 'entry-card-main' },
                      React.createElement('div', { className: 'entry-date' }, formatDateForDisplay(entry.startTime)),
                      React.createElement('div', { className: 'entry-description' }, entry.description || 'No description'),
                      React.createElement('div', { className: 'entry-meta' },
                        entry.billable
                          ? `${formatCurrency(getEntryBillableAmount(entry))} billable at ${formatCurrency(entry.project.rate || 0)}/hr`
                          : 'Non-billable'
                      )
                    ),
                    React.createElement('div', { className: 'entry-duration' }, formatDuration(entry.duration))
                  )
                )
              )
            );
          })
        );
      })
    );
  };
  
  // Render invoice report
  const renderInvoiceReport = () => {
    if (!reportData || reportData.length === 0) {
      return React.createElement('p', null, 'No data available for the selected criteria');
    }
    
    // Group data by client
    const groupedData = {};
    let totalAmount = 0;
    let paidAmount = 0;
    let dueAmount = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    
    reportData.forEach(invoice => {
      const clientId = invoice.clientId;
      const clientName = getClientName(clientId);
      
      if (!groupedData[clientId]) {
        groupedData[clientId] = {
          name: clientName,
          invoices: [],
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0
        };
      }
      
      groupedData[clientId].invoices.push(invoice);
      groupedData[clientId].totalAmount += invoice.total;
      totalAmount += invoice.total;
      if (invoice.status === 'paid') {
        paidAmount += invoice.total;
        groupedData[clientId].paidAmount += invoice.total;
        paidCount += 1;
      } else {
        const invoiceDue = invoice.dueAmount || 0;
        dueAmount += invoiceDue;
        groupedData[clientId].dueAmount += invoiceDue;
        unpaidCount += 1;
      }
    });
    
    // Create report elements
    return React.createElement('div', { className: 'invoice-report' },
      React.createElement('h3', null, 'Invoice Report'),
      React.createElement('div', { className: 'report-summary' },
        React.createElement('div', { className: 'daily-summary-item' },
          React.createElement('span', null, 'Period'),
          React.createElement('strong', null, `${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)}`)
        ),
        React.createElement('div', { className: 'daily-summary-item' },
          React.createElement('span', null, 'Total Value'),
          React.createElement('strong', null, formatCurrency(totalAmount))
        ),
        React.createElement('div', { className: 'daily-summary-item' },
          React.createElement('span', null, 'Paid'),
          React.createElement('strong', null, `${paidCount} / ${formatCurrency(paidAmount)}`)
        ),
        React.createElement('div', { className: 'daily-summary-item billable-value-summary' },
          React.createElement('span', null, 'Open / Draft Due'),
          React.createElement('strong', null, `${unpaidCount} / ${formatCurrency(dueAmount)}`)
        )
      ),
      
      // Clients and invoices
      Object.keys(groupedData).map(clientId => {
        const client = groupedData[clientId];
        
        return React.createElement('section', { key: clientId, className: 'report-client-group' },
          React.createElement('div', { className: 'report-group-header' },
            React.createElement('h4', null, client.name),
            React.createElement('span', null,
              React.createElement('strong', null, formatCurrency(client.totalAmount)),
              React.createElement('small', null, `${formatCurrency(client.paidAmount)} paid / ${formatCurrency(client.dueAmount)} due`)
            )
          ),
          React.createElement('div', { className: 'entry-list report-entry-list' },
            client.invoices.map(invoice =>
              React.createElement('article', { className: 'entry-card', key: invoice.id },
                React.createElement('div', { className: 'entry-card-main' },
                  React.createElement('div', { className: 'entry-date' }, formatDateForDisplay(invoice.issueDate)),
                  React.createElement('div', { className: 'entry-project' }, invoice.number),
                  React.createElement('div', { className: 'entry-description' }, `${invoice.status} - due ${formatDateForDisplay(invoice.dueDate)}`),
                  React.createElement('div', { className: 'entry-meta' },
                    `Total ${formatCurrency(invoice.total)} / Due ${formatCurrency(invoice.dueAmount || 0)}${invoice.paidDate ? ` / Paid ${formatDateForDisplay(invoice.paidDate)}` : ''}`
                  ),
                  invoice.subject && React.createElement('div', { className: 'entry-meta' }, invoice.subject)
                ),
                React.createElement('div', { className: 'entry-card-actions' },
                  React.createElement('div', { className: 'entry-duration' }, formatCurrency(invoice.total)),
                  React.createElement('button', {
                    type: 'button',
                    className: 'btn btn-sm btn-secondary',
                    onClick: () => exportInvoicePDF(invoice)
                  }, 'PDF')
                )
              )
            )
          )
        );
      })
    );
  };
  
  // Render loading state
  if (isLoading && !showReport) {
    return React.createElement('div', { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading...')
    );
  }
  
  // Render reports
  return React.createElement('div', { className: 'reports' },
    React.createElement('h1', null, 'Reports'),
    
    // Error message
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    
    // Report filters
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Generate Report')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', { onSubmit: (e) => { e.preventDefault(); generateReport(); } },
          // Report type
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'report-type', className: 'form-label' }, 'Report Type'),
            React.createElement('select', {
              id: 'report-type',
              className: 'form-control',
              value: reportType,
              onChange: (e) => setReportType(e.target.value)
            },
              React.createElement('option', { value: 'time' }, 'Time Report'),
              React.createElement('option', { value: 'invoice' }, 'Invoice Report')
            )
          ),
          
          // Date range
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'date-range', className: 'form-label' }, 'Date Range'),
            React.createElement('select', {
              id: 'date-range',
              className: 'form-control',
              value: dateRange,
              onChange: handleDateRangeChange
            },
              React.createElement('option', { value: 'today' }, 'Today'),
              React.createElement('option', { value: 'week' }, 'This Week'),
              React.createElement('option', { value: 'month' }, 'This Month'),
              React.createElement('option', { value: 'year' }, 'This Year'),
              React.createElement('option', { value: 'custom' }, 'Custom Range')
            )
          ),
          
          // Custom date range
          React.createElement('div', { className: 'row' },
            React.createElement('div', { className: 'col-md-6' },
              React.createElement('div', { className: 'form-group' },
                React.createElement('label', { htmlFor: 'start-date', className: 'form-label' }, 'Start Date'),
                React.createElement('input', {
                  type: 'date',
                  id: 'start-date',
                  className: 'form-control',
                  value: startDate,
                  onChange: (e) => setStartDate(e.target.value),
                  disabled: dateRange !== 'custom'
                })
              )
            ),
            React.createElement('div', { className: 'col-md-6' },
              React.createElement('div', { className: 'form-group' },
                React.createElement('label', { htmlFor: 'end-date', className: 'form-label' }, 'End Date'),
                React.createElement('input', {
                  type: 'date',
                  id: 'end-date',
                  className: 'form-control',
                  value: endDate,
                  onChange: (e) => setEndDate(e.target.value),
                  disabled: dateRange !== 'custom'
                })
              )
            )
          ),
          
          // Client filter
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'client-filter', className: 'form-label' }, 'Client'),
            React.createElement('select', {
              id: 'client-filter',
              className: 'form-control',
              value: clientFilter,
              onChange: (e) => setClientFilter(e.target.value)
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
          
          // Project filter (only for time reports)
          reportType === 'time' && React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'project-filter', className: 'form-label' }, 'Project'),
            React.createElement('select', {
              id: 'project-filter',
              className: 'form-control',
              value: projectFilter,
              onChange: (e) => setProjectFilter(e.target.value)
            },
              React.createElement('option', { value: 'all' }, 'All Projects'),
              projects
                .filter(project => clientFilter === 'all' || project.clientId === parseInt(clientFilter))
                .map(project => 
                  React.createElement('option', { 
                    key: project.id, 
                    value: project.id 
                  }, project.name)
              )
            )
          ),

          reportType === 'invoice' && React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'invoice-status-filter', className: 'form-label' }, 'Invoice Status'),
            React.createElement('select', {
              id: 'invoice-status-filter',
              className: 'form-control',
              value: invoiceStatusFilter,
              onChange: (e) => setInvoiceStatusFilter(e.target.value)
            },
              React.createElement('option', { value: 'all' }, 'All Statuses'),
              React.createElement('option', { value: 'draft' }, 'Draft'),
              React.createElement('option', { value: 'open' }, 'Open'),
              React.createElement('option', { value: 'paid' }, 'Paid')
            )
          ),
          
          // Generate button
          React.createElement('div', { className: 'form-group' },
            React.createElement('button', { 
              type: 'submit', 
              className: 'btn btn-primary' 
            }, 'Generate Report')
          )
        )
      )
    ),
    
    // Report results
    showReport && React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Report Results'),
        React.createElement('button', {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: exportReportPDF,
          disabled: isLoading || isExportingPDF || !reportData || reportData.length === 0
        }, isExportingPDF ? 'Exporting...' : 'Export PDF')
      ),
      React.createElement('div', { className: 'card-body' },
        isLoading 
          ? React.createElement('div', { className: 'loading-container' },
              React.createElement('div', { className: 'loading-spinner' }),
              React.createElement('p', null, 'Generating report...')
            )
          : reportType === 'time' 
            ? renderTimeReport() 
            : renderInvoiceReport()
      )
    )
  );
}

// Make Reports component globally available
window.Reports = Reports;
