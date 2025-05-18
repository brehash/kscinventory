import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order } from '../../types';
import { 
  ArrowLeft, 
  Package, 
  Truck, 
  PrinterIcon,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../auth/AuthProvider';

const PackingSlip: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printedStatus, setPrintedStatus] = useState<'printed' | 'not-printed' | 'error' | null>(null);
  
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
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching order details:', err);
        setError('Failed to load order details');
        setLoading(false);
      }
    };
    
    fetchOrderDetails();
  }, [id]);
  
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Packing_Slip_${order?.orderNumber || 'Order'}`,
    onAfterPrint: async () => {
      try {
        if (id && order && currentUser) {
          // Mark the packing slip as printed
          const orderRef = doc(db, 'orders', id);
          await updateDoc(orderRef, {
            packingSlipPrinted: true,
            updatedAt: new Date()
          });
          
          // Update the local state
          setOrder({
            ...order,
            packingSlipPrinted: true,
            updatedAt: new Date()
          });
          
          setPrintedStatus('printed');
        }
      } catch (err) {
        console.error('Error updating packing slip status:', err);
        setPrintedStatus('error');
      }
    }
  });
  
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">
              Packing Slip for Order #{order.orderNumber}
            </h1>
            <p className="text-xs sm:text-base text-gray-600">
              {format(order.orderDate, 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors"
        >
          <PrinterIcon className="h-4 w-4 mr-1 sm:mr-2" />
          Print Packing Slip
        </button>
      </div>
      
      {printedStatus && (
        <div className={`${
          printedStatus === 'printed' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
        } border-l-4 p-4`}>
          <div className="flex items-center">
            {printedStatus === 'printed' 
              ? <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              : <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />}
            <p className="text-sm text-gray-700">
              {printedStatus === 'printed' 
                ? 'Packing slip has been printed and marked as printed in the system.' 
                : 'There was an error marking the packing slip as printed. Please try again.'}
            </p>
          </div>
        </div>
      )}
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm print:shadow-none">
        {/* Print template */}
        <div ref={printRef} className="print:m-0 print:p-0">
          <div className="print:pt-0 flex flex-col sm:flex-row justify-between sm:items-center mb-6 border-b border-gray-200 pb-6">
            <div>
              <h1 className="text-xl font-bold">PACKING SLIP</h1>
              <p className="text-gray-600 mt-1">Order #{order.orderNumber}</p>
              <p className="text-gray-600">Date: {format(order.orderDate, 'MMMM d, yyyy')}</p>
            </div>
            <div className="mt-4 sm:mt-0 text-right">
              <h2 className="text-lg font-bold">Company Name</h2>
              <p className="text-gray-600">123 Street Address</p>
              <p className="text-gray-600">City, State, Zip</p>
              <p className="text-gray-600">Phone: (123) 456-7890</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
                <Truck className="h-4 w-4 inline-block mr-1" />
                Ship To
              </h3>
              <div className="border border-gray-200 p-3 sm:p-4 rounded-md bg-gray-50">
                <p className="font-medium">
                  {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                </p>
                {order.shippingAddress.company && (
                  <p>{order.shippingAddress.company}</p>
                )}
                <p className="mt-1">{order.shippingAddress.address1}</p>
                {order.shippingAddress.address2 && (
                  <p>{order.shippingAddress.address2}</p>
                )}
                <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postcode}</p>
                <p>{order.shippingAddress.country}</p>
                {order.shippingAddress.phone && (
                  <p className="mt-1">Phone: {order.shippingAddress.phone}</p>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
                <Package className="h-4 w-4 inline-block mr-1" />
                Order Details
              </h3>
              <div className="border border-gray-200 p-3 sm:p-4 rounded-md bg-gray-50">
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1 font-medium text-gray-500">Order Number:</td>
                      <td className="py-1 text-right">{order.orderNumber}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium text-gray-500">Order Date:</td>
                      <td className="py-1 text-right">{format(order.orderDate, 'MMM d, yyyy')}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium text-gray-500">Customer:</td>
                      <td className="py-1 text-right">{order.customerName}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-medium text-gray-500">Payment Method:</td>
                      <td className="py-1 text-right capitalize">{order.paymentMethod.replace('_', ' ')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
            Items to Ship
          </h3>
          <table className="min-w-full divide-y divide-gray-200 mb-6">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Item
                </th>
                <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  SKU
                </th>
                <th scope="col" className="px-3 sm:px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                  Quantity
                </th>
                <th scope="col" className="px-3 sm:px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase print:hidden">
                  Price
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-900">
                    {item.productName}
                  </td>
                  <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500">
                    SKU-{item.productId.slice(0, 5)}
                  </td>
                  <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500 text-center">
                    {item.quantity}
                  </td>
                  <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500 text-center print:hidden">
                    {item.price.toFixed(2)} RON
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="print:pt-4 border-t border-gray-200 pt-4 sm:pt-6 space-y-2">
            <div className="mb-2 text-xs sm:text-sm italic">
              <p>This is not a receipt. No pricing information is included.</p>
            </div>
            
            {order.notes && (
              <div className="border border-gray-200 p-3 rounded-md bg-gray-50 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Order Notes:</h3>
                <p className="text-sm text-gray-600">{order.notes}</p>
              </div>
            )}
            
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>Thank you for your order!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackingSlip;