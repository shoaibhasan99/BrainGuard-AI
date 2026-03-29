import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log('main.tsx executing - React version:', React.version);
console.log('About to mount App component');

// Add error boundary for debugging
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          background: '#ff0000', 
          color: 'white', 
          fontFamily: 'monospace',
          minHeight: '100vh'
        }}>
          <h1>React Error Detected!</h1>
          <p>Error: {this.state.error?.message}</p>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Add mount debugging with better error handling
const rootElement = document.getElementById('root');
console.log('🔍 Root element found:', rootElement);

if (!rootElement) {
  console.error('❌ Root element not found!');
  document.body.innerHTML = '<div style="color: red; padding: 20px; background: white; font-family: monospace;">ERROR: Root element not found! Check index.html</div>';
} else {
  try {
    console.log('✅ Creating React root...');
    const root = ReactDOM.createRoot(rootElement);
    
    console.log('✅ Rendering App component...');
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    console.log('✅ App component rendered successfully!');
  } catch (error) {
    console.error('❌ Fatal error during render:', error);
    rootElement.innerHTML = `
      <div style="color: red; padding: 20px; background: white; font-family: monospace;">
        <h1>Fatal Render Error</h1>
        <p>${String(error)}</p>
        <pre>${error instanceof Error ? error.stack : 'Unknown error'}</pre>
      </div>
    `;
  }
}
