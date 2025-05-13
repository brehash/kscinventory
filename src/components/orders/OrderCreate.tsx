import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  Order, 
  OrderItem, 
  Address, 
  OrderStatus, 
  Product,
  Location
} from '../../types';
import { 
  ArrowLeft, 
  Plus, 
  Trash,
  Search,
  ShoppingBag,
  AlertTriangle,
  Package,
  Loader2,
  Minus
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';

// Helper function to generate a unique order number
const generateOrderNumber = () => {
  const timestamp = new Date().getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `M${timestamp}${random}`;
};

const OrderCreate: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Order state
  const [orderNumber, setOrderNumber] = useState<string>(generateOrderNumber());
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<OrderStatus>('preluata');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  
  // Shipping and Billing addresses
  const [shippingAddress, setShippingAddress] = useState<Address>({
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'RO',
    email: '',
    phone: ''
  });
  
  const [billingAddress, setBillingAddress] = useState<Address>({
    firstName: '',
    lastName: '',
    company: '',
    address1: '',
    address2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'RO',
    email: '',
    phone: ''
  });
  
  const [sameAsBilling, setSameAsBilling] = useState<boolean>(true);
  
  // UI states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  
  // Product search states
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productQuantity, setProductQuantity] = useState<number>(1);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  
  // Calculate order totals
  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };
  
  const subtotal = calculateSubtotal();
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const total = subtotal + shippingCost + tax;
  
  // Load products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, 'products');
        const snapshot = await getDocs(productsRef);
        
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Product));
        
        setProducts(productsData);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
    };
    
    fetchProducts();
  }, []);
  
  // Filter products based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts([]);
      return;
    }
    
    setSearchLoading(true);
    
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = products.filter(product => 
      product.name.toLowerCase().includes(lowerQuery) || 
      (product.barcode && product.barcode.toLowerCase().includes(lowerQuery)) ||
      product.description.toLowerCase().includes(lowerQuery)
    );
    
    setFilteredProducts(filtered);
    setSearchLoading(false);
  }, [searchQuery, products]);
  
  // Update shipping address when billing address changes (if sameAsBilling is true)
  useEffect(() => {
    if (sameAsBilling) {
      setShippingAddress(billingAddress);
    }
  }, [billingAddress, sameAsBilling]);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) return;
    
    // Validate form
    const validationErrors: Record<string, string> = {};
    
    if (!customerName) validationErrors.customerName = 'Customer name is required';
    if (!orderDate) validationErrors.orderDate = 'Order date is required';
    if (items.length === 0) validationErrors.items = 'At least one item is required';
    if (!billingAddress.firstName) validationErrors.billingFirstName = 'First name is required';
    if (!billingAddress.lastName) validationErrors.billingLastName = 'Last name is required';
    if (!billingAddress.address1) validationErrors.billingAddress1 = 'Address is required';
    if (!billingAddress.city) validationErrors.billingCity = 'City is required';
    if (!billingAddress.state) validationErrors.billingState = 'State/County is required';
    if (!billingAddress.postcode) validationErrors.billingPostcode = 'Postal code is required';
    
    if (!sameAsBilling) {
      if (!shippingAddress.firstName) validationErrors.shippingFirstName = 'First name is required';
      if (!shippingAddress.lastName) validationErrors.shippingLastName = 'Last name is required';
      if (!shippingAddress.address1) validationErrors.shippingAddress1 = 'Address is required';
      if (!shippingAddress.city) validationErrors.shippingCity = 'City is required';
      if (!shippingAddress.state) validationErrors.shippingState = 'State/County is required';
      if (!shippingAddress.postcode) validationErrors.shippingPostcode = 'Postal code is required';
    }
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to the first error
      document.getElementById(Object.keys(validationErrors)[0])?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    
    try {
      setIsSubmitting(true);
      setErrors({});
      
      // Create order object
      const orderData: Omit<Order, 'id'> = {
        orderNumber,
        customerName,
        customerEmail: customerEmail || undefined,
        orderDate: new Date(orderDate),
        status,
        items,
        shippingAddress,
        billingAddress,
        subtotal,
        shippingCost,
        tax,
        total,
        paymentMethod,
        notes: notes || undefined,
        source: 'manual',
        createdAt: new Date(),
        updatedAt: new Date(),
        packingSlipPrinted: false
      };
      
      // Add order to Firestore
      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Log activity
      await logActivity(
        'added',
        'order',
        docRef.id,
        `Order #${orderNumber}`,
        currentUser
      );
      
      // Navigate to the order details page
      navigate(`/orders/${docRef.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      setErrors({ form: 'Failed to create order. Please try again.' });
      setIsSubmitting(false);
    }
  };
  
  // Handle product selection
  const handleProductSelect = async (product: Product) => {
    setSelectedProduct(product);
    setProductQuantity(1);
    
    // Fetch additional product details if needed
    try {
      // Get location name
      if (product.locationId) {
        const locationDoc = await getDoc(doc(db, 'locations', product.locationId));
        if (locationDoc.exists()) {
          const locationData = locationDoc.data() as Location;
          product.locationName = locationData.name;
        }
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
    }
  };
  
  // Add product to order
  const addProductToOrder = () => {
    if (!selectedProduct) return;
    
    // Check if product already exists in order
    const existingItemIndex = items.findIndex(item => item.productId === selectedProduct.id);
    
    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedItems = [...items];
      const item = updatedItems[existingItemIndex];
      
      const newQuantity = item.quantity + productQuantity;
      const newTotal = selectedProduct.price * newQuantity;
      
      updatedItems[existingItemIndex] = {
        ...item,
        quantity: newQuantity,
        total: newTotal
      };
      
      setItems(updatedItems);
    } else {
      // Add new item
      const newItem: OrderItem = {
        id: Date.now().toString(), // temporary ID
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: productQuantity,
        price: selectedProduct.price,
        total: selectedProduct.price * productQuantity
      };
      
      setItems([...items, newItem]);
    }
    
    // Reset selection
    setSelectedProduct(null);
    setProductQuantity(1);
    setSearchQuery('');
    setShowProductModal(false);
  };
  
  // Remove item from order
  const removeItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };
  
  // Handle billing address change
  const handleBillingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setBillingAddress({
      ...billingAddress,
      [name.replace('billing_', '')]: value
    });
  };
  
  // Handle shipping address change
  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setShippingAddress({
      ...shippingAddress,
      [name.replace('shipping_', '')]: value
    });
  };
  
  // Toggle same as billing
  const handleSameAsBillingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSameAsBilling(e.target.checked);
    if (e.target.checked) {
      setShippingAddress(billingAddress);
    }
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center mb-3 sm:mb-4">
        <button
          onClick={() => navigate('/orders')}
          className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Create New Order</h1>
          <p className="text-xs sm:text-base text-gray-600">
            Add a new manual order to the system
          </p>
        </div>
      </div>
      
      {errors.form && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{errors.form}</p>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Order Details */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h2 className="text-base sm:text-lg font-semibold mb-4">Order Details</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Order Number
              </label>
              <input
                type="text"
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.orderNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.orderNumber}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="orderDate" className="block text-sm font-medium text-gray-700 mb-1">
                Order Date
              </label>
              <input
                type="date"
                id="orderDate"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.orderDate && (
                <p className="mt-1 text-sm text-red-600">{errors.orderDate}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.customerName && (
                <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Customer Email
              </label>
              <input
                type="email"
                id="customerEmail"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Order Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
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
            
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="card">Credit Card</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cod">Cash on Delivery</option>
              </select>
            </div>
          </div>
          
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Order Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
        
        {/* Order Items */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base sm:text-lg font-semibold">Order Items</h2>
            <button
              type="button"
              onClick={() => setShowProductModal(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Product
            </button>
          </div>
          
          {errors.items && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3">
              <p className="text-sm text-red-700">{errors.items}</p>
            </div>
          )}
          
          {items.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
              <ShoppingBag className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No items added</h3>
              <p className="mt-1 text-sm text-gray-500">Click "Add Product" to add items to this order.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Price
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="relative px-6 py-3">
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{item.price.toFixed(2)} RON</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{item.quantity}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.total.toFixed(2)} RON</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Order Totals */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span className="font-medium text-gray-900">{subtotal.toFixed(2)} RON</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center">
                  <span className="text-gray-500">Shipping:</span>
                  <input
                    type="number"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(Number(e.target.value))}
                    className="ml-2 w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs"
                    min="0"
                    step="0.01"
                  />
                </div>
                <span className="font-medium text-gray-900">{shippingCost.toFixed(2)} RON</span>
              </div>
              <div className="flex justify-between text-sm">
                <div className="flex items-center">
                  <span className="text-gray-500">Tax:</span>
                  <input
                    type="number"
                    value={tax}
                    onChange={(e) => setTax(Number(e.target.value))}
                    className="ml-2 w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-xs"
                    min="0"
                    step="0.01"
                  />
                </div>
                <span className="font-medium text-gray-900">{tax.toFixed(2)} RON</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-medium">
                <span className="text-gray-900">Total:</span>
                <span className="text-indigo-600">{total.toFixed(2)} RON</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Billing Information */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h2 className="text-base sm:text-lg font-semibold mb-4">Billing Information</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="billing_firstName" className="block text-sm font-medium text-gray-700 mb-1">
                First Name
              </label>
              <input
                type="text"
                id="billing_firstName"
                name="billing_firstName"
                value={billingAddress.firstName}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.billingFirstName && (
                <p className="mt-1 text-sm text-red-600">{errors.billingFirstName}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="billing_lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Last Name
              </label>
              <input
                type="text"
                id="billing_lastName"
                name="billing_lastName"
                value={billingAddress.lastName}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.billingLastName && (
                <p className="mt-1 text-sm text-red-600">{errors.billingLastName}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="billing_company" className="block text-sm font-medium text-gray-700 mb-1">
                Company (Optional)
              </label>
              <input
                type="text"
                id="billing_company"
                name="billing_company"
                value={billingAddress.company}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="billing_email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="billing_email"
                name="billing_email"
                value={billingAddress.email}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="billing_phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="text"
                id="billing_phone"
                name="billing_phone"
                value={billingAddress.phone}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div className="sm:col-span-2">
              <label htmlFor="billing_address1" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                id="billing_address1"
                name="billing_address1"
                value={billingAddress.address1}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.billingAddress1 && (
                <p className="mt-1 text-sm text-red-600">{errors.billingAddress1}</p>
              )}
            </div>
            
            <div className="sm:col-span-2">
              <label htmlFor="billing_address2" className="block text-sm font-medium text-gray-700 mb-1">
                Address Line 2 (Optional)
              </label>
              <input
                type="text"
                id="billing_address2"
                name="billing_address2"
                value={billingAddress.address2}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div>
              <label htmlFor="billing_city" className="block text-sm font-medium text-gray-700 mb-1">
                City
              </label>
              <input
                type="text"
                id="billing_city"
                name="billing_city"
                value={billingAddress.city}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.billingCity && (
                <p className="mt-1 text-sm text-red-600">{errors.billingCity}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="billing_state" className="block text-sm font-medium text-gray-700 mb-1">
                State / County
              </label>
              <input
                type="text"
                id="billing_state"
                name="billing_state"
                value={billingAddress.state}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.billingState && (
                <p className="mt-1 text-sm text-red-600">{errors.billingState}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="billing_postcode" className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code
              </label>
              <input
                type="text"
                id="billing_postcode"
                name="billing_postcode"
                value={billingAddress.postcode}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              {errors.billingPostcode && (
                <p className="mt-1 text-sm text-red-600">{errors.billingPostcode}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="billing_country" className="block text-sm font-medium text-gray-700 mb-1">
                Country
              </label>
              <select
                id="billing_country"
                name="billing_country"
                value={billingAddress.country}
                onChange={handleBillingChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="RO">Romania</option>
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="IT">Italy</option>
                <option value="ES">Spain</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Shipping Information */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-semibold">Shipping Information</h2>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sameAsBilling"
                checked={sameAsBilling}
                onChange={handleSameAsBillingChange}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="sameAsBilling" className="ml-2 block text-sm text-gray-900">
                Same as billing address
              </label>
            </div>
          </div>
          
          {!sameAsBilling && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="shipping_firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  id="shipping_firstName"
                  name="shipping_firstName"
                  value={shippingAddress.firstName}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
                {errors.shippingFirstName && (
                  <p className="mt-1 text-sm text-red-600">{errors.shippingFirstName}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="shipping_lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  id="shipping_lastName"
                  name="shipping_lastName"
                  value={shippingAddress.lastName}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
                {errors.shippingLastName && (
                  <p className="mt-1 text-sm text-red-600">{errors.shippingLastName}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="shipping_company" className="block text-sm font-medium text-gray-700 mb-1">
                  Company (Optional)
                </label>
                <input
                  type="text"
                  id="shipping_company"
                  name="shipping_company"
                  value={shippingAddress.company}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="shipping_phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  id="shipping_phone"
                  name="shipping_phone"
                  value={shippingAddress.phone}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="shipping_address1" className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  id="shipping_address1"
                  name="shipping_address1"
                  value={shippingAddress.address1}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
                {errors.shippingAddress1 && (
                  <p className="mt-1 text-sm text-red-600">{errors.shippingAddress1}</p>
                )}
              </div>
              
              <div className="sm:col-span-2">
                <label htmlFor="shipping_address2" className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  id="shipping_address2"
                  name="shipping_address2"
                  value={shippingAddress.address2}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
              </div>
              
              <div>
                <label htmlFor="shipping_city" className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  id="shipping_city"
                  name="shipping_city"
                  value={shippingAddress.city}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
                {errors.shippingCity && (
                  <p className="mt-1 text-sm text-red-600">{errors.shippingCity}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="shipping_state" className="block text-sm font-medium text-gray-700 mb-1">
                  State / County
                </label>
                <input
                  type="text"
                  id="shipping_state"
                  name="shipping_state"
                  value={shippingAddress.state}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
                {errors.shippingState && (
                  <p className="mt-1 text-sm text-red-600">{errors.shippingState}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="shipping_postcode" className="block text-sm font-medium text-gray-700 mb-1">
                  Postal Code
                </label>
                <input
                  type="text"
                  id="shipping_postcode"
                  name="shipping_postcode"
                  value={shippingAddress.postcode}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
                {errors.shippingPostcode && (
                  <p className="mt-1 text-sm text-red-600">{errors.shippingPostcode}</p>
                )}
              </div>
              
              <div>
                <label htmlFor="shipping_country" className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <select
                  id="shipping_country"
                  name="shipping_country"
                  value={shippingAddress.country}
                  onChange={handleShippingChange}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                >
                  <option value="RO">Romania</option>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="IT">Italy</option>
                  <option value="ES">Spain</option>
                </select>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
            Create Order
          </button>
        </div>
      </form>
      
      {/* Product Selection Modal */}
      <Modal
        isOpen={showProductModal}
        onClose={() => {
          setShowProductModal(false);
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
                setShowProductModal(false);
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
    </div>
  );
};

export default OrderCreate;