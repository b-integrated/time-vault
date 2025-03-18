// Invoices component for managing invoices

function Invoices({ user }) {
  // State for invoices data
  const [invoices, setInvoices] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [timeEntries, setTimeEntries] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  
  // State for form
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentInvoice, setCurrentInvoice] = React.useState(null);
  const [formData, setFormData] = React.useState({
    clientId: '',
    number: '',
    issueDate: formatDateForInput(new Date()),
    dueDate: formatDateForInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days from now
    status: 'draft',
    notes: '',
    selectedTimeEntries: []
  });
  
  // State for filtering and sorting
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterClient, setFilterClient] = React.useState('all');
  const [sortField, setSortField] = React.useState('issueDate');
  const [sortDirection, setSortDirection] = React.useState('desc');
  
  // State for time entry selection
  const [showTimeEntrySelector, setShowTimeEntrySelector] = React.useState(false);
  
  // API URL
  const API_URL = 'http://localhost:8080/api';
  
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
  
  // Fetch invoices, clients, and time entries on component mount
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
      
      // Fetch invoices
      return fetch(`${API_URL}/invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      return response.json();
    })
    .then(data => {
      setInvoices(data);
      
      // Fetch time entries
      return fetch(`${API_URL}/time-entries?billable=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch time entries');
      }
      return response.json();
    })
    .then(data => {
      // Filter out time entries that are already invoiced
      const unbilledEntries = data.filter(entry => !entry.invoiceId);
      setTimeEntries(unbilledEntries);
      setIsLoading(false);
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
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
  
  // Handle time entry selection
  const handleTimeEntrySelection = (entryId) => {
    const selectedEntries = [...formData.selectedTimeEntries];
    
    if (selectedEntries.includes(entryId)) {
      // Remove entry if already selected
      const index = selectedEntries.indexOf(entryId);
      selectedEntries.splice(index, 1);
    } else {
      // Add entry if not selected
      selectedEntries.push(entryId);
    }
    
    setFormData({
      ...formData,
      selectedTimeEntries: selectedEntries
    });
  };
  
  // Calculate invoice total
  const calculateInvoiceTotal = () => {
    let total = 0;
    
    // Add up the cost of selected time entries
    formData.selectedTimeEntries.forEach(entryId => {
      const entry = timeEntries.find(e => e.id === entryId);
      if (entry) {
        // Find the project to get the rate
        const project = entry.project;
        if (project && project.rate) {
          // Calculate cost based on duration and rate
          const hours = entry.duration / 3600; // Convert seconds to hours
          total += hours * project.rate;
        }
      }
    });
    
    return total;
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.clientId || !formData.number || !formData.issueDate || !formData.dueDate) {
      setError('Client, invoice number, issue date, and due date are required');
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Calculate total
    const total = calculateInvoiceTotal();
    
    // Prepare invoice data
    const invoiceData = {
      clientId: parseInt(formData.clientId),
      number: formData.number,
      issueDate: formData.issueDate,
      dueDate: formData.dueDate,
      status: formData.status,
      notes: formData.notes,
      amount: total,
      tax: 0, // Could add tax calculation later
      total: total,
      timeEntryIds: formData.selectedTimeEntries
    };
    
    // Determine if creating or updating
    const method = isEditing ? 'PUT' : 'POST';
    const url = isEditing 
      ? `${API_URL}/invoices/${currentInvoice.id}`
      : `${API_URL}/invoices`;
    
    // Send request
    fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(invoiceData)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to ${isEditing ? 'update' : 'create'} invoice`);
      }
      return response.json();
    })
    .then(data => {
      if (isEditing) {
        // Update invoice in list
        setInvoices(invoices.map(invoice => 
          invoice.id === data.id ? data : invoice
        ));
      } else {
        // Add new invoice to list
        setInvoices([...invoices, data]);
      }
      
      // Remove the invoiced time entries from the available list
      setTimeEntries(timeEntries.filter(entry => 
        !formData.selectedTimeEntries.includes(entry.id)
      ));
      
      // Reset form
      resetForm();
    })
    .catch(error => {
      console.error('Error saving invoice:', error);
      setError(`Failed to ${isEditing ? 'update' : 'create'} invoice`);
    });
  };
  
  // Handle edit invoice
  const handleEdit = (invoice) => {
    setCurrentInvoice(invoice);
    
    // Get time entries for this invoice
    const token = localStorage.getItem('token');
    if (!token) return;
    
    fetch(`${API_URL}/invoices/${invoice.id}/time-entries`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch invoice time entries');
      }
      return response.json();
    })
    .then(data => {
      // Set form data with invoice details and time entries
      setFormData({
        clientId: invoice.clientId.toString(),
        number: invoice.number,
        issueDate: formatDateForInput(invoice.issueDate),
        dueDate: formatDateForInput(invoice.dueDate),
        status: invoice.status,
        notes: invoice.notes || '',
        selectedTimeEntries: data.map(entry => entry.id)
      });
      
      setIsEditing(true);
      setError('');
    })
    .catch(error => {
      console.error('Error fetching invoice time entries:', error);
      setError('Failed to load invoice details');
    });
  };
  
  // Handle delete invoice
  const handleDelete = (invoiceId) => {
    if (!confirm('Are you sure you want to delete this invoice?')) {
      return;
    }
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) return;
    
    // Send delete request
    fetch(`${API_URL}/invoices/${invoiceId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to delete invoice');
      }
      
      // Remove invoice from list
      setInvoices(invoices.filter(invoice => invoice.id !== invoiceId));
      
      // Refresh time entries to include the ones from the deleted invoice
      return fetch(`${API_URL}/time-entries?billable=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch time entries');
      }
      return response.json();
    })
    .then(data => {
      // Filter out time entries that are already invoiced
      const unbilledEntries = data.filter(entry => !entry.invoiceId);
      setTimeEntries(unbilledEntries);
    })
    .catch(error => {
      console.error('Error:', error);
      setError('Failed to delete invoice or refresh time entries');
    });
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      clientId: '',
      number: '',
      issueDate: formatDateForInput(new Date()),
      dueDate: formatDateForInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      status: 'draft',
      notes: '',
      selectedTimeEntries: []
    });
    setCurrentInvoice(null);
    setIsEditing(false);
    setShowTimeEntrySelector(false);
    setError('');
  };
  
  // Get client name by ID
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };
  
  // Filter and sort invoices
  const filteredInvoices = invoices
    .filter(invoice => {
      // Filter by status
      if (filterStatus !== 'all' && invoice.status !== filterStatus) {
        return false;
      }
      
      // Filter by client
      if (filterClient !== 'all' && invoice.clientId !== parseInt(filterClient)) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by field
      let comparison = 0;
      
      switch (sortField) {
        case 'number':
          comparison = a.number.localeCompare(b.number);
          break;
        case 'client':
          comparison = getClientName(a.clientId).localeCompare(getClientName(b.clientId));
          break;
        case 'issueDate':
          comparison = new Date(a.issueDate) - new Date(b.issueDate);
          break;
        case 'dueDate':
          comparison = new Date(a.dueDate) - new Date(b.dueDate);
          break;
        case 'total':
          comparison = a.total - b.total;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort direction
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  
  // Get status badge class
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-secondary';
      case 'sent':
        return 'bg-primary';
      case 'paid':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  };
  
  // Render loading state
  if (isLoading) {
    return React.createElement('div', { className: 'loading-container' },
      React.createElement('div', { className: 'loading-spinner' }),
      React.createElement('p', null, 'Loading invoices...')
    );
  }
  
  // Render invoices
  return React.createElement('div', { className: 'invoices' },
    React.createElement('h1', null, 'Invoices'),
    
    // Error message
    error && React.createElement('div', { className: 'alert alert-danger' }, error),
    
    // Invoice form
    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, isEditing ? 'Edit Invoice' : 'Create Invoice')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', { onSubmit: handleSubmit },
          // Client
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'clientId', className: 'form-label' }, 'Client'),
            React.createElement('select', {
              id: 'clientId',
              name: 'clientId',
              className: 'form-control',
              value: formData.clientId,
              onChange: handleInputChange,
              required: true
            },
              React.createElement('option', { value: '' }, 'Select a client'),
              clients.map(client => 
                React.createElement('option', { 
                  key: client.id, 
                  value: client.id 
                }, client.name)
              )
            )
          ),
          
          // Invoice number
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'number', className: 'form-label' }, 'Invoice Number'),
            React.createElement('input', {
              type: 'text',
              id: 'number',
              name: 'number',
              className: 'form-control',
              value: formData.number,
              onChange: handleInputChange,
              required: true
            })
          ),
          
          // Issue date
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'issueDate', className: 'form-label' }, 'Issue Date'),
            React.createElement('input', {
              type: 'date',
              id: 'issueDate',
              name: 'issueDate',
              className: 'form-control',
              value: formData.issueDate,
              onChange: handleInputChange,
              required: true
            })
          ),
          
          // Due date
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'dueDate', className: 'form-label' }, 'Due Date'),
            React.createElement('input', {
              type: 'date',
              id: 'dueDate',
              name: 'dueDate',
              className: 'form-control',
              value: formData.dueDate,
              onChange: handleInputChange,
              required: true
            })
          ),
          
          // Status
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'status', className: 'form-label' }, 'Status'),
            React.createElement('select', {
              id: 'status',
              name: 'status',
              className: 'form-control',
              value: formData.status,
              onChange: handleInputChange
            },
              React.createElement('option', { value: 'draft' }, 'Draft'),
              React.createElement('option', { value: 'sent' }, 'Sent'),
              React.createElement('option', { value: 'paid' }, 'Paid')
            )
          ),
          
          // Notes
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'notes', className: 'form-label' }, 'Notes'),
            React.createElement('textarea', {
              id: 'notes',
              name: 'notes',
              className: 'form-control',
              value: formData.notes,
              onChange: handleInputChange,
              rows: 2
            })
          ),
          
          // Time entries
          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { className: 'form-label' }, 'Time Entries'),
            React.createElement('div', null,
              React.createElement('button', {
                type: 'button',
                className: 'btn btn-outline-primary mb-3',
                onClick: () => setShowTimeEntrySelector(!showTimeEntrySelector)
              }, showTimeEntrySelector ? 'Hide Time Entries' : 'Select Time Entries'),
              
              // Show selected time entries count
              React.createElement('p', null, 
                `Selected entries: ${formData.selectedTimeEntries.length} (Total: ${formatCurrency(calculateInvoiceTotal())})`
              ),
              
              // Time entry selector
              showTimeEntrySelector && React.createElement('div', { className: 'time-entry-selector' },
                timeEntries.length === 0
                  ? React.createElement('p', null, 'No unbilled time entries available')
                  : React.createElement('table', { className: 'table table-sm' },
                      React.createElement('thead', null,
                        React.createElement('tr', null,
                          React.createElement('th', null, 'Select'),
                          React.createElement('th', null, 'Date'),
                          React.createElement('th', null, 'Project'),
                          React.createElement('th', null, 'Description'),
                          React.createElement('th', null, 'Duration'),
                          React.createElement('th', null, 'Amount')
                        )
                      ),
                      React.createElement('tbody', null,
                        timeEntries.map(entry => {
                          // Calculate amount
                          const project = entry.project;
                          const rate = project ? project.rate : 0;
                          const hours = entry.duration / 3600; // Convert seconds to hours
                          const amount = hours * rate;
                          
                          return React.createElement('tr', { key: entry.id },
                            React.createElement('td', null,
                              React.createElement('input', {
                                type: 'checkbox',
                                checked: formData.selectedTimeEntries.includes(entry.id),
                                onChange: () => handleTimeEntrySelection(entry.id)
                              })
                            ),
                            React.createElement('td', null, formatDateForDisplay(entry.startTime)),
                            React.createElement('td', null, project ? project.name : 'Unknown'),
                            React.createElement('td', null, entry.description),
                            React.createElement('td', null, `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`),
                            React.createElement('td', null, formatCurrency(amount))
                          );
                        })
                      )
                    )
              )
            )
          ),
          
          // Form buttons
          React.createElement('div', { className: 'form-group' },
            React.createElement('button', { 
              type: 'submit', 
              className: 'btn btn-primary mr-2' 
            }, isEditing ? 'Update Invoice' : 'Create Invoice'),
            
            isEditing && React.createElement('button', { 
              type: 'button', 
              className: 'btn btn-secondary', 
              onClick: resetForm 
            }, 'Cancel')
          )
        )
      )
    ),
    
    // Filters and sorting
    React.createElement('div', { className: 'filters mb-3' },
      React.createElement('div', { className: 'row' },
        // Status filter
        React.createElement('div', { className: 'col-md-3' },
          React.createElement('label', { htmlFor: 'filter-status', className: 'form-label' }, 'Status'),
          React.createElement('select', {
            id: 'filter-status',
            className: 'form-control',
            value: filterStatus,
            onChange: (e) => setFilterStatus(e.target.value)
          },
            React.createElement('option', { value: 'all' }, 'All Statuses'),
            React.createElement('option', { value: 'draft' }, 'Draft'),
            React.createElement('option', { value: 'sent' }, 'Sent'),
            React.createElement('option', { value: 'paid' }, 'Paid')
          )
        ),
        
        // Client filter
        React.createElement('div', { className: 'col-md-3' },
          React.createElement('label', { htmlFor: 'filter-client', className: 'form-label' }, 'Client'),
          React.createElement('select', {
            id: 'filter-client',
            className: 'form-control',
            value: filterClient,
            onChange: (e) => setFilterClient(e.target.value)
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
        
        // Sort field
        React.createElement('div', { className: 'col-md-3' },
          React.createElement('label', { htmlFor: 'sort-field', className: 'form-label' }, 'Sort By'),
          React.createElement('select', {
            id: 'sort-field',
            className: 'form-control',
            value: sortField,
            onChange: (e) => setSortField(e.target.value)
          },
            React.createElement('option', { value: 'number' }, 'Number'),
            React.createElement('option', { value: 'client' }, 'Client'),
            React.createElement('option', { value: 'issueDate' }, 'Issue Date'),
            React.createElement('option', { value: 'dueDate' }, 'Due Date'),
            React.createElement('option', { value: 'total' }, 'Total'),
            React.createElement('option', { value: 'status' }, 'Status')
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
    
    // Invoices list
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Invoices List')
      ),
      React.createElement('div', { className: 'card-body' },
        filteredInvoices.length === 0
          ? React.createElement('p', null, 'No invoices found')
          : React.createElement('table', { className: 'table' },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  React.createElement('th', null, 'Number'),
                  React.createElement('th', null, 'Client'),
                  React.createElement('th', null, 'Issue Date'),
                  React.createElement('th', null, 'Due Date'),
                  React.createElement('th', null, 'Total'),
                  React.createElement('th', null, 'Status'),
                  React.createElement('th', null, 'Actions')
                )
              ),
              React.createElement('tbody', null,
                filteredInvoices.map(invoice => 
                  React.createElement('tr', { key: invoice.id },
                    React.createElement('td', null, invoice.number),
                    React.createElement('td', null, getClientName(invoice.clientId)),
                    React.createElement('td', null, formatDateForDisplay(invoice.issueDate)),
                    React.createElement('td', null, formatDateForDisplay(invoice.dueDate)),
                    React.createElement('td', null, formatCurrency(invoice.total)),
                    React.createElement('td', null, 
                      React.createElement('span', { 
                        className: `badge ${getStatusBadgeClass(invoice.status)}`
                      }, invoice.status)
                    ),
                    React.createElement('td', null,
                      React.createElement('button', {
                        className: 'btn btn-sm btn-primary mr-1',
                        onClick: () => handleEdit(invoice)
                      }, 'Edit'),
                      React.createElement('button', {
                        className: 'btn btn-sm btn-danger',
                        onClick: () => handleDelete(invoice.id)
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

// Make Invoices component globally available
window.Invoices = Invoices;