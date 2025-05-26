import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, RefreshCw, Plus, Layers } from 'lucide-react';

interface OrderActionButtonsProps {
  openSyncModal: () => void;
}

const OrderActionButtons: React.FC<OrderActionButtonsProps> = ({ openSyncModal }) => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
      <button
        onClick={() => navigate('/orders/packingslip')}
        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
      >
        <FileText className="h-4 w-4 mr-1.5 sm:mr-2" />
        Basic Packing Slip
      </button>
      
      <button
        onClick={() => navigate('/orders/consolidated-packingslip')}
        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
      >
        <Layers className="h-4 w-4 mr-1.5 sm:mr-2" />
        Consolidated Packing
      </button>
      
      <button
        onClick={openSyncModal}
        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <RefreshCw className="h-4 w-4 mr-1.5 sm:mr-2" />
        Sync WooCommerce
      </button>
      
      <button
        onClick={() => navigate('/orders/new')}
        className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent text-xs sm:text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
        Create Order
      </button>
    </div>
  );
};

export default OrderActionButtons;