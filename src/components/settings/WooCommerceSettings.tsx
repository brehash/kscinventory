import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag,
  Check, 
  X, 
  AlertTriangle, 
  Loader2, 
  ExternalLink, 
  Key, 
  Globe,
  Lock,
  RefreshCw
} from 'lucide-react';

// WooCommerce API client
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

/**
 * WooCommerceSettings component for managing WooCommerce API integration settings
 */
const WooCommerceSettings: React.FC = () => {
  // State for WooCommerce settings
  const [url, setUrl] = useState<string>('');
  const [consumerKey, setConsumerKey] = useState<string>('');
  const [consumerSecret, setConsumerSecret] = useState<string>('');
  
  // State for connection status
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking' | 'unchecked'>('unchecked');
  const [connectionDetails, setConnectionDetails] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Load settings from local storage on mount
  useEffect(() => {
    const storedUrl = localStorage.getItem('wc_url');
    const storedConsumerKey = localStorage.getItem('wc_consumer_key');
    const storedConsumerSecret = localStorage.getItem('wc_consumer_secret');
    const storedConnectionStatus = localStorage.getItem('wc_connection_status');
    
    if (storedUrl) setUrl(storedUrl);
    if (storedConsumerKey) setConsumerKey(storedConsumerKey);
    if (storedConsumerSecret) setConsumerSecret(storedConsumerSecret);
    if (storedConnectionStatus && (storedConnectionStatus === 'connected' || storedConnectionStatus === 'disconnected')) {
      setConnectionStatus(storedConnectionStatus);
    }
  }, []);
  
  // Save settings to local storage when they change
  useEffect(() => {
    if (url) localStorage.setItem('wc_url', url);
    if (consumerKey) localStorage.setItem('wc_consumer_key', consumerKey);
    if (consumerSecret) localStorage.setItem('wc_consumer_secret', consumerSecret);
    if (connectionStatus !== 'checking' && connectionStatus !== 'unchecked') {
      localStorage.setItem('wc_connection_status', connectionStatus);
    }
  }, [url, consumerKey, consumerSecret, connectionStatus]);
  
  /**
   * Check connection to WooCommerce API
   */
  const checkConnection = async () => {
    // Validate input fields
    if (!url || !consumerKey || !consumerSecret) {
      setError('Please fill in all fields');
      return;
    }
    
    // Reset status
    setConnectionStatus('checking');
    setConnectionDetails('');
    setError(null);
    
    try {
      // Initialize WooCommerce API
      const api = new WooCommerceRestApi({
        url: url.trim(),
        consumerKey: consumerKey.trim(),
        consumerSecret: consumerSecret.trim(),
        version: 'wc/v3'
      });
      
      // Test connection by getting store information
      const response = await api.get('');
      
      // Check if response is valid
      if (response && response.status === 200) {
        setConnectionStatus('connected');
        
        // Extract store information
        const storeInfo = {
          name: response.data?.name || 'Unknown',
          description: response.data?.description || 'No description',
          url: response.data?.url || url
        };
        
        setConnectionDetails(`Connected to ${storeInfo.name}`);
      } else {
        setConnectionStatus('disconnected');
        setError('Connection failed: Unexpected response from server');
      }
    } catch (err) {
      console.error('WooCommerce connection error:', err);
      
      // Extract and display error message
      let errorMessage = 'Connection failed';
      
      if (err instanceof Error) {
        // Handle specific error types
        if (err.message.includes('401')) {
          errorMessage = 'Authentication failed: Invalid credentials';
        } else if (err.message.includes('404')) {
          errorMessage = 'Store not found: Please check the URL';
        } else if (err.message.includes('CORS')) {
          errorMessage = 'CORS error: Your store needs to enable CORS for API access';
        } else if (err.message.includes('Network Error')) {
          errorMessage = 'Network error: Unable to connect to the server';
        } else {
          errorMessage = `Error: ${err.message}`;
        }
      }
      
      setConnectionStatus('disconnected');
      setError(errorMessage);
    }
  };
  
  /**
   * Get connection status badge based on current status
   */
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <Check className="h-4 w-4 mr-1" />
            Connected
          </span>
        );
      case 'disconnected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <X className="h-4 w-4 mr-1" />
            Disconnected
          </span>
        );
      case 'checking':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            Checking...
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Not Checked
          </span>
        );
    }
  };
  
  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">WooCommerce Integration</h1>
          <p className="text-gray-600">Connect to your WooCommerce store to sync products and orders</p>
        </div>
        <div>
          {getStatusBadge()}
        </div>
      </div>
      
      {/* Connection Status Card */}
      {connectionStatus !== 'unchecked' && (
        <div className={`mb-6 p-4 rounded-md ${
          connectionStatus === 'connected' 
            ? 'bg-green-50 border border-green-100' 
            : connectionStatus === 'disconnected' 
              ? 'bg-red-50 border border-red-100' 
              : 'bg-blue-50 border border-blue-100'
        }`}>
          <div className="flex items-start">
            {connectionStatus === 'connected' ? (
              <Check className="h-5 w-5 mt-0.5 mr-2 text-green-500" />
            ) : connectionStatus === 'disconnected' ? (
              <X className="h-5 w-5 mt-0.5 mr-2 text-red-500" />
            ) : (
              <Loader2 className="h-5 w-5 mt-0.5 mr-2 animate-spin text-blue-500" />
            )}
            
            <div>
              {connectionStatus === 'connected' ? (
                <>
                  <h3 className="font-medium text-green-800">Successfully connected</h3>
                  {connectionDetails && (
                    <p className="mt-1 text-sm text-green-700">{connectionDetails}</p>
                  )}
                </>
              ) : connectionStatus === 'disconnected' ? (
                <>
                  <h3 className="font-medium text-red-800">Connection failed</h3>
                  {error && (
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  )}
                </>
              ) : (
                <h3 className="font-medium text-blue-800">Checking connection...</h3>
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6">
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-1">
              <label htmlFor="wc_url" className="block text-sm font-medium text-gray-700">
                <Globe className="h-4 w-4 inline-block mr-1.5" />
                Store URL
              </label>
              <input
                type="url"
                id="wc_url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="https://your-store.com"
              />
              <p className="text-xs text-gray-500">
                Your WooCommerce store URL (e.g., https://example.com)
              </p>
            </div>
            
            <div className="space-y-1">
              <label htmlFor="wc_consumer_key" className="block text-sm font-medium text-gray-700">
                <Key className="h-4 w-4 inline-block mr-1.5" />
                Consumer Key
              </label>
              <input
                type="text"
                id="wc_consumer_key"
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="ck_xxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-500">
                Your WooCommerce API Consumer Key
              </p>
            </div>
            
            <div className="space-y-1">
              <label htmlFor="wc_consumer_secret" className="block text-sm font-medium text-gray-700">
                <Lock className="h-4 w-4 inline-block mr-1.5" />
                Consumer Secret
              </label>
              <input
                type="password"
                id="wc_consumer_secret"
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="cs_xxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-500">
                Your WooCommerce API Consumer Secret
              </p>
            </div>
            
            <div className="pt-2">
              <button
                type="button"
                onClick={checkConnection}
                disabled={connectionStatus === 'checking'}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {connectionStatus === 'checking' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking Connection...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Check Connection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <ShoppingBag className="h-6 w-6 text-indigo-500" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">WooCommerce REST API</h3>
            <p className="mt-1 text-sm text-gray-500">
              To connect your WooCommerce store, you need to create REST API keys in your WooCommerce settings.
            </p>
            <div className="mt-3">
              <a 
                href="https://docs.woocommerce.com/document/woocommerce-rest-api/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
              >
                How to generate API keys
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
            <div className="mt-4 bg-white p-3 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Required permissions:</h4>
              <ul className="space-y-1 text-xs text-gray-700 list-disc list-inside">
                <li>Read access to Products</li>
                <li>Read/Write access to Orders</li>
                <li>Read access to System Status</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WooCommerceSettings;