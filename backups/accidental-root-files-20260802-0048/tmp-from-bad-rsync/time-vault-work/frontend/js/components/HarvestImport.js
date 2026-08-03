// HarvestImport component for manual, preview-first legacy imports.

function HarvestImport({ user }) {
  const [activeImport, setActiveImport] = React.useState('time');
  const [timeFile, setTimeFile] = React.useState(null);
  const [invoiceFile, setInvoiceFile] = React.useState(null);
  const [isWorking, setIsWorking] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');

  const API_URL = '/api';

  const importConfigs = {
    time: {
      title: 'Time Entries',
      endpoint: '/import/harvest-time',
      accept: '.csv,text/csv',
      file: timeFile,
      setFile: setTimeFile,
      help: 'Upload a Harvest time report CSV. Include Harvest entry IDs for clean duplicate detection.'
    },
    invoices: {
      title: 'Invoices',
      endpoint: '/import/harvest-invoices',
      accept: '.json,application/json',
      file: invoiceFile,
      setFile: setInvoiceFile,
      help: 'Upload a Harvest invoice JSON export. Existing invoices are updated by Harvest ID or invoice number.'
    }
  };

  const current = importConfigs[activeImport];

  function selectedFile() {
    return current.file;
  }

  function resetOutput() {
    setPreview(null);
    setResult(null);
    setError('');
  }

  function runImport(mode) {
    const file = selectedFile();
    if (!file) {
      setError(`Choose a Harvest ${current.title.toLowerCase()} file first`);
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const formData = new FormData();
    formData.append('file', file);
    if (user && user.id) {
      formData.append('userId', user.id);
    }

    setIsWorking(true);
    setError('');
    if (mode === 'preview') {
      setPreview(null);
      setResult(null);
    }

    const endpoint = mode === 'preview' ? `${current.endpoint}/preview` : current.endpoint;
    fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })
    .then(response => response.json().then(data => {
      if (!response.ok) {
        throw new Error(data.errors ? data.errors.join('; ') : `${current.title} import failed`);
      }
      return data;
    }))
    .then(data => {
      if (mode === 'preview') {
        setPreview(data);
      } else {
        setResult(data);
        setPreview(null);
        current.setFile(null);
      }
    })
    .catch(err => {
      console.error('Harvest import failed:', err);
      setError(err.message || `${current.title} import failed`);
    })
    .finally(() => setIsWorking(false));
  }

  function renderSummary(summary, title) {
    if (!summary) return null;

    return React.createElement('div', { className: 'import-summary' },
      React.createElement('h3', null, title),
      React.createElement('div', { className: 'summary-grid compact' },
        React.createElement('div', { className: 'summary-card' },
          React.createElement('span', { className: 'summary-label' }, 'Rows'),
          React.createElement('strong', null, summary.rowsRead)
        ),
        React.createElement('div', { className: 'summary-card' },
          React.createElement('span', { className: 'summary-label' }, summary.dryRun ? 'Will Add' : 'Added'),
          React.createElement('strong', null, summary.imported)
        ),
        React.createElement('div', { className: 'summary-card' },
          React.createElement('span', { className: 'summary-label' }, summary.dryRun ? 'Will Update' : 'Updated'),
          React.createElement('strong', null, summary.updated || 0)
        ),
        React.createElement('div', { className: 'summary-card' },
          React.createElement('span', { className: 'summary-label' }, 'Skipped'),
          React.createElement('strong', null, summary.skipped)
        )
      ),
      React.createElement('div', { className: 'import-detail-list' },
        React.createElement('span', null, `Clients touched: ${summary.clientsUpserted || 0}`),
        activeImport === 'time' && React.createElement('span', null, `Projects touched: ${summary.projectsUpserted || 0}`),
        activeImport === 'invoices' && React.createElement('span', null, `Invoices added: ${summary.invoicesUpserted || summary.imported || 0}`)
      ),
      summary.errors && summary.errors.length > 0 && React.createElement('div', { className: 'alert alert-warning mt-3' },
        React.createElement('strong', null, 'Rows needing review'),
        React.createElement('ul', null,
          summary.errors.slice(0, 10).map((message, index) =>
            React.createElement('li', { key: index }, message)
          )
        )
      )
    );
  }

  return React.createElement('div', { className: 'harvest-import' },
    React.createElement('div', { className: 'page-heading-row' },
      React.createElement('div', null,
        React.createElement('h1', null, 'Import Tools'),
        React.createElement('p', { className: 'page-subtitle' }, 'Manual legacy imports with a preview step before Time Vault changes anything.')
      ),
      React.createElement('button', {
        className: 'btn btn-secondary',
        onClick: () => window.handleNavigation('settings')
      }, 'Settings')
    ),

    error && React.createElement('div', { className: 'alert alert-danger' }, error),

    React.createElement('div', { className: 'segmented-control mb-4' },
      Object.keys(importConfigs).map(key =>
        React.createElement('button', {
          key,
          type: 'button',
          className: `segmented-button ${activeImport === key ? 'active' : ''}`,
          onClick: () => {
            setActiveImport(key);
            resetOutput();
          }
        }, importConfigs[key].title)
      )
    ),

    React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, `Manual ${current.title} Import`)
      ),
      React.createElement('div', { className: 'card-body' },
        React.createElement('p', { className: 'muted-copy' }, current.help),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', { htmlFor: 'harvestImportFile', className: 'form-label' }, 'Import file'),
          React.createElement('input', {
            id: 'harvestImportFile',
            className: 'form-control',
            type: 'file',
            accept: current.accept,
            onChange: (event) => {
              current.setFile(event.target.files[0] || null);
              resetOutput();
            }
          })
        ),
        React.createElement('div', { className: 'button-row mt-3' },
          React.createElement('button', {
            type: 'button',
            className: 'btn btn-secondary',
            disabled: isWorking || !selectedFile(),
            onClick: () => runImport('preview')
          }, isWorking ? 'Checking...' : 'Preview Import'),
          React.createElement('button', {
            type: 'button',
            className: 'btn btn-primary',
            disabled: isWorking || !preview || (preview.errors && preview.errors.length > 0),
            onClick: () => runImport('import')
          }, isWorking ? 'Importing...' : 'Import Now')
        )
      )
    ),

    preview && React.createElement('div', { className: 'card mb-4' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Preview')
      ),
      React.createElement('div', { className: 'card-body' },
        renderSummary(preview, 'No changes have been made yet.'),
        React.createElement('p', { className: 'muted-copy mt-3' }, 'Review the counts, then tap Import Now to write these records through the app import API.')
      )
    ),

    result && React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('h2', null, 'Import Complete')
      ),
      React.createElement('div', { className: 'card-body' },
        renderSummary(result, 'Time Vault has been updated.')
      )
    )
  );
}

window.HarvestImport = HarvestImport;
