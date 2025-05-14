import React from 'react';
import { OrderStatus } from '../../types';
import { CheckCircle, RefreshCw } from 'lucide-react';
import Modal from '../ui/Modal';

interface OrderStatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: OrderStatus;
  newStatus: OrderStatus;
  setNewStatus: (status: OrderStatus) => void;
  updateOrderStatus: () => void;
  updatingStatus: boolean;
  orderNumber: string;
}

const OrderStatusUpdateModal: React.FC<OrderStatusUpdateModalProps> = ({
  isOpen,
  onClose,
  status,
  newStatus,
  setNewStatus,
  updateOrderStatus,
  updatingStatus,
  orderNumber
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Order Status"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Select a new status for Order #{orderNumber}
        </p>
        <div className="mt-4">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Order Status
          </label>
          <select
            id="status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="pending">Pending</option>
            <option value="preluata">Preluata</option>
            <option value="pregatita">Pregatita</option>
            <option value="impachetata">Impachetata</option>
            <option value="expediata">Expediata</option>
            <option value="returnata">Returnata</option>
            <option value="refuzata">Refuzata</option>
            <option value="neonorata">Neonorata</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        
        {newStatus === 'completed' && status !== 'completed' && (
          <div className="bg-green-50 p-3 rounded-md text-sm text-green-800">
            <div className="flex items-start">
              <div className="flex-shrink-0 mt-0.5">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div className="ml-2">
                <p className="font-medium">Order will be marked as fulfilled</p>
                <p className="mt-1 text-green-700">
                  This will record the fulfillment date and user for the order.
                </p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={updateOrderStatus}
            disabled={updatingStatus || newStatus === status}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {updatingStatus ? (
              <>
                <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                Updating...
              </>
            ) : (
              'Update Status'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OrderStatusUpdateModal;