import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product } from '../../types';
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import ProductForm from './ProductForm';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { flagOrdersWithProduct } from '../../utils/orderUtils';

const ProductCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [initialData, setInitialData] = useState<Partial<Product>>({ quantity: 1, minQuantity: 1 });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCheckingOrders, setIsCheckingOrders] = useState<boolean>(false);
  const [ordersUpdateResult, setOrdersUpdateResult] = useState<{
    updatedCount: number;
    error?: string;
  } | null>(null);
  
  // Extract data from URL query parameters if present
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const initialProductData: Partial<Product> = {
      quantity: 1,
      minQuantity: 1
    };
    
    // Extract all possible query parameters
    if (queryParams.has('barcode')) {
      initialProductData.barcode = queryParams.get('barcode') || '';
    }
    
    if (queryParams.has('name')) {
      initialProductData.name = queryParams.get('name') || '';
    }
    
    if (queryParams.has('price')) {
      const price = parseFloat(queryParams.get('price') || '0');
      if (!isNaN(price)) {
        initialProductData.price = price;
        // Set a default cost at 80% of the price if not specified
        initialProductData.cost = queryParams.has('cost') 
          ? parseFloat(queryParams.get('cost') || '0') 
          : price * 0.8;
      }
    }
    
    if (queryParams.has('quantity')) {
      const quantity = parseInt(queryParams.get('quantity') || '1', 10);
      if (!isNaN(quantity)) {
        initialProductData.quantity = quantity;
      }
    }
    
    // Set default min quantity if not specified
    if (!initialProductData.minQuantity) {
      initialProductData.minQuantity = 1; // Default min quantity for unidentified products
    }
    
    // Set default VAT percentage if not specified
    if (!initialProductData.vatPercentage) {
      initialProductData.vatPercentage = 19; // Default VAT in Romania
    }
    
    // Update the initialData state with the parameters from URL
    setInitialData(initialProductData);
  }, [location.search]);
  
  const handleSubmit = async (productData: Partial<Product>) => {
    if (!currentUser) return;
    
    try {
      setIsSubmitting(true);
      
      const newProduct = {
        ...productData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'products'), newProduct);
      
      // Log the activity
      await logActivity(
        'added', 
        'product', 
        docRef.id, 
        productData.name || 'New Product', 
        currentUser,
        productData.quantity
      );
      
      // Check if this product can be identified in any orders with unidentified items
      setIsCheckingOrders(true);
      const result = await flagOrdersWithProduct(
        docRef.id,
        productData.name || 'New Product',
        productData.barcode,
        productData.price
      );
      setOrdersUpdateResult(result);
      setIsCheckingOrders(false);
      
      // Determine navigation destination
      const queryParams = new URLSearchParams(location.search);
      
      if (queryParams.has('fromOrder')) {
        // Navigate back to the order details page
        navigate(`/orders/${queryParams.get('fromOrder')}`);
      } else if (queryParams.has('from')) {
        // Navigate back to the URL specified in the 'from' parameter
        navigate(queryParams.get('from') || '/products');
      } else {
        // Default: navigate to the product details page
        navigate(`/products/${docRef.id}`);
      }
      
    } catch (error) {
      console.error('Error adding product:', error);
      setIsSubmitting(false);
      // You might want to show an error message to the user here
    }
  };

  // Get the back navigation destination
  const getBackNavigation = () => {
    const queryParams = new URLSearchParams(location.search);
    if (queryParams.has('fromOrder')) {
      return `/orders/${queryParams.get('fromOrder')}`;
    } else if (queryParams.has('from')) {
      return queryParams.get('from') || '/products';
    }
    return '/products';
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center mb-3 sm:mb-4">
        <button
          onClick={() => navigate(getBackNavigation())}
          className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Add New Product</h1>
          {initialData.barcode && (
            <p className="text-xs sm:text-base text-gray-600">
              Creating product with barcode: <span className="font-medium">{initialData.barcode}</span>
            </p>
          )}
          {initialData.name && (
            <p className="text-xs sm:text-base text-gray-600">
              Product name: <span className="font-medium">{initialData.name}</span>
            </p>
          )}
        </div>
      </div>
      
      {ordersUpdateResult && (
        <div className={`mb-4 p-4 rounded-md ${
          ordersUpdateResult.error 
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          {ordersUpdateResult.error ? (
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Error checking orders</p>
                <p className="mt-1 text-sm">{ordersUpdateResult.error}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {ordersUpdateResult.updatedCount > 0
                    ? `Updated ${ordersUpdateResult.updatedCount} order${ordersUpdateResult.updatedCount > 1 ? 's' : ''}`
                    : 'No orders needed updating'}
                </p>
                {ordersUpdateResult.updatedCount > 0 && (
                  <p className="mt-1 text-sm">
                    Orders that previously contained unidentified items matching this product have been updated.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {isCheckingOrders && (
        <div className="mb-4 p-4 rounded-md bg-blue-50 border-blue-200 text-blue-800">
          <div className="flex items-start">
            <Loader2 className="h-5 w-5 mr-2 animate-spin flex-shrink-0 mt-0.5" />
            <p>Checking for orders with matching unidentified items...</p>
          </div>
        </div>
      )}
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <ProductForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={() => navigate(getBackNavigation())}
        />
      </div>
    </div>
  );
};

export default ProductCreate;