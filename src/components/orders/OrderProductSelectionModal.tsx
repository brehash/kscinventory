import React, { useState } from 'react';
import { Product } from '../../types';
import { Search, Package, Loader2, Minus, Plus } from 'lucide-react';
import Modal from '../ui/Modal';

interface OrderProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchLoading: boolean;
  filteredProducts: Product[];
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
  productQuantity: number;
  setProductQuantity: (quantity: number) => void;
  addProductToOrder: () => void;
}

const OrderProductSelectionModal: React.FC<OrderProductSelectionModalProps> = ({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  searchLoading,
  filteredProducts,
  selectedProduct,
  setSelectedProduct,
  productQuantity,
  setProductQuantity,
  addProductToOrder
}) => {
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductQuantity(1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setSearchQuery('');
        setSelectedProduct(null);
        setProductQuantity(1);
      }}
      title="Add Product to Order"
    >
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by name or barcode..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            autoFocus
          />
        </div>
        
        {/* Product list */}
        <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
          {searchLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500 mr-2" />
              <span className="text-sm text-gray-500">Searching...</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-6 text-center">
              {searchQuery ? (
                <p className="text-sm text-gray-500">No products found matching "{searchQuery}"</p>
              ) : (
                <p className="text-sm text-gray-500">Type to search for products</p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <li
                  key={product.id}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                    selectedProduct?.id === product.id ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-500" />
                    </div>
                    <div className="ml-3 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm font-medium text-gray-900">{product.price.toFixed(2)} RON</p>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500">
                          {product.barcode ? `Barcode: ${product.barcode}` : 'No barcode'}
                        </p>
                        <p className={`text-xs ${
                          product.quantity <= product.minQuantity 
                            ? 'text-red-600 font-medium' 
                            : 'text-gray-500'
                        }`}>
                          Stock: {product.quantity} units
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        {/* Product quantity input */}
        {selectedProduct && (
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900">{selectedProduct.name}</h3>
              <p className="text-sm font-medium text-gray-900">{selectedProduct.price.toFixed(2)} RON</p>
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="productQuantity" className="block text-sm font-medium text-gray-700">
                Quantity
              </label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setProductQuantity(Math.max(1, productQuantity - 1))}
                  className="p-1 border border-gray-300 rounded-l-md bg-gray-50 text-gray-500 hover:bg-gray-100"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  id="productQuantity"
                  type="number"
                  min="1"
                  max={selectedProduct.quantity}
                  value={productQuantity}
                  onChange={(e) => setProductQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 border-y border-gray-300 p-1 text-center text-sm"
                />
                <button
                  type="button"
                  onClick={() => setProductQuantity(productQuantity + 1)}
                  className="p-1 border border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex justify-between items-center">
              <p className="text-sm text-gray-500">
                Total: <span className="font-medium text-gray-900">{(selectedProduct.price * productQuantity).toFixed(2)} RON</span>
              </p>
              {productQuantity > selectedProduct.quantity && (
                <p className="text-xs text-red-500">
                  Warning: Quantity exceeds available stock ({selectedProduct.quantity})
                </p>
              )}
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              setSearchQuery('');
              setSelectedProduct(null);
              setProductQuantity(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={addProductToOrder}
            disabled={!selectedProduct}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Add to Order
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OrderProductSelectionModal;