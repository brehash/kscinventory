import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  Order, 
  OrderStatus,
  UnidentifiedItem
} from '../../types';
import { 
  ArrowLeft, 
  Printer, 
  Edit,
  RefreshCw,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';

// Import sub-components
import OrderStatusBadge from './OrderStatusBadge';
import OrderAddressCard from './OrderAddressCard';
import OrderItemsTable from './OrderItemsTable';
import UnidentifiedItemsSection from './UnidentifiedItemsSection';
import OrderStatusUpdateModal from './OrderStatusUpdateModal';
import CreateProductModal from './CreateProductModal';
import OrderSummary from './OrderSummary';

const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Edit status modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>('processing');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Unidentified item modal state
  const [showUnidentifiedItemModal, setShowUnidentifiedItemModal] = useState(false);
  const [selectedUnidentifiedItem, setSelectedUnidentifiedItem] = useState<UnidentifiedItem | null>(null);
  
  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const orderRef = doc(db, 'orders', id);
        const orderDoc = await getDoc(orderRef);
        
        if (!orderDoc.exists()) {
          setError('Order not found');
          setLoading(false);
          return;
        }
        
        const orderData = orderDoc.data();
        
        // Convert Firestore timestamps to Date objects
        setOrder({
          id: orderDoc.id,
          ...orderData,
          orderDate: orderData.orderDate?.toDate() || new Date(),
          createdAt: orderData.createdAt?.toDate() || new Date(),
          updatedAt: orderData.updatedAt?.toDate() || new Date(),
          fulfilledAt: orderData.fulfilledAt?.toDate() || undefined
        } as Order);
        
        setNewStatus(orderData.status as OrderStatus);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError('Failed to load order details');
        setLoading(false);
      }
    };
    
    fetchOrderDetails();
  }, [id]);
  
  const updateOrderStatus = async () => {
    if (!id || !order || !currentUser) return;
    
    try {
      setUpdatingStatus(true);
      
      const orderRef = doc(db, 'orders', id);
      const updateData: Partial<Order> = {
        status: newStatus,
        updatedAt: new Date()
      };
      
      // If status is completed, set fulfilledAt and fulfilledBy
      if (newStatus === 'completed' && order.status !== 'completed') {
        updateData.fulfilledAt = new Date();
        updateData.fulfilledBy = currentUser.displayName || currentUser.email;
      }
      
      await updateDoc(orderRef, updateData);
      
      // Log the activity
      await logActivity(
        'updated',
        'order',
        id,
        `Order #${order.orderNumber}`,
        currentUser
      );
      
      // Update the local state
      setOrder({
        ...order,
        status: newStatus,
        updatedAt: new Date(),
        ...(newStatus === 'completed' && order.status !== 'completed' ? {
          fulfilledAt: new Date(),
          fulfilledBy: currentUser.displayName || currentUser.email
        } : {})
      });
      
      setShowStatusModal(false);
      setUpdatingStatus(false);
    } catch (err) {
      console.error('Error updating order status:', err);
      setUpdatingStatus(false);
    }
  };

  // Handle creating a product from an unidentified item
  const handleUnidentifiedItemClick = (item: UnidentifiedItem) => {
    setSelectedUnidentifiedItem(item);
    setShowUnidentifiedItemModal(true);
  };

  // Navigate to create product page with pre-filled data
  const navigateToCreateProduct = () => {
    if (!selectedUnidentifiedItem || !id) return;
    
    // Create query params with item details
    const params = new URLSearchParams();
    params.append('name', selectedUnidentifiedItem.name);
    if (selectedUnidentifiedItem.sku) {
      params.append('barcode', selectedUnidentifiedItem.sku);
    }
    params.append('price', selectedUnidentifiedItem.price.toString());
    params.append('quantity', selectedUnidentifiedItem.quantity.toString());
    
    // Add the fromOrder parameter to return here after creating the product
    params.append('fromOrder', id);
    
    // Navigate to product creation page with params
    navigate(`/products/new?${params.toString()}`);
    
    // Close modal
    setShowUnidentifiedItemModal(false);
    setSelectedUnidentifiedItem(null);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">{error || 'Order not found'}</h2>
          <p className="text-gray-600 mb-4">The order you are looking for could not be found.</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2 sm:gap-0">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-800">
                Order #{order.orderNumber}
              </h1>
              {order.hasUnidentifiedItems && (
                <div 
                  title="Contains unidentified products" 
                  className="ml-2 flex-shrink-0"
                >
                  <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
                </div>
              )}
            </div>
            <div className="flex items-center text-xs sm:text-base text-gray-600">
              <span>
                {format(order.orderDate, 'MMM d, yyyy')}
              </span>
              
              <span className="mx-2">•</span>
              
              <span className={order.source === 'manual' ? 'text-indigo-600' : 'text-teal-600'}>
                {order.source === 'manual' ? 'Manual order' : 'WooCommerce'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link
            to={`/orders/${id}/packingslip`}
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Packing Slip
          </Link>
          <button
            onClick={() => setShowStatusModal(true)}
            className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Edit className="h-4 w-4 mr-1.5" />
            Update Status
          </button>
        </div>
      </div>

      {/* Warning for unidentified items */}
      {order.hasUnidentifiedItems && order.unidentifiedItems && order.unidentifiedItems.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Unidentified Products</h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>
                  This order contains {order.unidentifiedItems.length} {order.unidentifiedItems.length === 1 ? 'product' : 'products'} from WooCommerce that {order.unidentifiedItems.length === 1 ? 'was' : 'were'} not found in your inventory system.
                </p>
                <p className="mt-1">
                  These products are not yet tracked in your inventory. See the "Unidentified Products" section below for details.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Order Summary */}
        <OrderSummary order={order} />
        
        {/* Customer & Shipping Info */}
        <div className="space-y-4 sm:space-y-6">
          {/* Shipping Address */}
          <OrderAddressCard type="shipping" address={order.shippingAddress} />
          
          {/* Billing Address */}
          <OrderAddressCard type="billing" address={order.billingAddress} />
          
          {/* Order Notes */}
          {order.notes && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-3">Order Notes</h2>
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">{order.notes}</p>
              </div>
            </div>
          )}
          
          {/* Fulfillment Information */}
          {order.status === 'completed' && order.fulfilledAt && (
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
              <h2 className="text-base font-semibold text-gray-800 mb-3">Fulfillment Information</h2>
              <div className="bg-green-50 p-3 rounded-md border border-green-100">
                <div className="flex items-center text-green-800 mb-2">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  <span className="font-medium">Order fulfilled</span>
                </div>
                <p className="text-sm text-gray-600">
                  Fulfilled on {format(order.fulfilledAt, 'MMM d, yyyy')} at {format(order.fulfilledAt, 'h:mm a')}
                </p>
                {order.fulfilledBy && (
                  <p className="text-sm text-gray-600 mt-1">
                    Fulfilled by: {order.fulfilledBy}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unidentified Items Section */}
      {order.hasUnidentifiedItems && order.unidentifiedItems && order.unidentifiedItems.length > 0 && (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm mt-4">
          <UnidentifiedItemsSection 
            items={order.unidentifiedItems}
            onCreateProduct={handleUnidentifiedItemClick}
          />
        </div>
      )}
      
      {/* Status Update Modal */}
      <OrderStatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        status={order.status}
        newStatus={newStatus}
        setNewStatus={setNewStatus}
        updateOrderStatus={updateOrderStatus}
        updatingStatus={updatingStatus}
        orderNumber={order.orderNumber}
      />

      {/* Unidentified Item Modal */}
      <CreateProductModal
        isOpen={showUnidentifiedItemModal}
        onClose={() => {
          setShowUnidentifiedItemModal(false);
          setSelectedUnidentifiedItem(null);
        }}
        item={selectedUnidentifiedItem}
        onCreateProduct={navigateToCreateProduct}
      />
    </div>
  );
};

export default OrderDetails;