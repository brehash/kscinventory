import React from 'react';
import { Product } from '../../types';
import { ArrowUp, ArrowDown, Package, Loader2 } from 'lucide-react';
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
  handleMoveItems?: (product: Product) => void;
  loading?: boolean; // Added loading prop
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
  confirmDelete,
  handleMoveItems,
  loading = false // Default to false if not provided
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
          {loading ? (
            <tr>
              <td colSpan={9} className="px-4 sm:px-6 py-4 text-center text-gray-500">
                <div className="flex justify-center items-center">
                  <Loader2 className="animate-spin h-6 w-6 text-indigo-500 mr-2" />
                  <span>Loading products...</span>
                </div>
              </td>
            </tr>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <ProductTableRow 
                key={product.id}
                product={product}
                getCategoryName={getCategoryName}
                getLocationName={getLocationName}
                getProviderName={getProviderName}
                onEdit={handleOpenEditModal}
                onDelete={confirmDelete}
                onMove={handleMoveItems}
              />
            ))
          ) : (
            <tr>
              <td colSpan={9} className="px-4 sm:px-6 py-4 text-center text-gray-500">
                <div className="py-8">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-base font-medium">No products found</p>
                  <p className="text-sm mt-1">Try adjusting your search or filter criteria</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductTable;
