import React from 'react';
import { Order } from '../../types';
import { ArrowUp, ArrowDown, ShoppingBag } from 'lucide-react';
import OrderTableRow from './OrderTableRow';

interface OrderTableProps {
  filteredOrders: Order[];
  handleSort: (field: keyof Order) => void;
  sortField: keyof Order;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
}

const OrderTable: React.FC<OrderTableProps> = ({
  filteredOrders,
  handleSort,
  sortField,
  sortDirection,
  loading
}) => {
  if (loading) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  if (filteredOrders.length === 0) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="text-center py-12">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">No orders found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter to find what you're looking for.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('orderNumber')}
              >
                <div className="flex items-center">
                  <span>Order Number</span>
                  {sortField === 'orderNumber' && (
                    sortDirection === 'asc' ?
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> :
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('customerName')}
              >
                <div className="flex items-center">
                  <span>Customer Name</span>
                  {sortField === 'customerName' && (
                    sortDirection === 'asc' ?
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> :
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                  )}
                </div>
              </th>
              <th
                scope="col"
                className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('orderDate')}
              >
                <div className="flex items-center">
                  <span>Order Date</span>
                  {sortField === 'orderDate' && (
                    sortDirection === 'asc' ?
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> :
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                  )}
                </div>
              </th>
              <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th scope="col" className="relative px-3 sm:px-6 py-2 sm:py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.map((order) => (
              <OrderTableRow key={order.id} order={order} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderTable;