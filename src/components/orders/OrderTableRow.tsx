import React from 'react';
import { Link } from 'react-router-dom';
import { Order } from '../../types';
import { AlertTriangle, Edit, Trash } from 'lucide-react';

interface OrderTableRowProps {
  order: Order;
  handleCheckboxChange: (orderId: string, isChecked: boolean) => void;
  selectedOrderIds: Set<string>;
  handleOpenEditModal: (order: Order) => void;
  confirmDelete: (order: Order) => void;
}

const OrderTableRow: React.FC<OrderTableRowProps> = ({ 
  order, 
  handleCheckboxChange, 
  selectedOrderIds, 
  handleOpenEditModal, 
  confirmDelete 
}) => {
  return (
    <tr key={order.id} className="hover:bg-gray-50">
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          onChange={(e) => handleCheckboxChange(order.id, e.target.checked)}
          checked={selectedOrderIds.has(order.id)}
        />
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <Link 
          to={`/orders/${order.id}`} 
          className="flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-900"
        >
          {order.hasUnidentifiedItems && (
            <AlertTriangle className="h-4 w-4 text-amber-500 mr-1.5 inline-block flex-shrink-0" />
          )}
          #{order.orderNumber}
        </Link>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">
          {order.orderDate.toLocaleDateString()}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900">
          {order.customerName}
        </div>
        {order.customerEmail && (
          <div className="text-xs text-gray-500">
            {order.customerEmail}
          </div>
        )}
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
          order.status === 'completed' ? 'bg-green-100 text-green-800' :
          order.status === 'processing' || order.status === 'preluata' || order.status === 'pregatita' || order.status === 'impachetata' ? 'bg-blue-100 text-blue-800' :
          order.status === 'cancelled' || order.status === 'refunded' || order.status === 'failed' || order.status === 'returnata' || order.status === 'refuzata' || order.status === 'neonorata' ? 'bg-red-100 text-red-800' :
          'bg-yellow-100 text-yellow-800'
        }`}>
          {order.status}
        </span>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
          order.source === 'woocommerce' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
        }`}>
          {order.source === 'woocommerce' ? 'WooCommerce' : 'Manual'}
        </span>
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
        {order.total.toFixed(2)} RON
      </td>
      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end space-x-2">
          <button
            onClick={() => handleOpenEditModal(order)}
            className="text-indigo-600 hover:text-indigo-900"
          >
            <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button
            onClick={() => confirmDelete(order)}
            className="text-red-600 hover:text-red-900"
          >
            <Trash className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default OrderTableRow;