import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Workbox } from 'workbox-window';

// Polyfill globals needed for WooCommerce API
import { Buffer } from 'buffer';
window.Buffer = Buffer;

// Register service worker using workbox-window
if ('serviceWorker' in navigator) {
  const wb = new Workbox('/service-worker.js');

  wb.addEventListener('installed', event => {
    if (event.isUpdate) {
      // Show a notification that an update is available
      if (confirm('New app update is available! Click OK to refresh.')) {
        window.location.reload();
      }
    }
  });

  wb.addEventListener('waiting', () => {
    // Show a notification that an update is waiting
    if (confirm('New app update is waiting to be installed. Install now?')) {
      wb.messageSkipWaiting();
    }
  });

  wb.addEventListener('controlling', () => {
    window.location.reload();
  });

  wb.register();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);