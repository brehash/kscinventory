import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';

interface ProductDeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  productName?: string;
}

const ProductDeleteConfirmation: React.FC<ProductDeleteConfirmationProps> = ({
  isOpen,
  onClose,
  onDelete,
  productName
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Product"
    >
      <div className="sm:flex sm:items-start">
        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-10 w-10 sm:h-10 sm:w-10 rounded-full bg-red-100 sm:mx-0">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
        </div>
        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
          <p className="text-xs sm:text-sm text-gray-500">
            Are you sure you want to delete {productName}? This action cannot be undone.
          </p>
        </div>
      </div>
      <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
        <button
          type="button"
          onClick={onDelete}
          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-xs sm:text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default ProductDeleteConfirmation;