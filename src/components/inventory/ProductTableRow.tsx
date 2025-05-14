import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../../types';
import { Edit, Trash, AlertTriangle } from 'lucide-react';

interface ProductTableRowProps {
  product: Product;
  getCategoryName: (categoryId: string) => string;
  getLocationName: (locationId: string) => string;
  getProviderName: (providerId: string) => string;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

const ProductTableRow: React.FC<ProductTableRowProps> = ({
  product,
  getCategoryName,
  getLocationName,
  getProviderName,
  onEdit,
  onDelete
}) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <Link 
              to={`/products/${product.id}`}
              className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              {product.name}
            </Link>
          </div>
        </div>
      </td>
      <td className="hidden sm:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
        <div className="text-xs sm:text-sm text-gray-500">{product.barcode || '-'}</div>
      </td>
      <td className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
          {getCategoryName(product.categoryId)}
        </span>
      </td>
      <td className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
        {getLocationName(product.locationId)}
      </td>
      <td className="hidden lg:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
          {product.providerId ? getProviderName(product.providerId) : 'None'}
        </span>
      </td>
      <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
        <div className="flex items-center">
          {product.quantity <= product.minQuantity && (
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 mr-1" />
          )}
          <span className={`text-xs sm:text-sm ${product.quantity <= product.minQuantity ? 'text-amber-500 font-medium' : 'text-gray-500'}`}>
            {product.quantity}
          </span>
        </div>
      </td>
      <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
        {product.price.toFixed(2)} RON
      </td>
      <td className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
        {product.vatPercentage || 0}%
      </td>
      <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
        <div className="flex justify-end space-x-2">
          <Link
            to={`/products/${product.id}`}
            className="text-indigo-600 hover:text-indigo-900"
            title="View details"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
          <button
            onClick={() => onEdit(product)}
            className="text-indigo-600 hover:text-indigo-900"
          >
            <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <button
            onClick={() => onDelete(product)}
            className="text-red-600 hover:text-red-900"
          >
            <Trash className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default ProductTableRow;