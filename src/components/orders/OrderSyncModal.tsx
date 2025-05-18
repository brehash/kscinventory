import React, { useState } from 'react';
import { AlertTriangle, Download, Loader2, RefreshCw, CheckCircle, ListPlus } from 'lucide-react';
import Modal from '../ui/Modal';
import { useAuth } from '../auth/AuthProvider';
import { syncWooCommerceOrders } from '../../utils/wooCommerceSync';

interface OrderSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

const OrderSyncModal: React.FC<OrderSyncModalProps> = ({ isOpen, onClose, onSyncComplete }) => {
  const { currentUser } = useAuth();
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  
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
  
  // Handle starting the sync process
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
        
        // Trigger a refresh of the order list
        onSyncComplete();
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
  
  // Get progress message based on current sync progress
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
  
  // Calculate the progress percentage for the progress bar
  const getProgressPercentage = () => {
    const { totalFound, processed, stage } = syncProgress;
    
    if (stage === 'finding' || totalFound === 0) return 10;
    if (stage === 'complete') return 100;
    
    // Calculate percentage with minimum of 10%
    const percentage = Math.max(10, Math.round((processed / totalFound) * 100));
    return Math.min(percentage, 95); // Cap at 95% until complete
  };
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !syncInProgress && onClose()}
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
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
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
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Sync Completed Successfully</h3>
                
                <div className="mt-2 text-xs text-green-700 space-y-1">
                  <p className="flex items-center">
                    <ListPlus className="h-3.5 w-3.5 mr-1" />
                    New orders: {syncResult.newOrders}
                  </p>
                  <p className="flex items-center" >
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
              onClick={onClose}
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
                onClick={onClose}
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
  );
};

export default OrderSyncModal;