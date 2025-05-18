import React from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Order } from '../../types';
import OrderStatusBadge from './OrderStatusBadge';
import { ChevronRight, AlertTriangle } from 'lucide-react';

interface OrderTableRowProps {
  order: Order;
}

const OrderTableRow: React.FC<OrderTableRowProps> = ({ order }) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-900 hover:underline">
            <Link to={`/orders/${order.id}`}>#{order.orderNumber}</Link>
          </div>
          {order.hasUnidentifiedItems && (
            <span 
              title="Contains unidentified products" 
              className="ml-2 flex-shrink-0 inline-block"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            </span>
          )}
          {order.source === 'woocommerce' && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-teal-100 text-teal-800">
              WC
            </span>
          )}
        </div>
      </td>
      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
        {order.customerName}
      </td>
      <td className="hidden sm:table-cell px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
        {format(order.orderDate, 'MMM d, yyyy')}
      </td>
      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
        <OrderStatusBadge status={order.status} />
      </td>
      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
        {order.total.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON
      </td>
      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
        <Link 
          to={`/orders/${order.id}`}
          className="text-indigo-600 hover:text-indigo-900"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </td>
    </tr>
  );
};

export default OrderTableRow;