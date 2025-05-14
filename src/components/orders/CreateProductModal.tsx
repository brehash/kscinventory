import React from 'react';
import { UnidentifiedItem } from '../../types';
import Modal from '../ui/Modal';
import { AlertTriangle, Plus } from 'lucide-react';

interface CreateProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: UnidentifiedItem | null;
  onCreateProduct: () => void;
}

const CreateProductModal: React.FC<CreateProductModalProps> = ({
  isOpen,
  onClose,
  item,
  onCreateProduct
}) => {
  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Product from WooCommerce"
    >
      <div className="space-y-4">
        <div className="bg-amber-50 p-4 rounded-md">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">Unidentified Product</h3>
              <p className="mt-1 text-xs text-amber-700">
                This product from WooCommerce doesn't match any products in your inventory system.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 border border-gray-200 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Product Details from WooCommerce:</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-gray-500">Name:</dt>
            <dd className="text-gray-900 font-medium">{item.name}</dd>
            
            <dt className="text-gray-500">SKU/Barcode:</dt>
            <dd className="text-gray-900 font-medium">{item.sku || "No SKU"}</dd>
            
            <dt className="text-gray-500">Price:</dt>
            <dd className="text-gray-900 font-medium">{item.price.toFixed(2)} RON</dd>
            
            <dt className="text-gray-500">Quantity:</dt>
            <dd className="text-gray-900 font-medium">{item.quantity}</dd>
          </dl>
        </div>
        
        <p className="text-sm text-gray-600">
          Would you like to create a new product in your inventory system using these details? This will allow you to track stock for this product.
        </p>
        
        <div className="flex justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreateProduct}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-4 w-4 inline mr-1" /> 
            Create Product
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateProductModal;