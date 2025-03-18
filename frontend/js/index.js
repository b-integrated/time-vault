// Main entry point for the TimeVault React application

// Add console logs for debugging
console.log('index.js loaded');
console.log('React:', React);
console.log('ReactDOM:', ReactDOM);
console.log('App component:', App);

// Render the App component into the root element directly
// without waiting for DOMContentLoaded
try {
  const rootElement = document.getElementById('root');
  console.log('Root element:', rootElement);
  
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    console.log('React root created');
    
    root.render(React.createElement(App));
    console.log('App rendered');
  } else {
    console.error('Root element not found');
  }
} catch (error) {
  console.error('Error rendering App:', error);
}