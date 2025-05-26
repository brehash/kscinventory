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
  RefreshCw,
  Download,
  ListPlus,
  Layers,
  Database
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { syncWooCommerceOrders } from '../../utils/wooCommerceSync';
import { useAuth } from '../auth/AuthProvider';
import Modal from '../ui/Modal';
import WooCommerceProductMapping from './WooCommerceProductMapping';

// WooCommerce API client
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

/**
 * WooCommerceSettings component for managing WooCommerce API integration settings
 */
const WooCommerceSettings: React.FC = () => {
  const { currentUser } = useAuth();
  // State for WooCommerce settings
  const [url, setUrl] = useState<string>('');
  const [consumerKey, setConsumerKey] = useState<string>('');
  const [consumerSecret, setConsumerSecret] = useState<string>('');
  
  // State for connection status
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking' | 'unchecked'>('unchecked');
  const [connectionDetails, setConnectionDetails] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Sync modal state
  const [showSyncModal, setShowSyncModal] = useState<boolean>(false);
  const [syncInProgress, setSyncInProgress] = useState<boolean>(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'settings' | 'products'>('settings');
  
  // Progress indicator state
  const [syncProgress, setSyncProgress] = useState<{
    totalFound: number;
    processed: number;
    stage: 'finding' | 'processing' | 'complete' | 'idle';
    currentOrderNumber?: string;
  }>({
    totalFound: 0,
    processed: 0,
    stage: 'idle'
  });
  
  // Loading state for saving settings
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Load settings from Firestore on mount
  useEffect(() => {
    const fetchWooCommerceSettings = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'woocommerce_settings', 'global_settings');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUrl(data.wc_url || '');
          setConsumerKey(data.wc_consumer_key || '');
          setConsumerSecret(data.wc_consumer_secret || '');
          setConnectionStatus(data.connection_status || 'unchecked');
          setConnectionDetails(data.connection_details || '');
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching WooCommerce settings:", error);
        setError("Failed to load WooCommerce settings");
        setLoading(false);
      }
    };

    fetchWooCommerceSettings();
  }, []);
  
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
        
        const connectionDetailsText = `Connected to ${storeInfo.name}`;
        setConnectionDetails(connectionDetailsText);
        
        // Save settings to Firestore
        await saveSettingsToFirebase(url, consumerKey, consumerSecret, 'connected', connectionDetailsText);
      } else {
        setConnectionStatus('disconnected');
        setError('Connection failed: Unexpected response from server');
        
        // Save failed status to Firestore
        await saveSettingsToFirebase(url, consumerKey, consumerSecret, 'disconnected');
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
      
      // Save failed status to Firestore
      await saveSettingsToFirebase(url, consumerKey, consumerSecret, 'disconnected');
    }
  };
  
  /**
   * Save WooCommerce settings to Firebase
   */
  const saveSettingsToFirebase = async (
    wcUrl: string,
    wcConsumerKey: string,
    wcConsumerSecret: string,
    status: string = 'unchecked',
    details: string = ''
  ) => {
    try {
      setLoading(true);
      const docRef = doc(db, 'woocommerce_settings', 'global_settings');
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Update existing document
        await updateDoc(docRef, {
          wc_url: wcUrl,
          wc_consumer_key: wcConsumerKey,
          wc_consumer_secret: wcConsumerSecret,
          connection_status: status,
          connection_details: details,
          updated_at: new Date()
        });
      } else {
        // Create new document
        await setDoc(docRef, {
          wc_url: wcUrl,
          wc_consumer_key: wcConsumerKey,
          wc_consumer_secret: wcConsumerSecret,
          connection_status: status,
          connection_details: details,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
      
      setSuccess('WooCommerce settings saved successfully');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (error) {
      console.error('Error saving WooCommerce settings to Firebase:', error);
      setError('Failed to save settings to database');
    } finally {
      setLoading(false);
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

  /**
   * Start the WooCommerce order sync process
   */
  const startOrderSync = async () => {
    if (!currentUser) return;
    
    setSyncInProgress(true);
    setSyncResult(null);
    setError(null);
    
    // Reset progress
    setSyncProgress({
      totalFound: 0,
      processed: 0,
      stage: 'finding'
    });
    
    try {
      // Set progress to finding
      setSyncProgress(prev => ({ ...prev, stage: 'finding' }));
      
      // Start the sync process
      const result = await syncWooCommerceOrders(currentUser);
      
      if (result.success) {
        // Update progress to show complete
        setSyncProgress(prev => ({
          ...prev,
          processed: result.newOrders + result.updatedOrders,
          totalFound: result.newOrders + result.updatedOrders,
          stage: 'complete'
        }));
        
        setSyncResult(result);
        
      } else {
        setError(result.error || 'Sync failed');
        
        // Reset progress on error
        setSyncProgress(prev => ({
          ...prev,
          stage: 'idle'
        }));
      }
    } catch (err) {
      console.error('Error syncing orders:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      
      // Reset progress on error
      setSyncProgress(prev => ({
        ...prev,
        stage: 'idle'
      }));
    } finally {
      setSyncInProgress(false);
    }
  };
  
  /**
   * Get progress message based on current sync progress
   */
  const getProgressMessage = () => {
    const { totalFound, processed, stage, currentOrderNumber } = syncProgress;
    
    switch (stage) {
      case 'finding':
        return 'Finding orders from WooCommerce...';
      case 'processing':
        return `Found ${totalFound} orders. Syncing ${processed} of ${totalFound}${currentOrderNumber ? ` (Order #${currentOrderNumber})` : ''}...`;
      case 'complete':
        return `Synced ${processed} of ${totalFound} orders successfully.`;
      default:
        return 'Starting sync...';
    }
  };
  
  /**
   * Calculate the progress percentage for the progress bar
   */
  const getProgressPercentage = () => {
    const { totalFound, processed, stage } = syncProgress;
    
    if (stage === 'finding' || totalFound === 0) return 10;
    if (stage === 'complete') return 100;
    
    // Calculate percentage with minimum of 10%
    const percentage = Math.max(10, Math.round((processed / totalFound) * 100));
    return Math.min(percentage, 95); // Cap at 95% until complete
  };
  
  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">WooCommerce Integration</h1>
          <p className="text-gray-600">Connect to your WooCommerce store to sync products and orders</p>
        </div>
        <div className="flex items-center space-x-3">
          {connectionStatus === 'connected' && (
            <button
              onClick={() => setShowSyncModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Sync WooCommerce Orders
            </button>
          )}
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
      
      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
          <div className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}
      
      {/* Error Message */}
      {error && connectionStatus !== 'disconnected' && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`${
              activeTab === 'settings'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            API Settings
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`${
              activeTab === 'products'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Layers className="h-4 w-4 mr-1.5" />
            Product Mapping
          </button>
        </nav>
      </div>

      {activeTab === 'settings' && (
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
              
              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={checkConnection}
                  disabled={connectionStatus === 'checking' || loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {connectionStatus === 'checking' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking Connection...
                    </>
                  ) : loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Check Connection
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => saveSettingsToFirebase(url, consumerKey, consumerSecret, connectionStatus, connectionDetails)}
                  disabled={loading || connectionStatus === 'checking'}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Settings"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'products' && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          {connectionStatus === 'connected' ? (
            <WooCommerceProductMapping />
          ) : (
            <div className="text-center py-10">
              <Database className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Connect to WooCommerce First</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
                You need to establish a connection to your WooCommerce store before 
                you can map products for stock synchronization.
              </p>
              <button
                onClick={() => setActiveTab('settings')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Globe className="h-4 w-4 mr-1.5" />
                Go to API Settings
              </button>
            </div>
          )}
        </div>
      )}
      
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
                <li>Write access to Products (for stock updates)</li>
                <li>Read/Write access to Orders</li>
                <li>Read access to System Status</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Sync Orders Modal */}
      <Modal
        isOpen={showSyncModal}
        onClose={() => !syncInProgress && setShowSyncModal(false)}
        title="Sync WooCommerce Orders"
      >
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 mt-0.5 mr-2 text-red-500" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Sync Error</h3>
                  <p className="mt-1 text-xs text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {syncProgress.stage !== 'idle' && (
            <div className="bg-blue-50 p-4 rounded-md">
              <div className="flex flex-col">
                <div className="flex items-center mb-2">
                  {syncProgress.stage === 'complete' ? (
                    <Check className="h-5 w-5 text-green-500 mr-2" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500 mr-2" />
                  )}
                  <p className="text-sm font-medium text-blue-800">
                    {getProgressMessage()}
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div 
                    className={`h-2.5 rounded-full ${syncProgress.stage === 'complete' ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${getProgressPercentage()}%` }}
                  ></div>
                </div>
                
                {syncProgress.stage !== 'finding' && syncProgress.stage !== 'complete' && (
                  <p className="text-xs text-blue-700 text-center">
                    This may take a few minutes depending on the number of orders
                  </p>
                )}
              </div>
            </div>
          )}
          
          {syncResult && (
            <div className="bg-green-50 p-4 rounded-md border border-green-100">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <Check className="h-5 w-5 text-green-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">Sync Completed Successfully</h3>
                  
                  <div className="mt-2 text-xs text-green-700 space-y-1">
                    <p className="flex items-center">
                      <ListPlus className="h-3.5 w-3.5 mr-1" />
                      New orders: {syncResult.newOrders}
                    </p>
                    <p className="flex items-center">
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Updated orders: {syncResult.updatedOrders}
                    </p>

                    {syncResult.ordersWithUnidentifiedItems > 0 && (
                      <p className="flex items-center text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                        Orders with unidentified products: {syncResult.ordersWithUnidentifiedItems}
                      </p>
                    )}
                    
                    {(syncResult.newClients > 0 || syncResult.updatedClients > 0) && (
                      <>
                        <div className="border-t border-green-200 my-2 pt-2">
                          <p className="font-medium text-green-800">CRM Updates:</p>
                        </div>
                        
                        {syncResult.newClients > 0 && (
                          <p className="pl-1">New clients: {syncResult.newClients}</p>
                        )}
                        
                        {syncResult.updatedClients > 0 && (
                          <p className="pl-1">Updated clients: {syncResult.updatedClients}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-4 sm:mt-5 sm:flex sm:flex-row-reverse">
            {!syncInProgress && syncResult && (
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Close
              </button>
            )}
            
            {!syncInProgress && !syncResult && (
              <>
                <button
                  type="button"
                  onClick={startOrderSync}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Start Sync
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowSyncModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </>
            )}
            
            {syncInProgress && (
              <button
                type="button"
                disabled
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-400 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm cursor-not-allowed"
              >
                <Loader2 className="animate-spin h-4 w-4 mr-1.5" />
                Syncing...
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WooCommerceSettings;