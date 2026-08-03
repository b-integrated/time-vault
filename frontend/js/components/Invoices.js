// Invoices component for managing invoices

function Invoices({ user }) {
  // State for invoices data
  const [invoices, setInvoices] = React.useState([]);
  const [clients, setClients] = React.useState([]);
  const [timeEntries, setTimeEntries] = React.useState([]);
  const [invoiceTimeEntries, setInvoiceTimeEntries] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [editLoadingInvoiceId, setEditLoadingInvoiceId] = React.useState(null);
  const [error, setError] = React.useState('');
  const invoiceFormRef = React.useRef(null);
  
  // State for form
  const [isEditing, setIsEditing] = React.useState(false);
  const [currentInvoice, setCurrentInvoice] = React.useState(null);
  const [formData, setFormData] = React.useState({
    clientId: '',
    number: '',
    issueDate: formatDateForInput(new Date()),
    dueDate: formatDateForInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)), // 30 days from now
    status: 'draft',
    amount: '',
    tax: '0',
    dueAmount: '',
    paidDate: '',
    subject: '',
    billerClientId: '1',
    billerName: 'Bomhof Integrated LLC',
    billerAddress: '',
    billerEmail: '',
    billerPhone: '',
    clientName: '',
    clientAddress: '',
    clientEmail: '',
    clientPhone: '',
    notes: '',
    selectedTimeEntries: []
  });
  const [generatorData, setGeneratorData] = React.useState(() => {
    const issueDate = formatDateForInput(new Date());
    return {
    clientId: '',
    number: buildNextInvoiceNumber(issueDate, '', [], []),
    startDate: formatDateForInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    endDate: formatDateForInput(new Date()),
    issueDate: issueDate,
    dueDate: formatDateForInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    subject: '',
    billerClientId: '1',
    billerName: 'Bomhof Integrated LLC',
    billerAddress: '',
    billerEmail: '',
    billerPhone: '',
    clientName: '',
    clientAddress: '',
    clientEmail: '',
    clientPhone: '',
    notes: ''
    };
  });
  
  // State for filtering and sorting
  const [filterStatus, setFilterStatus] = React.useState('all');
  const [filterClient, setFilterClient] = React.useState('all');
  const [sortField, setSortField] = React.useState('issueDate');
  const [sortDirection, setSortDirection] = React.useState('desc');
  
  // State for time entry selection
  const [showTimeEntrySelector, setShowTimeEntrySelector] = React.useState(false);
  const [manualLineDraft, setManualLineDraft] = React.useState({
    serviceDate: formatDateForInput(new Date()),
    projectName: '',
    description: '',
    hours: '0',
    rate: '0',
    amount: '0'
  });
  
  // API URL
  const API_URL = '/api';
  
  // Format date for input field
  function formatDateForInput(date) {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.slice(0, 10);
    }

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

  function toAPIDate(dateString) {
    return `${dateString}T00:00:00Z`;
  }

  function invoiceClientSlug(client) {
    return (client && client.name ? client.name : '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .slice(0, 7);
  }

  function isGeneratedInvoiceNumber(number) {
    return !number || /^INV-(\d{4}-\d{2}|\d{4})(-[A-Z0-9-]+)?(-\d{4})?$/.test(number);
  }

  function buildNextInvoiceNumber(issueDate, clientId, clientList = clients, invoiceList = invoices) {
    const date = issueDate || formatDateForInput(new Date());
    const yearMonth = `${date.slice(2, 4)}${date.slice(5, 7)}`;
    const client = clientList.find(c => c.id === parseInt(clientId));
    const slug = invoiceClientSlug(client);
    const base = `INV-${yearMonth}${slug ? `-${slug}` : ''}`;
    const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(`^${escapedBase}-(\\d{4})$`);
    const maxSequence = invoiceList.reduce((max, invoice) => {
      const match = (invoice.number || '').match(matcher);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `${base}-${String(maxSequence + 1).padStart(4, '0')}`;
  }
  
  // Format currency
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  const applyBillerFields = (data, client) => ({
    ...data,
    billerClientId: client ? client.id.toString() : data.billerClientId,
    billerName: client ? (client.name || '') : data.billerName,
    billerAddress: client ? (client.address || '') : data.billerAddress,
    billerEmail: client ? (client.email || '') : data.billerEmail,
    billerPhone: client ? (client.phone || '') : data.billerPhone
  });

  const applyBillToFields = (data, client) => ({
    ...data,
    clientName: client ? (client.name || '') : '',
    clientAddress: client ? (client.address || '') : '',
    clientEmail: client ? (client.email || '') : '',
    clientPhone: client ? (client.phone || '') : ''
  });

  const getDefaultBiller = (clientList) => {
    return clientList.find(client => client.id === 1) ||
      clientList.find(client => (client.name || '').toLowerCase().includes('bomhof')) ||
      null;
  };
  
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
      const defaultBiller = getDefaultBiller(data);
      if (defaultBiller) {
        setFormData(current => applyBillerFields(current, defaultBiller));
        setGeneratorData(current => applyBillerFields(current, defaultBiller));
      }
      
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
    const nextData = {
      ...formData,
      [name]: value
    };

    if (name === 'clientId') {
      const client = clients.find(c => c.id === parseInt(value));
      Object.assign(nextData, applyBillToFields(nextData, client));
    }

    if (name === 'billerClientId') {
      const client = clients.find(c => c.id === parseInt(value));
      Object.assign(nextData, applyBillerFields(nextData, client));
    }

    setFormData(nextData);
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
  
  const roundMoney = (value) => Math.round((parseFloat(value || 0) + Number.EPSILON) * 100) / 100;

  const lineClientKey = (line) => line.id ? `line-${line.id}` : line.clientKey;

  const invoiceDescriptionFromTimeEntry = (entry) => {
    const project = entry.project || {};
    const client = project.client || {};
    const task = entry.task || {};
    const context = [client.name, project.name, task.name].filter(Boolean).join(' / ');
    const description = (entry.description || '').trim();
    if (!context) return description;
    if (!description) return context;
    if (description.startsWith(`${context}\n`) || description.startsWith(`${context} - `)) {
      return description;
    }
    return `${context}\n${description}`;
  };

  const lineFromTimeEntry = (entry, index = 0) => {
    const project = entry.project || {};
    const task = entry.task || {};
    const hours = roundMoney((entry.duration || 0) / 3600);
    const rate = parseFloat(task.rate || project.rate || 0) || 0;
    return {
      clientKey: `time-${entry.id}-${Date.now()}`,
      originalTimeEntryId: entry.originalTimeEntryId || entry.id,
      projectId: entry.projectId || project.id || null,
      serviceDate: formatDateForInput(entry.startTime || entry.serviceDate || new Date()),
      projectName: entry.projectName || project.name || '',
      description: invoiceDescriptionFromTimeEntry(entry),
      hours: hours.toString(),
      rate: rate.toString(),
      amount: roundMoney(hours * rate).toString(),
      lineType: 'time',
      sortOrder: index
    };
  };

  const normalizeInvoiceLine = (line, index = 0) => {
    const originalEntry = line.originalTimeEntry || {};
    const project = line.project || originalEntry.project || {};
    return {
      id: line.id,
      clientKey: line.clientKey || `line-${line.id || index}-${Date.now()}`,
      originalTimeEntryId: line.originalTimeEntryId || null,
      projectId: line.projectId || project.id || null,
      serviceDate: line.serviceDate ? formatDateForInput(line.serviceDate) : (originalEntry.startTime ? formatDateForInput(originalEntry.startTime) : ''),
      projectName: line.projectName || project.name || '',
      description: line.description || '',
      hours: line.hours != null ? line.hours.toString() : '0',
      rate: line.rate != null ? line.rate.toString() : '0',
      amount: line.amount != null ? line.amount.toString() : '0',
      lineType: line.lineType || (line.originalTimeEntryId ? 'time' : 'manual'),
      sortOrder: line.sortOrder || index
    };
  };

  const calculateInvoiceTotal = () => {
    if (isEditing) {
      return invoiceTimeEntries.reduce((total, line) => total + roundMoney(line.amount), 0);
    }

    let total = 0;
    formData.selectedTimeEntries.forEach(entryId => {
      const entry = timeEntries.find(e => e.id === entryId);
      if (entry && entry.project && entry.project.rate) {
        total += (entry.duration / 3600) * entry.project.rate;
      }
    });
    return roundMoney(total);
  };

  const handleInvoiceLineChange = (lineKey, field, value) => {
    setInvoiceTimeEntries(lines => lines.map(line => {
      if (lineClientKey(line) !== lineKey) return line;

      const nextLine = { ...line, [field]: value };
      if (field === 'hours' || field === 'rate') {
        nextLine.amount = roundMoney((parseFloat(nextLine.hours || '0') || 0) * (parseFloat(nextLine.rate || '0') || 0)).toString();
      }
      return nextLine;
    }));
  };

  const handleDeleteInvoiceLine = (lineKey) => {
    setInvoiceTimeEntries(lines => lines.filter(line => lineClientKey(line) !== lineKey));
  };

  const handleAddTimeEntryLine = (entryId) => {
    const entry = timeEntries.find(item => item.id === parseInt(entryId));
    if (!entry) return;
    const alreadyAdded = invoiceTimeEntries.some(line => line.originalTimeEntryId === entry.id);
    if (alreadyAdded) return;

    setInvoiceTimeEntries(lines => [...lines, lineFromTimeEntry(entry, lines.length)]);
    setTimeEntries(entries => entries.filter(item => item.id !== entry.id));
  };

  const handleManualLineDraftChange = (field, value) => {
    const nextDraft = { ...manualLineDraft, [field]: value };
    if (field === 'hours' || field === 'rate') {
      nextDraft.amount = roundMoney((parseFloat(nextDraft.hours || '0') || 0) * (parseFloat(nextDraft.rate || '0') || 0)).toString();
    }
    setManualLineDraft(nextDraft);
  };

  const handleAddManualLine = () => {
    if (!manualLineDraft.description && !manualLineDraft.projectName) {
      setError('Manual invoice line needs a project/name or description');
      return;
    }
    setInvoiceTimeEntries(lines => [...lines, {
      ...manualLineDraft,
      clientKey: `manual-${Date.now()}`,
      originalTimeEntryId: null,
      projectId: null,
      lineType: 'manual',
      sortOrder: lines.length
    }]);
    setManualLineDraft({
      serviceDate: formatDateForInput(new Date()),
      projectName: '',
      description: '',
      hours: '0',
      rate: '0',
      amount: '0'
    });
    setError('');
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
    
    // Calculate total from selected time, or keep imported/manual invoice totals editable.
    const selectedTotal = calculateInvoiceTotal();
    const manualAmount = parseFloat(formData.amount || '0') || 0;
    const tax = parseFloat(formData.tax || '0') || 0;
    const amount = (isEditing || formData.selectedTimeEntries.length > 0) ? selectedTotal : manualAmount;
    const total = roundMoney(amount + tax);
    const dueAmount = formData.dueAmount === '' ? total : parseFloat(formData.dueAmount || '0') || 0;
    const invoiceLines = isEditing ? invoiceTimeEntries.map((line, index) => ({
      id: line.id || 0,
      originalTimeEntryId: line.originalTimeEntryId || null,
      projectId: line.projectId || null,
      serviceDate: line.serviceDate ? toAPIDate(line.serviceDate) : null,
      projectName: line.projectName || '',
      description: line.description || '',
      hours: parseFloat(line.hours || '0') || 0,
      rate: parseFloat(line.rate || '0') || 0,
      amount: parseFloat(line.amount || '0') || 0,
      lineType: line.lineType || (line.originalTimeEntryId ? 'time' : 'manual'),
      sortOrder: index
    })) : [];
    
    // Prepare invoice data
    const invoiceData = {
      clientId: parseInt(formData.clientId),
      number: formData.number,
      issueDate: toAPIDate(formData.issueDate),
      dueDate: toAPIDate(formData.dueDate),
      status: formData.status,
      amount: amount,
      tax: tax,
      dueAmount: dueAmount,
      paidDate: formData.paidDate ? toAPIDate(formData.paidDate) : null,
      subject: formData.subject,
      billerName: formData.billerName,
      billerAddress: formData.billerAddress,
      billerEmail: formData.billerEmail,
      billerPhone: formData.billerPhone,
      clientName: formData.clientName,
      clientAddress: formData.clientAddress,
      clientEmail: formData.clientEmail,
      clientPhone: formData.clientPhone,
      notes: formData.notes,
      timeEntryIds: formData.selectedTimeEntries,
      lines: invoiceLines
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

  const handleGeneratorChange = (e) => {
    const { name, value } = e.target;
    const nextData = {
      ...generatorData,
      [name]: value
    };

    if (name === 'clientId') {
      const client = clients.find(c => c.id === parseInt(value));
      Object.assign(nextData, applyBillToFields(nextData, client));
    }

    if (name === 'billerClientId') {
      const client = clients.find(c => c.id === parseInt(value));
      Object.assign(nextData, applyBillerFields(nextData, client));
    }

    if ((name === 'clientId' || name === 'issueDate') && isGeneratedInvoiceNumber(generatorData.number)) {
      nextData.number = buildNextInvoiceNumber(nextData.issueDate, nextData.clientId);
    }

    setGeneratorData(nextData);
  };

  const handleGenerateInvoice = (e) => {
    e.preventDefault();
    if (!generatorData.clientId || !generatorData.number || !generatorData.startDate || !generatorData.endDate) {
      setError('Client, invoice number, start date, and end date are required');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;
    setIsGenerating(true);

    fetch(`${API_URL}/invoices/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        clientId: parseInt(generatorData.clientId),
        number: generatorData.number,
        startDate: toAPIDate(generatorData.startDate),
        endDate: toAPIDate(generatorData.endDate),
        issueDate: toAPIDate(generatorData.issueDate),
        dueDate: toAPIDate(generatorData.dueDate),
        subject: generatorData.subject,
        billerName: generatorData.billerName,
        billerAddress: generatorData.billerAddress,
        billerEmail: generatorData.billerEmail,
        billerPhone: generatorData.billerPhone,
        clientName: generatorData.clientName,
        clientAddress: generatorData.clientAddress,
        clientEmail: generatorData.clientEmail,
        clientPhone: generatorData.clientPhone,
        notes: generatorData.notes
      })
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => { throw new Error(text || 'Failed to generate invoice'); });
      }
      return response.json();
    })
    .then(data => {
      setInvoices([data, ...invoices]);
      setTimeEntries(timeEntries.filter(entry => entry.invoiceId || (entry.project && entry.project.clientId !== data.clientId)));
      setGeneratorData(current => ({
        ...current,
        number: isGeneratedInvoiceNumber(current.number)
          ? buildNextInvoiceNumber(current.issueDate, current.clientId, clients, [data, ...invoices])
          : current.number
      }));
      setError('');
    })
    .catch(error => {
      console.error('Error generating invoice:', error);
      setError(error.message || 'Failed to generate invoice');
    })
    .finally(() => {
      setIsGenerating(false);
    });
  };
  
  // Handle edit invoice
  const handleEdit = (invoice) => {
    setCurrentInvoice(invoice);
    setEditLoadingInvoiceId(invoice.id);
    
    // Get time entries for this invoice
    const token = localStorage.getItem('token');
    if (!token) {
      setEditLoadingInvoiceId(null);
      return;
    }
    
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
      const client = invoice.client || {};
      const lines = data.map((line, index) => normalizeInvoiceLine(line, index));
      setInvoiceTimeEntries(lines);

      // Set form data with invoice details and time entries
      setFormData({
        clientId: invoice.clientId.toString(),
        number: invoice.number,
        issueDate: formatDateForInput(invoice.issueDate),
        dueDate: formatDateForInput(invoice.dueDate),
        status: invoice.status,
        amount: invoice.amount != null ? invoice.amount : '',
        tax: invoice.tax != null ? invoice.tax : 0,
        dueAmount: invoice.dueAmount != null ? invoice.dueAmount : '',
        paidDate: invoice.paidDate ? formatDateForInput(invoice.paidDate) : '',
        subject: invoice.subject || '',
        billerClientId: '',
        billerName: invoice.billerName || 'Bomhof Integrated LLC',
        billerAddress: invoice.billerAddress || '',
        billerEmail: invoice.billerEmail || '',
        billerPhone: invoice.billerPhone || '',
        clientName: invoice.clientName || client.name || getClientName(invoice.clientId),
        clientAddress: invoice.clientAddress || client.address || '',
        clientEmail: invoice.clientEmail || client.email || '',
        clientPhone: invoice.clientPhone || client.phone || '',
        notes: invoice.notes || '',
        selectedTimeEntries: lines.map(line => line.originalTimeEntryId).filter(Boolean)
      });
      
      setIsEditing(true);
      setShowTimeEntrySelector(true);
      setError('');
      setTimeout(() => {
        if (invoiceFormRef.current) {
          invoiceFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 0);
    })
    .catch(error => {
      console.error('Error fetching invoice time entries:', error);
      setError('Failed to load invoice details');
    })
    .finally(() => {
      setEditLoadingInvoiceId(null);
    });
  };

  const handleExportPDF = (invoice) => {
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
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setError('');
    })
    .catch(error => {
      console.error('Error exporting invoice PDF:', error);
      setError('Failed to export invoice PDF');
    });
  };

  const handleExportQBOCSV = (invoice) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch(`${API_URL}/invoices/${invoice.id}/qbo-csv`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to export QuickBooks CSV');
      }
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.number}-qbo.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setError('');
    })
    .catch(error => {
      console.error('Error exporting QuickBooks CSV:', error);
      setError('Failed to export QuickBooks CSV');
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
      amount: '',
      tax: '0',
      dueAmount: '',
      paidDate: '',
      subject: '',
      billerClientId: '1',
      billerName: 'Bomhof Integrated LLC',
      billerAddress: '',
      billerEmail: '',
      billerPhone: '',
      clientName: '',
      clientAddress: '',
      clientEmail: '',
      clientPhone: '',
      notes: '',
      selectedTimeEntries: []
    });
    setCurrentInvoice(null);
    setIsEditing(false);
      setShowTimeEntrySelector(false);
      setInvoiceTimeEntries([]);
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
      case 'open':
        return 'bg-warning';
      case 'paid':
        return 'bg-success';
      default:
        return 'bg-secondary';
    }
  };

  function renderAddressFields(data, prefix = '') {
    const namePrefix = prefix ? `${prefix}-` : '';
    return React.createElement('div', { className: 'invoice-address-grid' },
      React.createElement('section', { className: 'invoice-address-panel' },
        React.createElement('h3', null, 'Biller'),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: `${namePrefix}billerClientId`, className: 'form-label' }, 'Biller Client'),
          React.createElement('select', {
            id: `${namePrefix}billerClientId`,
            name: 'billerClientId',
            className: 'form-control',
            value: data.billerClientId || '',
            onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange
          },
            React.createElement('option', { value: '' }, 'Custom biller'),
            clients.map(client => React.createElement('option', { key: client.id, value: client.id }, client.name))
          )
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: `${namePrefix}billerName`, className: 'form-label' }, 'Name'),
          React.createElement('input', {
            id: `${namePrefix}billerName`,
            name: 'billerName',
            className: 'form-control',
            value: data.billerName || '',
            onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange
          })
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: `${namePrefix}billerAddress`, className: 'form-label' }, 'Address'),
          React.createElement('textarea', {
            id: `${namePrefix}billerAddress`,
            name: 'billerAddress',
            className: 'form-control',
            value: data.billerAddress || '',
            onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange,
            rows: 3
          })
        ),
        React.createElement('div', { className: 'row' },
          React.createElement('div', { className: 'col-md-6 form-group' },
            React.createElement('label', { htmlFor: `${namePrefix}billerEmail`, className: 'form-label' }, 'Email'),
            React.createElement('input', {
              id: `${namePrefix}billerEmail`,
              name: 'billerEmail',
              className: 'form-control',
              value: data.billerEmail || '',
              onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange
            })
          ),
          React.createElement('div', { className: 'col-md-6 form-group' },
            React.createElement('label', { htmlFor: `${namePrefix}billerPhone`, className: 'form-label' }, 'Phone'),
            React.createElement('input', {
              id: `${namePrefix}billerPhone`,
              name: 'billerPhone',
              className: 'form-control',
              value: data.billerPhone || '',
              onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange
            })
          )
        )
      ),
      React.createElement('section', { className: 'invoice-address-panel' },
        React.createElement('h3', null, 'Bill To'),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: `${namePrefix}clientId`, className: 'form-label' }, 'Bill To Client'),
          React.createElement('select', {
            id: `${namePrefix}clientId`,
            name: 'clientId',
            className: 'form-control',
            value: data.clientId || '',
            onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange
          },
            React.createElement('option', { value: '' }, 'Select a client'),
            clients.map(client => React.createElement('option', { key: client.id, value: client.id }, client.name))
          )
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: `${namePrefix}clientName`, className: 'form-label' }, 'Name'),
          React.createElement('input', {
            id: `${namePrefix}clientName`,
            name: 'clientName',
            className: 'form-control',
            value: data.clientName || '',
            onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange
          })
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: `${namePrefix}clientAddress`, className: 'form-label' }, 'Address'),
          React.createElement('textarea', {
            id: `${namePrefix}clientAddress`,
            name: 'clientAddress',
            className: 'form-control',
            value: data.clientAddress || '',
            onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange,
            rows: 3
          })
        ),
        React.createElement('div', { className: 'row' },
          React.createElement('div', { className: 'col-md-6 form-group' },
            React.createElement('label', { htmlFor: `${namePrefix}clientEmail`, className: 'form-label' }, 'Email'),
            React.createElement('input', {
              id: `${namePrefix}clientEmail`,
              name: 'clientEmail',
              className: 'form-control',
              value: data.clientEmail || '',
              onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange
            })
          ),
          React.createElement('div', { className: 'col-md-6 form-group' },
            React.createElement('label', { htmlFor: `${namePrefix}clientPhone`, className: 'form-label' }, 'Phone'),
            React.createElement('input', {
              id: `${namePrefix}clientPhone`,
              name: 'clientPhone',
              className: 'form-control',
              value: data.clientPhone || '',
              onChange: prefix === 'generator' ? handleGeneratorChange : handleInputChange
            })
          )
        )
      )
    );
  }
  
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

    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Monthly Invoice Generator')
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('form', { onSubmit: handleGenerateInvoice },
          React.createElement('div', { className: 'row' },
            React.createElement('div', { className: 'col-md-4 form-group' },
              React.createElement('label', { className: 'form-label', htmlFor: 'generatorClientId' }, 'Client'),
              React.createElement('select', {
                id: 'generatorClientId',
                name: 'clientId',
                className: 'form-control',
                value: generatorData.clientId,
                onChange: handleGeneratorChange,
                required: true
              },
                React.createElement('option', { value: '' }, 'Select a client'),
                clients.map(client => React.createElement('option', { key: client.id, value: client.id }, client.name))
              )
            ),
            React.createElement('div', { className: 'col-md-4 form-group' },
              React.createElement('label', { className: 'form-label', htmlFor: 'generatorNumber' }, 'Invoice Number'),
              React.createElement('input', {
                id: 'generatorNumber',
                name: 'number',
                className: 'form-control',
                value: generatorData.number,
                onChange: handleGeneratorChange,
                required: true
              })
            ),
            React.createElement('div', { className: 'col-md-2 form-group' },
              React.createElement('label', { className: 'form-label', htmlFor: 'generatorStartDate' }, 'Start'),
              React.createElement('input', {
                id: 'generatorStartDate',
                name: 'startDate',
                type: 'date',
                className: 'form-control',
                value: generatorData.startDate,
                onChange: handleGeneratorChange,
                required: true
              })
            ),
            React.createElement('div', { className: 'col-md-2 form-group' },
              React.createElement('label', { className: 'form-label', htmlFor: 'generatorEndDate' }, 'End'),
              React.createElement('input', {
                id: 'generatorEndDate',
                name: 'endDate',
                type: 'date',
                className: 'form-control',
                value: generatorData.endDate,
                onChange: handleGeneratorChange,
                required: true
              })
            )
          ),
          React.createElement('div', { className: 'row' },
            React.createElement('div', { className: 'col-md-3 form-group' },
              React.createElement('label', { className: 'form-label', htmlFor: 'generatorIssueDate' }, 'Issue Date'),
              React.createElement('input', {
                id: 'generatorIssueDate',
                name: 'issueDate',
                type: 'date',
                className: 'form-control',
                value: generatorData.issueDate,
                onChange: handleGeneratorChange
              })
            ),
            React.createElement('div', { className: 'col-md-3 form-group' },
              React.createElement('label', { className: 'form-label', htmlFor: 'generatorDueDate' }, 'Due Date'),
              React.createElement('input', {
                id: 'generatorDueDate',
                name: 'dueDate',
                type: 'date',
                className: 'form-control',
                value: generatorData.dueDate,
                onChange: handleGeneratorChange
              })
            ),
            React.createElement('div', { className: 'col-md-3 form-group' },
              React.createElement('label', { className: 'form-label', htmlFor: 'generatorSubject' }, 'Subject'),
              React.createElement('input', {
                id: 'generatorSubject',
                name: 'subject',
                className: 'form-control',
                value: generatorData.subject,
                onChange: handleGeneratorChange
              })
            ),
            React.createElement('div', { className: 'col-md-3 form-group' },
              React.createElement('label', { className: 'form-label', htmlFor: 'generatorNotes' }, 'Notes'),
              React.createElement('input', {
                id: 'generatorNotes',
                name: 'notes',
                className: 'form-control',
                value: generatorData.notes,
                onChange: handleGeneratorChange
              })
            )
          ),
          renderAddressFields(generatorData, 'generator'),
          React.createElement('button', {
            type: 'submit',
            className: 'btn btn-primary mt-2',
            disabled: isGenerating
          }, isGenerating ? 'Generating...' : 'Generate Draft Invoice')
        )
      )
    ),
    
    // Invoice form
    React.createElement('div', { className: 'card mb-4', ref: invoiceFormRef },
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
              React.createElement('option', { value: 'open' }, 'Open'),
              React.createElement('option', { value: 'paid' }, 'Paid')
            )
          ),

          React.createElement('div', { className: 'row' },
            React.createElement('div', { className: 'col-md-3 form-group' },
              React.createElement('label', { htmlFor: 'amount', className: 'form-label' }, 'Subtotal'),
              React.createElement('input', {
                type: 'number',
                step: '0.01',
                id: 'amount',
                name: 'amount',
                className: 'form-control',
                value: formData.amount,
                onChange: handleInputChange
              })
            ),
            React.createElement('div', { className: 'col-md-3 form-group' },
              React.createElement('label', { htmlFor: 'tax', className: 'form-label' }, 'Tax'),
              React.createElement('input', {
                type: 'number',
                step: '0.01',
                id: 'tax',
                name: 'tax',
                className: 'form-control',
                value: formData.tax,
                onChange: handleInputChange
              })
            ),
            React.createElement('div', { className: 'col-md-3 form-group' },
              React.createElement('label', { htmlFor: 'dueAmount', className: 'form-label' }, 'Due Amount'),
              React.createElement('input', {
                type: 'number',
                step: '0.01',
                id: 'dueAmount',
                name: 'dueAmount',
                className: 'form-control',
                value: formData.dueAmount,
                onChange: handleInputChange
              })
            ),
            React.createElement('div', { className: 'col-md-3 form-group' },
              React.createElement('label', { htmlFor: 'paidDate', className: 'form-label' }, 'Paid Date'),
              React.createElement('input', {
                type: 'date',
                id: 'paidDate',
                name: 'paidDate',
                className: 'form-control',
                value: formData.paidDate,
                onChange: handleInputChange
              })
            )
          ),

          React.createElement('div', { className: 'form-group' },
            React.createElement('label', { htmlFor: 'subject', className: 'form-label' }, 'Subject'),
            React.createElement('input', {
              id: 'subject',
              name: 'subject',
              className: 'form-control',
              value: formData.subject,
              onChange: handleInputChange
            })
          ),

          renderAddressFields(formData),
          
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
              }, showTimeEntrySelector ? 'Hide Time Entries' : (isEditing ? 'Show Time Entries' : 'Select Time Entries')),
              
              // Show selected time entries count
              React.createElement('p', null, 
                `${isEditing ? 'Invoice lines' : 'Selected entries'}: ${isEditing ? invoiceTimeEntries.length : formData.selectedTimeEntries.length} (Total: ${formatCurrency(calculateInvoiceTotal())})`
              ),
              
              // Time entry selector
              showTimeEntrySelector && React.createElement('div', { className: 'time-entry-selector' },
                isEditing
                  ? React.createElement('div', null,
                      invoiceTimeEntries.length === 0
                        ? React.createElement('p', null, 'No invoice lines yet')
                        : React.createElement('table', { className: 'table table-sm invoice-lines-table' },
                            React.createElement('thead', null,
                              React.createElement('tr', null,
                                React.createElement('th', null, 'Date'),
                                React.createElement('th', null, 'Project'),
                                React.createElement('th', null, 'Description'),
                                React.createElement('th', null, 'Hours'),
                                React.createElement('th', null, 'Rate'),
                                React.createElement('th', null, 'Total'),
                                React.createElement('th', null, '')
                              )
                            ),
                            React.createElement('tbody', null,
                              invoiceTimeEntries.map((line) => {
                                const lineKey = lineClientKey(line);
                                return React.createElement('tr', { key: lineKey },
                                  React.createElement('td', null,
                                    React.createElement('input', {
                                      type: 'date',
                                      className: 'form-control form-control-sm',
                                      value: line.serviceDate || '',
                                      onChange: (e) => handleInvoiceLineChange(lineKey, 'serviceDate', e.target.value)
                                    })
                                  ),
                                  React.createElement('td', null,
                                    React.createElement('input', {
                                      className: 'form-control form-control-sm',
                                      value: line.projectName || '',
                                      onChange: (e) => handleInvoiceLineChange(lineKey, 'projectName', e.target.value)
                                    })
                                  ),
                                  React.createElement('td', null,
                                    React.createElement('textarea', {
                                      className: 'form-control form-control-sm',
                                      value: line.description || '',
                                      rows: 2,
                                      onChange: (e) => handleInvoiceLineChange(lineKey, 'description', e.target.value)
                                    })
                                  ),
                                  React.createElement('td', null,
                                    React.createElement('input', {
                                      type: 'number',
                                      step: '0.01',
                                      min: '0',
                                      className: 'form-control form-control-sm invoice-line-number',
                                      value: line.hours || '0',
                                      onChange: (e) => handleInvoiceLineChange(lineKey, 'hours', e.target.value)
                                    })
                                  ),
                                  React.createElement('td', null,
                                    React.createElement('input', {
                                      type: 'number',
                                      step: '0.01',
                                      min: '0',
                                      className: 'form-control form-control-sm invoice-line-number',
                                      value: line.rate || '0',
                                      onChange: (e) => handleInvoiceLineChange(lineKey, 'rate', e.target.value)
                                    })
                                  ),
                                  React.createElement('td', null,
                                    React.createElement('input', {
                                      type: 'number',
                                      step: '0.01',
                                      min: '0',
                                      className: 'form-control form-control-sm invoice-line-number',
                                      value: line.amount || '0',
                                      onChange: (e) => handleInvoiceLineChange(lineKey, 'amount', e.target.value)
                                    })
                                  ),
                                  React.createElement('td', null,
                                    React.createElement('button', {
                                      type: 'button',
                                      className: 'btn btn-sm btn-danger',
                                      onClick: () => handleDeleteInvoiceLine(lineKey)
                                    }, 'Delete')
                                  )
                                );
                              })
                            )
                          ),
                      React.createElement('div', { className: 'invoice-line-adders' },
                        React.createElement('div', { className: 'form-group' },
                          React.createElement('label', { className: 'form-label', htmlFor: 'addTimeEntryLine' }, 'Add Unbilled Time Entry'),
                          React.createElement('select', {
                            id: 'addTimeEntryLine',
                            className: 'form-control',
                            value: '',
                            onChange: (e) => handleAddTimeEntryLine(e.target.value)
                          },
                            React.createElement('option', { value: '' }, 'Select an entry to add'),
                            timeEntries.map(entry => {
                              const project = entry.project || {};
                              const hours = roundMoney((entry.duration || 0) / 3600);
                              return React.createElement('option', { key: entry.id, value: entry.id },
                                `${formatDateForDisplay(entry.startTime)} - ${project.name || 'Unknown'} - ${hours}h - ${entry.description || ''}`
                              );
                            })
                          )
                        ),
                        React.createElement('div', { className: 'manual-line-grid' },
                          React.createElement('input', {
                            type: 'date',
                            className: 'form-control',
                            value: manualLineDraft.serviceDate,
                            onChange: (e) => handleManualLineDraftChange('serviceDate', e.target.value)
                          }),
                          React.createElement('input', {
                            className: 'form-control',
                            placeholder: 'Project / item',
                            value: manualLineDraft.projectName,
                            onChange: (e) => handleManualLineDraftChange('projectName', e.target.value)
                          }),
                          React.createElement('input', {
                            className: 'form-control',
                            placeholder: 'Description',
                            value: manualLineDraft.description,
                            onChange: (e) => handleManualLineDraftChange('description', e.target.value)
                          }),
                          React.createElement('input', {
                            type: 'number',
                            step: '0.01',
                            min: '0',
                            className: 'form-control',
                            placeholder: 'Hours',
                            value: manualLineDraft.hours,
                            onChange: (e) => handleManualLineDraftChange('hours', e.target.value)
                          }),
                          React.createElement('input', {
                            type: 'number',
                            step: '0.01',
                            min: '0',
                            className: 'form-control',
                            placeholder: 'Rate',
                            value: manualLineDraft.rate,
                            onChange: (e) => handleManualLineDraftChange('rate', e.target.value)
                          }),
                          React.createElement('input', {
                            type: 'number',
                            step: '0.01',
                            min: '0',
                            className: 'form-control',
                            placeholder: 'Total',
                            value: manualLineDraft.amount,
                            onChange: (e) => handleManualLineDraftChange('amount', e.target.value)
                          }),
                          React.createElement('button', {
                            type: 'button',
                            className: 'btn btn-outline-primary',
                            onClick: handleAddManualLine
                          }, 'Add Line')
                        )
                      )
                    )
                  : (timeEntries.length === 0
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
                        (isEditing ? invoiceTimeEntries : timeEntries).map(entry => {
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
            React.createElement('option', { value: 'open' }, 'Open'),
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
                  React.createElement('th', null, 'Due'),
                  React.createElement('th', null, 'Paid Date'),
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
                    React.createElement('td', null, formatCurrency(invoice.dueAmount || 0)),
                    React.createElement('td', null, invoice.paidDate ? formatDateForDisplay(invoice.paidDate) : ''),
                    React.createElement('td', null, 
                      React.createElement('span', { 
                        className: `badge ${getStatusBadgeClass(invoice.status)}`
                      }, invoice.status)
                    ),
                    React.createElement('td', null,
                      React.createElement('button', {
                        className: 'btn btn-sm btn-primary mr-1',
                        disabled: editLoadingInvoiceId === invoice.id,
                        onClick: () => handleEdit(invoice)
                      }, editLoadingInvoiceId === invoice.id ? 'Opening...' : 'Edit'),
                      React.createElement('button', {
                        className: 'btn btn-sm btn-secondary mr-1',
                        onClick: () => handleExportPDF(invoice)
                      }, 'PDF'),
                      React.createElement('button', {
                        className: 'btn btn-sm btn-outline-secondary mr-1',
                        onClick: () => handleExportQBOCSV(invoice)
                      }, 'QBO CSV'),
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
