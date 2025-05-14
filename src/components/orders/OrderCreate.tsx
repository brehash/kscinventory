import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  Order, 
  OrderItem, 
  Address, 
  OrderStatus, 
  Product
} from '../../types';
import { 
  ArrowLeft,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';

// Import sub-components
import OrderDetailsForm from './OrderDetailsForm';
import OrderItemsSection from './OrderItemsSection';
import AddressForms from './AddressForms';
import OrderProductSelectionModal from './OrderProductSelectionModal';

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
        <OrderDetailsForm
          orderNumber={orderNumber}
          setOrderNumber={setOrderNumber}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerEmail={customerEmail}
          setCustomerEmail={setCustomerEmail}
          orderDate={orderDate}
          setOrderDate={setOrderDate}
          status={status}
          setStatus={setStatus}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          notes={notes}
          setNotes={setNotes}
          errors={errors}
        />
        
        {/* Order Items */}
        <OrderItemsSection
          items={items}
          subtotal={subtotal}
          shippingCost={shippingCost}
          setShippingCost={setShippingCost}
          tax={tax}
          setTax={setTax}
          total={total}
          removeItem={removeItem}
          errors={errors}
          openAddProductModal={() => setShowProductModal(true)}
        />
        
        {/* Shipping and Billing Information */}
        <AddressForms
          billingAddress={billingAddress}
          handleBillingChange={handleBillingChange}
          shippingAddress={shippingAddress}
          handleShippingChange={handleShippingChange}
          sameAsBilling={sameAsBilling}
          handleSameAsBillingChange={handleSameAsBillingChange}
          errors={errors}
        />
        
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
      <OrderProductSelectionModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchLoading={searchLoading}
        filteredProducts={filteredProducts}
        selectedProduct={selectedProduct}
        setSelectedProduct={setSelectedProduct}
        productQuantity={productQuantity}
        setProductQuantity={setProductQuantity}
        addProductToOrder={addProductToOrder}
      />
    </div>
  );
};

export default OrderCreate;