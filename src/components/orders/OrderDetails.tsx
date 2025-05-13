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
  Truck, 
  CheckCircle, 
  Clock, 
  Package, 
  AlertTriangle, 
  Printer, 
  Copy, 
  Edit,
  RefreshCw,
  XCircle,
  Calendar,
  CreditCard,
  MapPin,
  Plus
} from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../ui/Modal';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';

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
  
  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="h-4 w-4 mr-2" /> },
      'processing': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <RefreshCw className="h-4 w-4 mr-2" /> },
      'on-hold': { bg: 'bg-purple-100', text: 'text-purple-800', icon: <AlertTriangle className="h-4 w-4 mr-2" /> },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="h-4 w-4 mr-2" /> },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-2" /> },
      'refunded': { bg: 'bg-gray-100', text: 'text-gray-800', icon: <RefreshCw className="h-4 w-4 mr-2" /> },
      'failed': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-2" /> },
      'preluata': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <CheckCircle className="h-4 w-4 mr-2" /> },
      'impachetata': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: <Package className="h-4 w-4 mr-2" /> },
      'expediata': { bg: 'bg-teal-100', text: 'text-teal-800', icon: <Truck className="h-4 w-4 mr-2" /> },
      'returnata': { bg: 'bg-amber-100', text: 'text-amber-800', icon: <RefreshCw className="h-4 w-4 mr-2" /> },
      'refuzata': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-2" /> }
    };
    
    const config = statusConfig[status];
    
    return (
      <span className={`${config.bg} ${config.text} px-2.5 py-1.5 rounded-full flex items-center text-sm`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
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
            onClick={() => navigate('/orders')}
            className="inline-flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
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
            onClick={() => navigate('/orders')}
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
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              {format(order.orderDate, 'MMM d, yyyy')}
              
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
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 gap-2 sm:gap-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">Order Summary</h2>
            <div className="flex items-center">
              {getStatusBadge(order.status)}
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 sm:mb-6">
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Customer</h3>
              <p className="text-sm font-medium text-gray-900">{order.customerName}</p>
              {order.customerEmail && (
                <p className="text-sm text-gray-500">{order.customerEmail}</p>
              )}
            </div>
            
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Payment Method</h3>
              <div className="flex items-center text-sm text-gray-900">
                <CreditCard className="h-4 w-4 mr-1.5 text-gray-400" />
                <span className="capitalize">{order.paymentMethod.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
          
          {/* Order Items */}
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">Order Items</h3>
          <div className="overflow-x-auto bg-gray-50 rounded-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gray-100 rounded-md flex items-center justify-center mr-2 flex-shrink-0">
                          <Package className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="text-xs sm:text-sm font-medium text-gray-900">{item.productName}</div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-500">{item.price.toFixed(2)} RON</div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-500">{item.quantity}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">{item.total.toFixed(2)} RON</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Unidentified Products Section */}
          {order.hasUnidentifiedItems && order.unidentifiedItems && order.unidentifiedItems.length > 0 && (
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
                    {order.unidentifiedItems.map((item) => (
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
                            onClick={() => handleUnidentifiedItemClick(item)}
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
          )}
          
          {/* Order Totals */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-medium text-gray-900">{order.subtotal.toFixed(2)} RON</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Shipping:</span>
                <span className="font-medium text-gray-900">{order.shippingCost.toFixed(2)} RON</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Tax:</span>
                <span className="font-medium text-gray-900">{order.tax.toFixed(2)} RON</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-base sm:text-lg font-medium">
                <span className="text-gray-900">Total:</span>
                <span className="text-indigo-600">{order.total.toFixed(2)} RON</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Customer & Shipping Info */}
        <div className="space-y-4 sm:space-y-6">
          {/* Shipping Address */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
            <div className="flex items-center mb-4">
              <Truck className="h-5 w-5 text-indigo-500 mr-2" />
              <h2 className="text-base font-semibold text-gray-800">Shipping Address</h2>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-900">
                <div className="font-medium">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </div>
                {order.shippingAddress.company && (
                  <div>{order.shippingAddress.company}</div>
                )}
                <div className="mt-1">
                  {order.shippingAddress.address1}
                  {order.shippingAddress.address2 && (
                    <div>{order.shippingAddress.address2}</div>
                  )}
                </div>
                <div className="mt-1">
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postcode}
                </div>
                <div>{order.shippingAddress.country}</div>
                {order.shippingAddress.phone && (
                  <div className="mt-2">{order.shippingAddress.phone}</div>
                )}
              </div>
              <button
                onClick={() => copyToClipboard(`${order.shippingAddress.firstName} ${order.shippingAddress.lastName}
${order.shippingAddress.company || ''}
${order.shippingAddress.address1}
${order.shippingAddress.address2 || ''}
${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postcode}
${order.shippingAddress.country}
${order.shippingAddress.phone || ''}`)}
                className="mt-2 inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-900"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy address
              </button>
            </div>
          </div>
          
          {/* Billing Address */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
            <div className="flex items-center mb-4">
              <MapPin className="h-5 w-5 text-indigo-500 mr-2" />
              <h2 className="text-base font-semibold text-gray-800">Billing Address</h2>
            </div>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="text-sm text-gray-900">
                <div className="font-medium">
                  {order.billingAddress.firstName} {order.billingAddress.lastName}
                </div>
                {order.billingAddress.company && (
                  <div>{order.billingAddress.company}</div>
                )}
                <div className="mt-1">
                  {order.billingAddress.address1}
                  {order.billingAddress.address2 && (
                    <div>{order.billingAddress.address2}</div>
                  )}
                </div>
                <div className="mt-1">
                  {order.billingAddress.city}, {order.billingAddress.state} {order.billingAddress.postcode}
                </div>
                <div>{order.billingAddress.country}</div>
                {order.billingAddress.phone && (
                  <div className="mt-2">{order.billingAddress.phone}</div>
                )}
                {order.billingAddress.email && (
                  <div className="mt-2">{order.billingAddress.email}</div>
                )}
              </div>
              <button
                onClick={() => copyToClipboard(`${order.billingAddress.firstName} ${order.billingAddress.lastName}
${order.billingAddress.company || ''}
${order.billingAddress.address1}
${order.billingAddress.address2 || ''}
${order.billingAddress.city}, ${order.billingAddress.state} ${order.billingAddress.postcode}
${order.billingAddress.country}
${order.billingAddress.phone || ''}
${order.billingAddress.email || ''}`)}
                className="mt-2 inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-900"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy address
              </button>
            </div>
          </div>
          
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
      
      {/* Status Update Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Update Order Status"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Select a new status for Order #{order.orderNumber}
          </p>
          <div className="mt-4">
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Order Status
            </label>
            <select
              id="status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="pending">Pending</option>
              <option value="preluata">Preluata</option>
              <option value="impachetata">Impachetata</option>
              <option value="expediata">Expediata</option>
              <option value="returnata">Returnata</option>
              <option value="refuzata">Refuzata</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          
          {newStatus === 'completed' && order.status !== 'completed' && (
            <div className="bg-green-50 p-3 rounded-md text-sm text-green-800">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-0.5">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <div className="ml-2">
                  <p className="font-medium">Order will be marked as fulfilled</p>
                  <p className="mt-1 text-green-700">
                    This will record the fulfillment date and user for the order.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowStatusModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={updateOrderStatus}
              disabled={updatingStatus || newStatus === order.status}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {updatingStatus ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unidentified Item Modal */}
      <Modal
        isOpen={showUnidentifiedItemModal}
        onClose={() => setShowUnidentifiedItemModal(false)}
        title="Create Product from WooCommerce"
      >
        {selectedUnidentifiedItem && (
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
                <dd className="text-gray-900 font-medium">{selectedUnidentifiedItem.name}</dd>
                
                <dt className="text-gray-500">SKU/Barcode:</dt>
                <dd className="text-gray-900 font-medium">{selectedUnidentifiedItem.sku || "No SKU"}</dd>
                
                <dt className="text-gray-500">Price:</dt>
                <dd className="text-gray-900 font-medium">{selectedUnidentifiedItem.price.toFixed(2)} RON</dd>
                
                <dt className="text-gray-500">Quantity:</dt>
                <dd className="text-gray-900 font-medium">{selectedUnidentifiedItem.quantity}</dd>
              </dl>
            </div>
            
            <p className="text-sm text-gray-600">
              Would you like to create a new product in your inventory system using these details? This will allow you to track stock for this product.
            </p>
            
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUnidentifiedItemModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={navigateToCreateProduct}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-4 w-4 inline mr-1" /> 
                Create Product
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrderDetails;