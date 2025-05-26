import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, User, OrderStatus, UnidentifiedItem, Product, Client, Address } from '../types';
import { logActivity } from './activityLogger';

/**
 * Initialize WooCommerce API
 * Creates and returns a configured WooCommerceRestApi instance using credentials from Firebase
 */
const initWooCommerceAPI = async () => {
  try {
    // Get settings from Firebase
    const settingsDoc = await getDoc(doc(db, 'woocommerce_settings', 'global_settings'));
    
    if (!settingsDoc.exists()) {
      console.error('WooCommerce settings not found in Firebase');
      return null;
    }
    
    const data = settingsDoc.data();
    const url = data.wc_url || '';
    const consumerKey = data.wc_consumer_key || '';
    const consumerSecret = data.wc_consumer_secret || '';
    
    return new WooCommerceRestApi({
      url,
      consumerKey,
      consumerSecret,
      version: 'wc/v3'
    });
  } catch (error) {
    console.error('Error loading WooCommerce settings from Firebase:', error);
    return null;
  }
};

/**
 * Test WooCommerce Connection
 * Validates the provided WooCommerce API credentials by attempting to connect to the store
 */
export const testWooCommerceConnection = async (
  url: string,
  consumerKey: string,
  consumerSecret: string
): Promise<{success: boolean, message?: string, error?: string}> => {
  try {
    const api = new WooCommerceRestApi({
      url,
      consumerKey,
      consumerSecret,
      version: 'wc/v3'
    });
    
    // Test connection by getting store information
    const response = await api.get('');
    
    if (response && response.status === 200) {
      return {
        success: true,
        message: `Connected to ${response.data?.name || 'WooCommerce store'}`
      };
    }
    
    return {
      success: false,
      error: 'Unexpected response from WooCommerce API'
    };
  } catch (err) {
    console.error('WooCommerce connection test error:', err);
    let errorMessage = 'Connection failed';
    
    if (err instanceof Error) {
      if (err.message.includes('401')) {
        errorMessage = 'Authentication failed: Invalid credentials';
      } else if (err.message.includes('404')) {
        errorMessage = 'Store not found: Please check the URL';
      } else if (err.message.includes('CORS')) {
        errorMessage = 'CORS error: Your store needs to enable CORS for API access';
      } else if (err.message.includes('Network Error')) {
        errorMessage = 'Network error: Unable to connect to the server';
      } else {
        errorMessage = `Error: ${err.message}`;
      }
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Map WooCommerce order status to internal status
 * Converts WooCommerce status strings to the equivalent internal OrderStatus enum values
 */
const mapOrderStatus = (wcStatus: string): OrderStatus => {
  // console.log(`Mapping WooCommerce status: ${wcStatus}`);
  
  // Support both standard WooCommerce statuses and custom statuses with wc- prefix
  switch (wcStatus) {
    // Standard WooCommerce statuses
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'on-hold':
      return 'on-hold';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'failed':
      return 'failed';
    case 'draft':
      return 'draft';
    case 'checkout-draft':
      return 'draft';
      
    // Custom statuses with wc- prefix  
    case 'wc-preluata':
      return 'preluata';
    case 'wc-pregatita':
      return 'pregatita';
    case 'wc-expediata':
      return 'expediata';
    case 'wc-refuzata':
      return 'refuzata';  
    case 'wc-neonorata':
      return 'neonorata';
    
    // Support for custom statuses without prefix too
    case 'preluata':
      return 'preluata';
    case 'pregatita':
      return 'pregatita';
    case 'expediata':
      return 'expediata';
    case 'refuzata':
      return 'refuzata';
    case 'neonorata':
      return 'neonorata';
      
    default:
      console.log(`Unknown WooCommerce status: ${wcStatus}, defaulting to 'processing'`);
      return 'processing';
  }
};

/**
 * Map internal order status to WooCommerce status
 * Converts our internal OrderStatus enum values to WooCommerce status strings
 */
const mapInternalStatusToWooCommerce = (status: OrderStatus): string => {
  console.log(`Mapping internal status to WooCommerce: ${status}`);
  
  switch (status) {
    case 'preluata':
      return 'wc-preluata';
    case 'pregatita':
      return 'wc-pregatita';
    case 'expediata':
      return 'wc-expediata';
    case 'refuzata':
      return 'wc-refuzata';
    case 'neonorata':
      return 'wc-neonorata';
      
    // For backward compatibility, support the old status name
    case 'impachetata':
      return 'wc-pregatita';
      
    // Standard WooCommerce statuses
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'on-hold':
      return 'on-hold';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'failed':
      return 'failed';
    case 'draft':
      return 'draft';
    default:
      console.log(`Unknown internal status: ${status}, defaulting to original status`);
      return status;
  }
};

/**
 * Update order status on WooCommerce
 * Synchronizes an order status change from our system to WooCommerce
 */
export const updateOrderStatusOnWooCommerce = async (
  woocommerceId: number,
  status: OrderStatus
): Promise<{success: boolean, error?: string}> => {
  try {
    // Check if API can be initialized
    const api = await initWooCommerceAPI();
    if (!api) {
      return { 
        success: false, 
        error: 'WooCommerce API initialization failed. Please check your settings.' 
      };
    }
    
    // Map the internal status to a WooCommerce status
    const wcStatus = mapInternalStatusToWooCommerce(status);
    // console.log(`Updating WooCommerce order ${woocommerceId} status to: ${wcStatus}`);
    
    // Update order status in WooCommerce
    const response = await api.put(`orders/${woocommerceId}`, {
      status: wcStatus
    });
    
    // console.log(`WooCommerce update response status: ${response.status}`);
    
    if (response && response.status === 200) {
      // console.log(`Successfully updated WooCommerce order ${woocommerceId}`);
      return { success: true };
    }
    
    console.error('Unexpected response when updating WooCommerce order:', response);
    return {
      success: false,
      error: 'Unexpected response from WooCommerce API'
    };
  } catch (error) {
    console.error('Error updating WooCommerce order status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Find product in Firestore by barcode (WooCommerce SKU)
 * Searches the products collection to find a product matching the provided SKU
 */
const findProductByBarcode = async (sku: string): Promise<Product | null> => {
  if (!sku) return null;
  
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('barcode', '==', sku));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const productDoc = querySnapshot.docs[0];
      return {
        id: productDoc.id,
        ...productDoc.data()
      } as Product;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding product by barcode:', error);
    return null;
  }
};

/**
 * Create or update a client from WooCommerce order data
 * Synchronizes customer data from WooCommerce orders to the CRM system
 * 
 * @param customerName The customer's full name
 * @param email The customer's email address
 * @param phone The customer's phone number
 * @param billingAddress The customer's billing address
 * @param orderId The current order ID being processed
 * @param woocommerceOrderId The WooCommerce ID of the order being processed
 * @returns The client ID of the created or updated client
 */
const createOrUpdateClient = async (
  customerName: string,
  email: string,
  phone?: string,
  billingAddress?: Address,
  orderId?: string, 
  woocommerceOrderId?: number
): Promise<string | null> => {
  try {
    if (!email) {
      console.log('No email provided for client, skipping CRM sync');
      return null;
    }
    
    // console.log(`Checking if client exists with email: ${email}`);
    
    // Check if client exists
    const clientsRef = collection(db, 'clients');
    const q = query(clientsRef, where('email', '==', email));
    const clientSnapshot = await getDocs(q);
    
    if (clientSnapshot.empty) {
      // console.log(`No client found with email ${email}, creating new client`);
      
      // Create new client with orderIds array
      const newClient: Omit<Client, 'id'> = {
        name: customerName,
        email: email,
        phone: phone,
        companyName: billingAddress?.company,
        address: billingAddress,
        isActive: true,
        totalOrders: 1, // Initialize with 1 order
        totalSpent: 0, // Will be updated when processing the order
        averageOrderValue: 0, // Will be updated when processing the order
        source: 'woocommerce',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system', // Since this is automated
        orderIds: orderId ? [orderId] : [] // Initialize with the current order ID if provided
      };
      
      const clientDocRef = await addDoc(clientsRef, newClient);
      console.log(`Created new client ${clientDocRef.id} from WooCommerce order`);
      
      return clientDocRef.id;
    } else {
      // Update existing client
      const existingClientDoc = clientSnapshot.docs[0];
      const clientId = existingClientDoc.id;
      const existingClient = existingClientDoc.data() as Client;
      
      // console.log(`Found existing client ${clientId}, updating with latest WooCommerce data`);
      
      // Only update fields that are provided and if they're different from existing values
      const updates: Partial<Client> = {
        updatedAt: new Date()
      };
      
      if (customerName && customerName !== existingClient.name) {
        updates.name = customerName;
      }
      
      if (phone && phone !== existingClient.phone) {
        updates.phone = phone;
      }
      
      if (billingAddress && 
          JSON.stringify(billingAddress) !== JSON.stringify(existingClient.address)) {
        updates.address = billingAddress;
      }
      
      // Initialize orderIds array if it doesn't exist
      if (!existingClient.orderIds) {
        updates.orderIds = [];
      }
      
      // Add the current order ID to the orderIds array if provided and not already included
      if (orderId && (!existingClient.orderIds || !existingClient.orderIds.includes(orderId))) {
        updates.orderIds = [...(existingClient.orderIds || []), orderId];
      }
      
      // Only increment totalOrders if we're adding a new order to orderIds
      const hasNewOrder = orderId && (!existingClient.orderIds || !existingClient.orderIds.includes(orderId));
      if (hasNewOrder) {
        updates.totalOrders = (existingClient.totalOrders || 0) + 1;
      }
      
      await updateDoc(doc(db, 'clients', clientId), updates);
      // console.log(`Updated existing client ${clientId} from WooCommerce order`);
      
      return clientId;
    }
  } catch (error) {
    console.error('Error creating or updating client:', error);
    return null;
  }
};

/**
 * Update client order statistics after order processing
 * Calculates and updates total spent, average order value and other client statistics
 * Now checks if order has already been processed to prevent duplicate counting
 * 
 * @param clientId The client ID to update
 * @param orderTotal The total amount of the order
 * @param orderId The order ID being processed
 * @param woocommerceOrderId The WooCommerce ID of the order being processed
 */
const updateClientOrderStats = async (
  clientId: string | null, 
  orderTotal: number, 
  orderId?: string,
  woocommerceOrderId?: number
): Promise<void> => {
  try {
    if (!clientId || !orderId) return;

    const clientRef = doc(db, 'clients', clientId);
    const clientDoc = await getDoc(clientRef);
    
    if (clientDoc.exists()) {
      const clientData = clientDoc.data() as Client;
      
      // Initialize orderIds array if it doesn't exist
      const orderIds = clientData.orderIds || [];
      
      // Check if this order has already been processed to prevent double-counting
      if (orderIds.includes(orderId)) {
        console.log(`Order ${orderId} already processed for client ${clientId}, skipping revenue update`);
        return;
      }
      
      // Get existing values
      const existingTotalSpent = clientData.totalSpent || 0;
      const existingTotalOrders = clientData.totalOrders || 0;
      
      // Calculate new values
      const newTotalSpent = existingTotalSpent + orderTotal;
      const newTotalOrders = existingTotalOrders; // No need to increment here, done in createOrUpdateClient
      const newAverageOrderValue = newTotalOrders > 0 ? newTotalSpent / newTotalOrders : 0;
      const newLastOrderDate = new Date();
      
      // Add this order to the client's orderIds
      const newOrderIds = [...orderIds, orderId];
      
      // Create update object with all fields that need to be updated
      const updates: Partial<Client> = {
        totalSpent: newTotalSpent,
        averageOrderValue: newAverageOrderValue,
        lastOrderDate: newLastOrderDate,
        orderIds: newOrderIds,
        updatedAt: new Date()
      };
      
      // Update client in Firestore
      await updateDoc(clientRef, updates);
      console.log(`Updated client ${clientId} order statistics for order ${orderId}. New total: ${newTotalSpent.toFixed(2)} RON`);
    }
  } catch (error) {
    console.error('Error updating client order statistics:', error);
  }
};

/**
 * Convert WooCommerce order to internal Order format
 * Transforms a WooCommerce order object into our system's Order format
 */
const convertWooCommerceOrder = async (wcOrder: any): Promise<Omit<Order, 'id'>> => {
  // console.log(`Converting WooCommerce order: #${wcOrder.number} (ID: ${wcOrder.id}) - Status: ${wcOrder.status}`);
  
  // Extract customer name
  const customerName = wcOrder.billing 
    ? `${wcOrder.billing.first_name} ${wcOrder.billing.last_name}`.trim()
    : 'Unknown Customer';
  
  // Extract customer email
  const customerEmail = wcOrder.billing?.email || null;
  
  // DEBUG: Log customer details for client creation
  // console.log(`Customer Info for order #${wcOrder.number}:`, { 
  //   name: customerName, 
  //   email: customerEmail,
  //   phone: wcOrder.billing?.phone || 'Not provided'
  // });
  
  // Create order items and track unidentified items
  const items: Array<any> = [];
  const unidentifiedItems: UnidentifiedItem[] = [];
  
  // Process each line item
  for (const item of wcOrder.line_items) {
    const sku = item.sku || '';
    // console.log(`Processing line item: "${item.name}" (SKU: ${sku}, Quantity: ${item.quantity})`);
    
    // Try to find the product by barcode (sku)
    const product = await findProductByBarcode(sku);
    
    if (product) {
      // console.log(`Found matching product in inventory for SKU ${sku}: ${product.name}`);
      // Product found in system - add it as a regular OrderItem
      items.push({
        id: item.id.toString(),
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        total: product.price * item.quantity,
        picked: false // Initialize picked status
      });
    } else {
      // console.log(`No matching product found for SKU ${sku}, adding to unidentified items`);
      // Product not found - add to unidentifiedItems
      unidentifiedItems.push({
        wcProductId: item.product_id,
        sku: sku,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        total: parseFloat(item.total)
      });
    }
  }
  
  // Create shipping address
  const shippingAddress: Address = {
    firstName: wcOrder.shipping?.first_name || wcOrder.billing?.first_name || '',
    lastName: wcOrder.shipping?.last_name || wcOrder.billing?.last_name || '',
    company: wcOrder.shipping?.company || wcOrder.billing?.company || '',
    address1: wcOrder.shipping?.address_1 || wcOrder.billing?.address_1 || '',
    address2: wcOrder.shipping?.address_2 || wcOrder.billing?.address_2 || '',
    city: wcOrder.shipping?.city || wcOrder.billing?.city || '',
    state: wcOrder.shipping?.state || wcOrder.billing?.state || '',
    postcode: wcOrder.shipping?.postcode || wcOrder.billing?.postcode || '',
    country: wcOrder.shipping?.country || wcOrder.billing?.country || '',
    email: wcOrder.billing?.email || '',
    phone: wcOrder.billing?.phone || ''
  };
  
  // Create billing address
  const billingAddress: Address = {
    firstName: wcOrder.billing?.first_name || '',
    lastName: wcOrder.billing?.last_name || '',
    company: wcOrder.billing?.company || '',
    address1: wcOrder.billing?.address_1 || '',
    address2: wcOrder.billing?.address_2 || '',
    city: wcOrder.billing?.city || '',
    state: wcOrder.billing?.state || '',
    postcode: wcOrder.billing?.postcode || '',
    country: wcOrder.billing?.country || '',
    email: wcOrder.billing?.email || '',
    phone: wcOrder.billing?.phone || ''
  };
  
  // Calculate subtotal, shipping cost, and tax
  const subtotal = parseFloat(wcOrder.subtotal || '0');
  const shippingCost = parseFloat(wcOrder.shipping_total || '0');
  const tax = parseFloat(wcOrder.total_tax || '0');
  const total = parseFloat(wcOrder.total || '0');
  
  // Parse order date
  const orderDate = new Date(wcOrder.date_created || new Date());
  
  // Map the status and log it
  const mappedStatus = mapOrderStatus(wcOrder.status);
  // console.log(`Mapped WooCommerce status "${wcOrder.status}" to internal status "${mappedStatus}"`);
  
  // DEBUG: Log billing information details to verify client data
  // console.log(`Billing information for order #${wcOrder.number}:`, {
  //   address: billingAddress,
  //   hasEmail: !!wcOrder.billing?.email,
  //   emailValue: wcOrder.billing?.email || 'Not provided'
  // });
  
  // First create the order data structure without clientId
  const orderData: Omit<Order, 'id'> = {
    orderNumber: wcOrder.number,
    customerName,
    customerEmail,
    orderDate,
    status: mappedStatus,
    items,
    ...(unidentifiedItems.length > 0 ? { unidentifiedItems } : {}),
    hasUnidentifiedItems: unidentifiedItems.length > 0,
    shippingAddress,
    billingAddress,
    subtotal,
    shippingCost,
    tax,
    total,
    paymentMethod: wcOrder.payment_method || 'other',
    notes: wcOrder.customer_note || undefined,
    source: 'woocommerce',
    woocommerceId: wcOrder.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    packingSlipPrinted: false,
    clientId: null  // Will be set after client creation/update
  };
  
  // Create or update client in CRM if email is available
  let clientId: string | null = null; // Initialize as null instead of undefined
  try {
    if (wcOrder.billing?.email) {
      // We need to pass orderId, but we don't have it yet
      // We'll update the client with the order ID after creating the order
      clientId = await createOrUpdateClient(
        customerName,
        wcOrder.billing.email,
        wcOrder.billing.phone || undefined,
        billingAddress
      );
      
      // Set the clientId in the order data
      if (clientId) {
        orderData.clientId = clientId;
      }
    } else {
      console.log(`No email available for order #${wcOrder.number}, skipping client creation`);
    }
  } catch (clientError) {
    console.error(`Error during client creation for order #${wcOrder.number}:`, clientError);
    clientId = null; // Ensure clientId is null on error
  }
  
  return orderData;
};

/**
 * Update client with order ID and update order statistics
 * Called after an order is created to link the order to the client and update stats
 * 
 * @param clientId Client ID to update
 * @param orderId The ID of the order in our system
 * @param orderTotal Total amount of the order
 * @param woocommerceOrderId The WooCommerce ID of the order
 */
const updateClientWithOrder = async (
  clientId: string | null,
  orderId: string,
  orderTotal: number,
  woocommerceOrderId?: number
): Promise<void> => {
  if (!clientId || !orderId) return;
  
  try {
    const clientRef = doc(db, 'clients', clientId);
    const clientDoc = await getDoc(clientRef);
    
    if (clientDoc.exists()) {
      const clientData = clientDoc.data() as Client;
      
      // Initialize orderIds array if it doesn't exist
      const orderIds = clientData.orderIds || [];
      
      // Check if this order has already been processed
      if (!orderIds.includes(orderId)) {
        // Add order ID to the client's orderIds array
        const updates: Partial<Client> = {
          orderIds: [...orderIds, orderId],
          updatedAt: new Date()
        };
        
        await updateDoc(clientRef, updates);
        
        // Now update the client's order statistics
        await updateClientOrderStats(clientId, orderTotal, orderId, woocommerceOrderId);
      }
    }
  } catch (error) {
    console.error(`Error updating client with order ID ${orderId}:`, error);
  }
};

/**
 * Sync WooCommerce orders
 * Main function to synchronize orders from WooCommerce to our system
 * Now includes proper tracking of processed orders to prevent duplicate revenue counting
 */
export const syncWooCommerceOrders = async (currentUser: User) => {
  try {
    // console.log('Starting WooCommerce orders sync...');
    
    // Initialize WooCommerce API
    const api = await initWooCommerceAPI();
    
    // Check if API initialization succeeded
    if (!api) {
      return { 
        success: false, 
        error: 'WooCommerce API initialization failed. Please check your settings.' 
      };
    }
    
    // Fetch orders from WooCommerce
    // console.log('Fetching orders from WooCommerce API...');
    const response = await api.get('orders', {
      per_page: 100, // Adjust as needed
      orderby: 'date',
      order: 'desc'
    });
    
    if (!response || !response.data) {
      // console.error('No response from WooCommerce API');
      return { 
        success: false, 
        error: 'No response from WooCommerce API' 
      };
    }
    
    // Log the full response in the console for debugging
    // console.log('WooCommerce API Response:', response);
    // console.log('WooCommerce Orders Data:', response.data);
    
    const wcOrders = response.data;
    // console.log(`Retrieved ${wcOrders.length} orders from WooCommerce`);
    
    // Log statuses for debugging
    const statusCounts: Record<string, number> = {};
    wcOrders.forEach((order: any) => {
      const status = order.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      // console.log(`Order #${order.number} has WooCommerce status: ${status}`);
    });
    // console.log('Status distribution from WooCommerce:', statusCounts);
    
    let newOrders = 0;
    let updatedOrders = 0;
    let ordersWithUnidentifiedItems = 0;
    let newClients = 0;
    let updatedClients = 0;
    
    // Process each WooCommerce order
    for (const wcOrder of wcOrders) {
      // console.log(`Processing WooCommerce order #${wcOrder.number} (ID: ${wcOrder.id})`);
      
      // Check if order already exists
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef, 
        where('source', '==', 'woocommerce'),
        where('woocommerceId', '==', wcOrder.id)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // console.log(`Order #${wcOrder.number} is new, creating in Firestore`);
        try {
          // Order doesn't exist, create it
          const newOrderData = await convertWooCommerceOrder(wcOrder);
          
          // Add to Firestore
          const docRef = await addDoc(ordersRef, newOrderData);
          const orderId = docRef.id;
          
          // Now that we have the orderId, update the client with this order ID
          if (newOrderData.clientId) {
            await updateClientWithOrder(
              newOrderData.clientId,
              orderId,
              newOrderData.total,
              wcOrder.id
            );
            
            // Determine if this is a new client or updated client
            const clientRef = doc(db, 'clients', newOrderData.clientId);
            const clientDoc = await getDoc(clientRef);
            if (clientDoc.exists()) {
              const clientData = clientDoc.data() as Client;
              if (clientData.totalOrders <= 1) {
                // console.log(`New client detected: ${newOrderData.clientId}`);
                newClients++;
              } else {
                // console.log(`Updated client detected: ${newOrderData.clientId}`);
                updatedClients++;
              }
            }
          } else {
            console.log(`Order #${wcOrder.number} created without a clientId - client creation may have failed`);
          }
          
          // Log the activity
          await logActivity(
            'added',
            'order',
            docRef.id,
            `Order #${newOrderData.orderNumber}`,
            currentUser
          );
          
          if (newOrderData.hasUnidentifiedItems) {
            ordersWithUnidentifiedItems++;
            // console.log(`Order #${wcOrder.number} has unidentified items`);
          }
          
          newOrders++;
        } catch (orderError) {
          console.error(`Error creating new order #${wcOrder.number}:`, orderError);
          // Continue with next order rather than failing the entire sync
        }
      } else {
        // Order exists, update it
        const existingOrder = snapshot.docs[0];
        const existingOrderData = existingOrder.data() as Order;
        // console.log(`Order #${wcOrder.number} already exists in Firestore with status: ${existingOrderData.status}`);
        
        try {
          // Convert WooCommerce order to our format
          const newOrderData = await convertWooCommerceOrder(wcOrder);
          
          // Check if client ID has changed
          if (newOrderData.clientId && newOrderData.clientId !== existingOrderData.clientId) {
            // Update client's order list to include this order if needed
            await updateClientWithOrder(
              newOrderData.clientId,
              existingOrder.id,
              newOrderData.total,
              wcOrder.id
            );
            
            // Track client updates
            const clientRef = doc(db, 'clients', newOrderData.clientId);
            const clientDoc = await getDoc(clientRef);
            if (clientDoc.exists()) {
              const clientData = clientDoc.data() as Client;
              if (clientData.totalOrders <= 1) {
                newClients++;
              } else {
                updatedClients++;
              }
            }
          }
          
          // Only update if something has changed
          if (
            existingOrderData.status !== newOrderData.status ||
            JSON.stringify(existingOrderData.items) !== JSON.stringify(newOrderData.items) ||
            existingOrderData.total !== newOrderData.total ||
            existingOrderData.hasUnidentifiedItems !== newOrderData.hasUnidentifiedItems ||
            existingOrderData.clientId !== newOrderData.clientId
          ) {
            // console.log(`Order #${wcOrder.number} has changes, updating in Firestore`);
            // console.log(`Status change: ${existingOrderData.status} -> ${newOrderData.status}`);
            
            const orderRef = doc(db, 'orders', existingOrder.id);
            
            // Update only what has changed
            const updatePayload: any = {
              status: newOrderData.status,
              items: newOrderData.items,
              ...(newOrderData.hasUnidentifiedItems ? { unidentifiedItems: newOrderData.unidentifiedItems } : {}),
              hasUnidentifiedItems: newOrderData.hasUnidentifiedItems,
              subtotal: newOrderData.subtotal,
              shippingCost: newOrderData.shippingCost,
              tax: newOrderData.tax,
              total: newOrderData.total,
              updatedAt: new Date()
            };
            
            // Only include clientId if it exists and has changed
            if (newOrderData.clientId && newOrderData.clientId !== existingOrderData.clientId) {
              updatePayload.clientId = newOrderData.clientId;
              // console.log(`Updating clientId from ${existingOrderData.clientId || 'none'} to ${newOrderData.clientId}`);
            }
            
            await updateDoc(orderRef, updatePayload);
            
            // Log the activity
            await logActivity(
              'updated',
              'order',
              existingOrder.id,
              `Order #${existingOrderData.orderNumber}`,
              currentUser
            );
            
            if (newOrderData.hasUnidentifiedItems && 
                (!existingOrderData.hasUnidentifiedItems || 
                 JSON.stringify(existingOrderData.unidentifiedItems) !== JSON.stringify(newOrderData.unidentifiedItems))) {
              ordersWithUnidentifiedItems++;
              console.log(`Order #${wcOrder.number} has unidentified items after update`);
            }
            
            updatedOrders++;
          } else {
            console.log(`Order #${wcOrder.number} has no changes, skipping update`);
          }
        } catch (updateError) {
          console.error(`Error updating existing order #${wcOrder.number}:`, updateError);
          // Continue with next order rather than failing the entire sync
        }
      }
    }
    
    // Calculate actual total revenue from all clients after synchronization
    try {
      const clientsRef = collection(db, 'clients');
      const clientsSnapshot = await getDocs(clientsRef);
      
      let totalClientOrders = 0;
      let totalClientRevenue = 0;
      
      // Loop through all clients and recalculate their totals from their actual orders
      for (const clientDoc of clientsSnapshot.docs) {
        const clientId = clientDoc.id;
        const client = clientDoc.data() as Client;
        
        // Skip clients without orderIds
        if (!client.orderIds || client.orderIds.length === 0) {
          continue;
        }
        
        // Get all orders for this client
        let clientOrderTotal = 0;
        let clientOrderCount = 0;
        
        // Process each order ID
        for (const orderId of client.orderIds) {
          try {
            const orderDoc = await getDoc(doc(db, 'orders', orderId));
            if (orderDoc.exists()) {
              const order = orderDoc.data() as Order;
              clientOrderTotal += order.total;
              clientOrderCount++;
            }
          } catch (orderError) {
            console.error(`Error fetching order ${orderId} for client ${clientId}:`, orderError);
          }
        }
        
        // Update client with recalculated values
        if (clientOrderCount > 0) {
          const updates: Partial<Client> = {
            totalOrders: clientOrderCount,
            totalSpent: clientOrderTotal,
            averageOrderValue: clientOrderTotal / clientOrderCount,
            updatedAt: new Date()
          };
          
          await updateDoc(doc(db, 'clients', clientId), updates);
          
          totalClientOrders += clientOrderCount;
          totalClientRevenue += clientOrderTotal;
        }
      }
      
      console.log(`Recalculated client statistics: Total ${totalClientOrders} orders, Total revenue ${totalClientRevenue.toFixed(2)} RON`);
    } catch (recalcError) {
      console.error('Error recalculating client statistics:', recalcError);
    }
    
    console.log(`Sync completed: ${newOrders} new orders, ${updatedOrders} updated orders, ${ordersWithUnidentifiedItems} orders with unidentified items`);
    console.log(`Client sync: ${newClients} new clients, ${updatedClients} updated clients`);
    
    return {
      success: true,
      newOrders,
      updatedOrders,
      ordersWithUnidentifiedItems,
      newClients,
      updatedClients
    };
  } catch (error) {
    console.error('Error syncing WooCommerce orders:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

/**
 * WooCommerce sync script for scheduled sync
 * A Node.js script version of the sync function that can be run as a cron job
 */
export const wooSyncScript = async () => {
  // This would be adapted to run from a Node.js script or Firebase Cloud Function
  try {
    console.log('Starting WooCommerce order sync...');
    
    // Initialize WooCommerce API
    const api = await initWooCommerceAPI();
    
    // Check if API initialization succeeded
    if (!api) {
      console.error('WooCommerce API initialization failed');
      return;
    }
    
    // Fetch orders from WooCommerce
    const response = await api.get('orders', {
      per_page: 100,
      orderby: 'date',
      order: 'desc'
    });
    
    if (!response || !response.data) {
      console.error('No response from WooCommerce API');
      return;
    }
    
    // Log response data
    console.log('WooCommerce API Response (Script):', response.data);
    
    const wcOrders = response.data;
    let newOrders = 0;
    let updatedOrders = 0;
    let newClients = 0;
    let updatedClients = 0;
    
    // Process each WooCommerce order
    for (const wcOrder of wcOrders) {
      // Check if order already exists
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef, 
        where('source', '==', 'woocommerce'),
        where('woocommerceId', '==', wcOrder.id)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Order doesn't exist, create it
        const newOrderData = await convertWooCommerceOrder(wcOrder);
        const orderDocRef = await addDoc(ordersRef, newOrderData);
        
        // Now that we have the orderId, update the client with this order ID
        if (newOrderData.clientId) {
          await updateClientWithOrder(
            newOrderData.clientId,
            orderDocRef.id,
            newOrderData.total,
            wcOrder.id
          );
          
          // Track client statistics
          const clientRef = doc(db, 'clients', newOrderData.clientId);
          const clientDoc = await getDoc(clientRef);
          if (clientDoc.exists()) {
            const clientData = clientDoc.data() as Client;
            if (clientData.totalOrders <= 1) {
              newClients++;
            } else {
              updatedClients++;
            }
          }
        }
        
        newOrders++;
      } else {
        // Order exists, update it if needed
        const existingOrder = snapshot.docs[0];
        const existingOrderData = existingOrder.data() as Order;
        
        // Convert WooCommerce order to our format
        const newOrderData = await convertWooCommerceOrder(wcOrder);
        
        // Check if client ID has changed
        if (newOrderData.clientId && newOrderData.clientId !== existingOrderData.clientId) {
          await updateClientWithOrder(
            newOrderData.clientId,
            existingOrder.id,
            newOrderData.total,
            wcOrder.id
          );
          
          // Track client updates
          const clientRef = doc(db, 'clients', newOrderData.clientId);
          const clientDoc = await getDoc(clientRef);
          if (clientDoc.exists()) {
            const clientData = clientDoc.data() as Client;
            if (clientData.totalOrders <= 1) {
              newClients++;
            } else {
              updatedClients++;
            }
          }
        }
        
        // Only update if something has changed
        if (
          existingOrderData.status !== newOrderData.status ||
          JSON.stringify(existingOrderData.items) !== JSON.stringify(newOrderData.items) ||
          existingOrderData.total !== newOrderData.total ||
          existingOrderData.hasUnidentifiedItems !== newOrderData.hasUnidentifiedItems ||
          existingOrderData.clientId !== newOrderData.clientId
        ) {
          const orderRef = doc(db, 'orders', existingOrder.id);
          
          // Update only what has changed
          const updatePayload: any = {
            status: newOrderData.status,
            items: newOrderData.items,
            ...(newOrderData.hasUnidentifiedItems ? { unidentifiedItems: newOrderData.unidentifiedItems } : {}),
            hasUnidentifiedItems: newOrderData.hasUnidentifiedItems,
            subtotal: newOrderData.subtotal,
            shippingCost: newOrderData.shippingCost,
            tax: newOrderData.tax,
            total: newOrderData.total,
            updatedAt: new Date()
          };
          
          // Only include clientId if it exists and has changed
          if (newOrderData.clientId && newOrderData.clientId !== existingOrderData.clientId) {
            updatePayload.clientId = newOrderData.clientId;
          }
          
          await updateDoc(orderRef, updatePayload);
          
          updatedOrders++;
        }
      }
    }
    
    // Recalculate client statistics from their actual orders
    try {
      const clientsRef = collection(db, 'clients');
      const clientsSnapshot = await getDocs(clientsRef);
      
      for (const clientDoc of clientsSnapshot.docs) {
        const clientId = clientDoc.id;
        const client = clientDoc.data() as Client;
        
        // Skip clients without orderIds
        if (!client.orderIds || client.orderIds.length === 0) {
          continue;
        }
        
        // Get all orders for this client
        let clientOrderTotal = 0;
        let clientOrderCount = 0;
        
        // Process each order ID
        for (const orderId of client.orderIds) {
          const orderDoc = await getDoc(doc(db, 'orders', orderId));
          if (orderDoc.exists()) {
            const order = orderDoc.data() as Order;
            clientOrderTotal += order.total;
            clientOrderCount++;
          }
        }
        
        // Update client with recalculated values
        if (clientOrderCount > 0) {
          await updateDoc(doc(db, 'clients', clientId), {
            totalOrders: clientOrderCount,
            totalSpent: clientOrderTotal,
            averageOrderValue: clientOrderTotal / clientOrderCount,
            updatedAt: new Date()
          });
        }
      }
    } catch (recalcError) {
      console.error('Error recalculating client statistics:', recalcError);
    }
    
    console.log(`WooCommerce sync completed: ${newOrders} new orders, ${updatedOrders} updated orders`);
    console.log(`Client sync: ${newClients} new clients, ${updatedClients} updated clients`);
    
  } catch (error) {
    console.error('Error in WooCommerce sync script:', error);
  }
};