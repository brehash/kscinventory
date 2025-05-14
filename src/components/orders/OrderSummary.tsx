import React from 'react';
import { Order } from '../../types';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import OrderStatusBadge from './OrderStatusBadge';
import OrderItemsTable from './OrderItemsTable';

interface OrderSummaryProps {
  order: Order;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ order }) => {
  return (
    <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
        <h2 className="text-base sm:text-lg font-semibold text-gray-800">Order Summary</h2>
        <div className="flex items-center">
          <OrderStatusBadge status={order.status} />
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 sm:mb-6">
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Customer</h3>
          <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
          {order.customerEmail && (
            <p className="text-sm text-gray-500">{order.customerEmail}</p>
          )}
        </div>
        
        <div>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Order Date</h3>
          <div className="flex items-center text-sm text-gray-900">
            <Calendar className="h-4 w-4 mr-1.5 text-gray-400" />
            <span>{format(order.orderDate, 'MMMM d, yyyy')}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Payment method: <span className="font-medium capitalize">{order.paymentMethod.replace('_', ' ')}</span>
          </p>
        </div>
      </div>
      
      {/* Order Items */}
      <OrderItemsTable items={order.items} />
      
      {/* Order Totals */}
      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal:</span>
            <span className="font-medium text-gray-900">{order.subtotal.toFixed(2)} RON</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Shipping:</span>
            <span className="font-medium text-gray-900">{order.shippingCost.toFixed(2)} RON</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Tax:</span>
            <span className="font-medium text-gray-900">{order.tax.toFixed(2)} RON</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base sm:text-lg font-medium">
            <span className="text-gray-900">Total:</span>
            <span className="text-indigo-600">{order.total.toFixed(2)} RON</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;