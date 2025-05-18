import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order, OrderItem } from '../../types';
import { 
  ArrowLeft, 
  Printer, 
  AlertTriangle,
  Loader2,
  CheckSquare,
  Square,
  Package
} from 'lucide-react';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';

interface GroupedItem extends OrderItem {
  orderIds: string[];
  orderNumbers: string[];
}

const GlobalPackingSlip: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allItemsPicked, setAllItemsPicked] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Fetch orders with items to pick
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch orders that are in 'processing' status or similar
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef, 
          where('status', 'in', ['processing', 'preluata', 'on-hold', 'pregatita'])
        );
        
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          setOrders([]);
          setGroupedItems([]);
          setLoading(false);
          return;
        }
        
        // Parse orders data
        const ordersData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            orderDate: data.orderDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          } as Order;
        });
        
        setOrders(ordersData);
        
        // Group items that need to be picked (not picked yet)
        const itemMap = new Map<string, GroupedItem>();
        
        ordersData.forEach(order => {
          if (!order.items) return;
          
          order.items.forEach(item => {
            // Only include unpicked items
            if (item.picked === true) return;
            
            const key = `${item.productId}-${item.productName}`;
            
            if (itemMap.has(key)) {
              const existingItem = itemMap.get(key)!;
              existingItem.quantity += item.quantity;
              existingItem.total += item.total;
              
              // Only add the order ID and number if they're not already in the arrays
              if (!existingItem.orderIds.includes(order.id)) {
                existingItem.orderIds.push(order.id);
              }
              if (!existingItem.orderNumbers.includes(order.orderNumber)) {
                existingItem.orderNumbers.push(order.orderNumber);
              }
            } else {
              itemMap.set(key, {
                ...item,
                orderIds: [order.id],
                orderNumbers: [order.orderNumber]
              });
            }
          });
        });
        
        setGroupedItems(Array.from(itemMap.values()));
        setLoading(false);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('Failed to load orders');
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, []);
  
  // Print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Global_Packing_Slip',
    onAfterPrint: () => console.log('Printed global packing slip')
  });
  
  // Handle marking all items as picked
  const handleMarkAllAsPicked = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      
      // Update each order to mark items as picked
      for (const order of orders) {
        if (!order.items || order.items.length === 0) continue;
        
        // Create updated items array with picked status
        const updatedItems = order.items.map(item => ({
          ...item,
          picked: true
        }));
        
        // Update the order in Firestore
        await updateDoc(doc(db, 'orders', order.id), {
          items: updatedItems,
          updatedAt: new Date()
        });
        
        // Log activity
        await logActivity(
          'updated',
          'order',
          order.id,
          `Order #${order.orderNumber}`,
          currentUser
        );
      }
      
      // Set all items as picked in UI
      setAllItemsPicked(true);
      setSuccess('All items have been marked as picked!');
      
      // Clear the grouped items since they're all picked
      setGroupedItems([]);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
      setLoading(false);
    } catch (err) {
      console.error('Error marking items as picked:', err);
      setError('Failed to update items');
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm sm:text-base text-gray-600">Loading orders to fulfill...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 sm:p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mr-2" />
          <p className="text-sm sm:text-base text-red-700">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/orders')}
            className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">
              Global Packing Slip
            </h1>
            <p className="text-xs sm:text-base text-gray-600">
              All unpicked items from {orders.length} orders ready to fulfill
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print Packing Slip
          </button>
          
          <button
            onClick={handleMarkAllAsPicked}
            disabled={allItemsPicked || groupedItems.length === 0}
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            Mark All as Picked
          </button>
        </div>
      </div>
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex items-center">
            <CheckSquare className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}
      
      {orders.length === 0 || groupedItems.length === 0 ? (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm text-center py-8 sm:py-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">No Items to Pick</h2>
          <p className="text-gray-600 mb-4">There are no orders ready for fulfillment or all items have already been picked.</p>
          <button
            onClick={() => navigate('/orders')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Orders
          </button>
        </div>
      ) : (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm print:shadow-none">
          {/* Print template */}
          <div ref={printRef} className="print:m-0 print:p-0">
            <div className="print:pt-0 flex flex-col sm:flex-row justify-between sm:items-center mb-6 border-b border-gray-200 pb-6">
              <div>
                <h1 className="text-xl font-bold">GLOBAL PACKING SLIP</h1>
                <p className="text-gray-600 mt-1">Date: {format(new Date(), 'MMMM d, yyyy')}</p>
                <p className="text-gray-600">Orders: {orders.length}</p>
              </div>
              <div className="mt-4 sm:mt-0 text-right">
                <h2 className="text-lg font-bold">Company Name</h2>
                <p className="text-gray-600">123 Street Address</p>
                <p className="text-gray-600">City, State, Zip</p>
                <p className="text-gray-600">Phone: (123) 456-7890</p>
              </div>
            </div>
            
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-2">
              Items to Pick
            </h3>
            <table className="min-w-full divide-y divide-gray-200 mb-6">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Item
                  </th>
                  <th scope="col" className="px-3 sm:px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    Quantity
                  </th>
                  <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Orders
                  </th>
                  <th scope="col" className="px-3 sm:px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase print:hidden">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {groupedItems.map((item) => (
                  <tr key={`${item.productId}-${item.id}`}>
                    <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                          <Package className="h-4 w-4 text-gray-500" />
                        </div>
                        {item.productName}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500 text-center">
                      <span className="font-semibold">{item.quantity}</span>
                    </td>
                    <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500">
                      {item.orderNumbers.map((orderNumber, index) => (
                        <span key={index} className="inline-block bg-gray-100 px-2 py-1 rounded-md text-xs mr-1 mb-1">
                          #{orderNumber}
                        </span>
                      ))}
                    </td>
                    <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500 text-center print:hidden">
                      {allItemsPicked ? (
                        <span className="inline-flex items-center text-green-700">
                          <CheckSquare className="h-4 w-4 mr-1" />
                          Picked
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-gray-500">
                          <Square className="h-4 w-4 mr-1" />
                          Not Picked
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="print:pt-4 border-t border-gray-200 pt-4 sm:pt-6 space-y-2">
              <div className="mb-2 text-xs sm:text-sm italic">
                <p>Pick all items and prepare for shipping.</p>
              </div>
              
              <div className="mt-4 text-center text-sm text-gray-500">
                <p>Thank you for your hard work!</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalPackingSlip;