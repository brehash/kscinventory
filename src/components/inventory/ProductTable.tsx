import React from 'react';
import { Product } from '../../types';
import { ArrowUp, ArrowDown } from 'lucide-react';
import ProductTableRow from './ProductTableRow';

interface ProductTableProps {
  filteredProducts: Product[];
  getCategoryName: (categoryId: string) => string;
  getLocationName: (locationId: string) => string;
  getProductTypeName: (typeId: string) => string;
  getProviderName: (providerId: string) => string;
  sortField: keyof Product;
  sortDirection: 'asc' | 'desc';
  handleSort: (field: keyof Product) => void;
  handleOpenEditModal: (product: Product) => void;
  confirmDelete: (product: Product) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({
  filteredProducts,
  getCategoryName,
  getLocationName,
  getProductTypeName,
  getProviderName,
  sortField,
  sortDirection,
  handleSort,
  handleOpenEditModal,
  confirmDelete
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th 
              scope="col" 
              className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('name')}
            >
              <div className="flex items-center">
                <span>Name</span>
                {sortField === 'name' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                  <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                )}
              </div>
            </th>
            <th 
              scope="col" 
              className="hidden sm:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('barcode')}
            >
              <div className="flex items-center">
                <span>Barcode</span>
                {sortField === 'barcode' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                  <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                )}
              </div>
            </th>
            <th 
              scope="col" 
              className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Category
            </th>
            <th 
              scope="col" 
              className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Location
            </th>
            <th 
              scope="col" 
              className="hidden lg:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Provider
            </th>
            <th 
              scope="col" 
              className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('quantity')}
            >
              <div className="flex items-center">
                <span>Qty</span>
                {sortField === 'quantity' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                  <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                )}
              </div>
            </th>
            <th 
              scope="col" 
              className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('price')}
            >
              <div className="flex items-center">
                <span>Price</span>
                {sortField === 'price' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                  <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                )}
              </div>
            </th>
            <th 
              scope="col" 
              className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
              onClick={() => handleSort('vatPercentage')}
            >
              <div className="flex items-center">
                <span>VAT</span>
                {sortField === 'vatPercentage' && (
                  sortDirection === 'asc' ? 
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                  <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                )}
              </div>
            </th>
            <th scope="col" className="relative px-4 sm:px-6 py-2 sm:py-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <ProductTableRow 
                key={product.id}
                product={product}
                getCategoryName={getCategoryName}
                getLocationName={getLocationName}
                getProviderName={getProviderName}
                onEdit={handleOpenEditModal}
                onDelete={confirmDelete}
              />
            ))
          ) : (
            <tr>
              <td colSpan={9} className="px-4 sm:px-6 py-4 text-center text-gray-500">
                No products found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;