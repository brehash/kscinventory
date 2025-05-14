import React from 'react';
import { OrderItem } from '../../types';
import { ShoppingBag, Trash, Plus, Minus, Search } from 'lucide-react';

interface OrderItemsSectionProps {
  items: OrderItem[];
  subtotal: number;
  shippingCost: number;
  setShippingCost: (value: number) => void;
  tax: number;
  setTax: (value: number) => void;
  total: number;
  removeItem: (itemId: string) => void;
  errors: Record<string, string>;
  openAddProductModal: () => void;
}

const OrderItemsSection: React.FC<OrderItemsSectionProps> = ({
  items,
  subtotal,
  shippingCost,
  setShippingCost,
  tax,
  setTax,
  total,
  removeItem,
  errors,
  openAddProductModal
}) => {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base sm:text-lg font-semibold">Order Items</h2>
        <button
          type="button"
          onClick={openAddProductModal}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Product
        </button>
      </div>
      
      {errors.items && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3">
          <p className="text-sm text-red-700">{errors.items}</p>
        </div>
      )}
      
      {items.length === 0 ? (
        <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
          <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No items added</h3>
          <p className="mt-1 text-sm text-gray-500">Click "Add Product" to add items to this order.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{item.price.toFixed(2)} RON</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{item.quantity}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.total.toFixed(2)} RON</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Order Totals */}
      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal:</span>
            <span className="font-medium text-gray-900">{subtotal.toFixed(2)} RON</span>
          </div>
          <div className="flex justify-between text-sm">
            <div className="flex items-center">
              <span className="text-gray-500">Shipping:</span>
              <input
                type="number"
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value))}
                className="ml-2 w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs"
                min="0"
                step="0.01"
              />
            </div>
            <span className="font-medium text-gray-900">{shippingCost.toFixed(2)} RON</span>
          </div>
          <div className="flex justify-between text-sm">
            <div className="flex items-center">
              <span className="text-gray-500">Tax:</span>
              <input
                type="number"
                value={tax}
                onChange={(e) => setTax(Number(e.target.value))}
                className="ml-2 w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs"
                min="0"
                step="0.01"
              />
            </div>
            <span className="font-medium text-gray-900">{tax.toFixed(2)} RON</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-medium">
            <span className="text-gray-900">Total:</span>
            <span className="text-indigo-600">{total.toFixed(2)} RON</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderItemsSection;