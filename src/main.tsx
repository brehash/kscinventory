import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill globals needed for WooCommerce API
import { Buffer } from 'buffer';
window.Buffer = Buffer;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);