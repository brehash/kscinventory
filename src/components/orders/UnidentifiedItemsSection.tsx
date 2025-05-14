import React from 'react';
import { UnidentifiedItem } from '../../types';
import { AlertTriangle, Plus } from 'lucide-react';

interface UnidentifiedItemsSectionProps {
  items: UnidentifiedItem[];
  onCreateProduct: (item: UnidentifiedItem) => void;
}

const UnidentifiedItemsSection: React.FC<UnidentifiedItemsSectionProps> = ({ items, onCreateProduct }) => {
  if (!items || items.length === 0) return null;
  
  return (
    <div className="mt-4 sm:mt-6">
      <h3 className="text-xs font-medium text-amber-600 uppercase mb-2 flex items-center">
        <AlertTriangle className="h-3.5 w-3.5 mr-1" />
        Unidentified Products
      </h3>
      <div className="overflow-x-auto bg-amber-50 rounded-md">
        <table className="min-w-full divide-y divide-amber-200">
          <thead className="bg-amber-50">
            <tr>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                Product
              </th>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                SKU/Barcode
              </th>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                Price
              </th>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                Quantity
              </th>
              <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-amber-800 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="bg-amber-50 divide-y divide-amber-200">
            {items.map((item) => (
              <tr key={`${item.wcProductId}-${item.sku}`} className="hover:bg-amber-100">
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <div className="text-xs sm:text-sm font-medium text-amber-900">{item.name}</div>
                </td>
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <div className="text-xs sm:text-sm text-amber-800">{item.sku || "No SKU"}</div>
                </td>
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <div className="text-xs sm:text-sm text-amber-800">{item.price.toFixed(2)} RON</div>
                </td>
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <div className="text-xs sm:text-sm text-amber-800">{item.quantity}</div>
                </td>
                <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                  <button 
                    onClick={() => onCreateProduct(item)}
                    className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Create Product
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-amber-700">
        These products from WooCommerce don't match any products in your inventory system by barcode/SKU. 
        Create the missing products to track inventory properly.
      </p>
    </div>
  );
};

export default UnidentifiedItemsSection;