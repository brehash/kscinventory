import React from 'react';
import { Order } from '../../types';
import { ArrowUp, ArrowDown } from 'lucide-react';
import OrderTableRow from './OrderTableRow';

interface OrderTableProps {
  orders: Order[];
  handleCheckboxChange: (orderId: string, isChecked: boolean) => void;
  selectedOrderIds: Set<string>;
  sortField: keyof Order;
  sortDirection: 'asc' | 'desc';
  handleSort: (field: keyof Order) => void;
  handleOpenEditModal: (order: Order) => void;
  confirmDelete: (order: Order) => void;
  handleSelectAllOrders: (checked: boolean) => void;
}

const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  handleCheckboxChange,
  selectedOrderIds,
  sortField,
  sortDirection,
  handleSort,
  handleOpenEditModal,
  confirmDelete,
  handleSelectAllOrders
}) => {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <input
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                onChange={(e) => handleSelectAllOrders(e.target.checked)}
                checked={orders.length > 0 && selectedOrderIds.size === orders.length}
              />
            </th>
            <th 
              scope="col" 
              className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('orderNumber')}
            >
              <div className="flex items-center">
                <span>Order #</span>
                {sortField === 'orderNumber' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-4 w-4 ml-1" /> : 
                  <ArrowDown className="h-4 w-4 ml-1" />
                )}
              </div>
            </th>
            <th 
              scope="col" 
              className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('orderDate')}
            >
              <div className="flex items-center">
                <span>Date</span>
                {sortField === 'orderDate' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-4 w-4 ml-1" /> : 
                  <ArrowDown className="h-4 w-4 ml-1" />
                )}
              </div>
            </th>
            <th 
              scope="col" 
              className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('customerName')}
            >
              <div className="flex items-center">
                <span>Customer</span>
                {sortField === 'customerName' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-4 w-4 ml-1" /> : 
                  <ArrowDown className="h-4 w-4 ml-1" />
                )}
              </div>
            </th>
            <th 
              scope="col" 
              className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center">
                <span>Status</span>
                {sortField === 'status' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-4 w-4 ml-1" /> : 
                  <ArrowDown className="h-4 w-4 ml-1" />
                )}
              </div>
            </th>
            <th 
              scope="col" 
              className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Source
            </th>
            <th 
              scope="col" 
              className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('total')}
            >
              <div className="flex items-center">
                <span>Total</span>
                {sortField === 'total' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-4 w-4 ml-1" /> : 
                  <ArrowDown className="h-4 w-4 ml-1" />
                )}
              </div>
            </th>
            <th scope="col" className="relative px-3 sm:px-6 py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {orders.length > 0 ? (
            orders.map(order => (
              <OrderTableRow
                key={order.id}
                order={order}
                handleCheckboxChange={handleCheckboxChange}
                selectedOrderIds={selectedOrderIds}
                handleOpenEditModal={handleOpenEditModal}
                confirmDelete={confirmDelete}
              />
            ))
          ) : (
            <tr>
              <td colSpan={8} className="px-3 sm:px-6 py-4 text-center text-sm text-gray-500">
                No orders found matching your search criteria.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default OrderTable;