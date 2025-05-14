import React from 'react';
import { OrderItem } from '../../types';
import { Package } from 'lucide-react';

interface OrderItemsTableProps {
  items: OrderItem[];
}

const OrderItemsTable: React.FC<OrderItemsTableProps> = ({ items }) => {
  return (
    <div>
      <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Order Items</h3>
      <div className="overflow-x-auto bg-gray-50 rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product
              </th>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Price
              </th>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-gray-100 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                      <Package className="h-4 w-4 text-gray-500" />
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-gray-900">{item.productName}</div>
                  </div>
                </td>
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <div className="text-xs sm:text-sm text-gray-500">{item.price.toFixed(2)} RON</div>
                </td>
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <div className="text-xs sm:text-sm text-gray-500">{item.quantity}</div>
                </td>
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <div className="text-xs sm:text-sm font-medium text-gray-900">{item.total.toFixed(2)} RON</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderItemsTable;