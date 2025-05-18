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

// Initialize WooCommerce API
const initWooCommerceAPI = () => {
  // Get settings from localStorage
  const url = localStorage.getItem('wc_url') || '';
  const consumerKey = localStorage.getItem('wc_consumer_key') || '';
  const consumerSecret = localStorage.getItem('wc_consumer_secret') || '';
  
  const wooCommerceConfig = {
    url,
    consumerKey,
    consumerSecret,
    version: 'wc/v3'
  };
  
  return new WooCommerceRestApi(wooCommerceConfig);
};

// Test WooCommerce connection with provided credentials
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

// Map WooCommerce order status to internal status
const mapOrderStatus = (wcStatus: string): OrderStatus => {
  console.log(`Mapping WooCommerce status: ${wcStatus}`);
  
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

// Map internal order status to WooCommerce status
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

// Update order status on WooCommerce
export const updateOrderStatusOnWooCommerce = async (
  woocommerceId: number,
  status: OrderStatus
): Promise<{success: boolean, error?: string}> => {
  try {
    // Check if credentials exist
    if (!localStorage.getItem('wc_url') || 
        !localStorage.getItem('wc_consumer_key') || 
        !localStorage.getItem('wc_consumer_secret')) {
      return { 
        success: false, 
        error: 'WooCommerce credentials not found. Please configure them in Settings > WooCommerce.' 
      };
    }
    
    const api = initWooCommerceAPI();
    
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

// Find product in Firestore by barcode (WooCommerce SKU)
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
 * 
 * @param customerName The customer's full name
 * @param email The customer's email address
 * @param phone The customer's phone number
 * @param billingAddress The customer's billing address
 * @returns The client ID of the created or updated client
 */
const createOrUpdateClient = async (
  customerName: string,
  email: string,
  phone?: string,
  billingAddress?: Address
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
      
      // Create new client
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
        createdBy: 'system' // Since this is automated
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
      
      // Always increment totalOrders
      updates.totalOrders = (existingClient.totalOrders || 0) + 1;
      
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
 * 
 * @param clientId The client ID to update
 * @param orderTotal The total amount of the order
 */
const updateClientOrderStats = async (clientId: string | null): Promise<void> => {
  try {
    if (!clientId) return;
    
    const clientRef = doc(db, 'clients', clientId);
    const clientDoc = await getDoc(clientRef);
    
    if (clientDoc.exists()) {
      const clientData = clientDoc.data() as Client;
      
      // Calculate new values
      const totalOrders = clientData.totalOrders || 0;
      const totalSpent = (clientData.totalSpent || 0);
      const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
      
      // Set last order date to current date
      const lastOrderDate = new Date();
      
      // Update client with order statistics
      await updateDoc(clientRef, {
        averageOrderValue,
        lastOrderDate
      });
      
      // console.log(`Updated client ${clientId} order statistics: Total orders: ${totalOrders}, Total spent: ${totalSpent}, Avg order value: ${averageOrderValue}`);
    }
  } catch (error) {
    console.error('Error updating client order statistics:', error);
  }
};

// Convert WooCommerce order to internal Order format
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
  
  // Create or update client in CRM if email is available
  let clientId: string | null = null; // Initialize as null instead of undefined
  try {
    if (wcOrder.billing?.email) {
      // console.log(`Attempting to create/update client for order #${wcOrder.number}`);
      clientId = await createOrUpdateClient(
        customerName,
        wcOrder.billing.email,
        wcOrder.billing.phone || undefined,
        billingAddress
      );
      
      // console.log(`Client process result for order #${wcOrder.number}: clientId=${clientId || 'null'}`);
    } else {
      console.log(`No email available for order #${wcOrder.number}, skipping client creation`);
    }
  } catch (clientError) {
    console.error(`Error during client creation for order #${wcOrder.number}:`, clientError);
    clientId = null; // Ensure clientId is null on error
  }
  
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
    notes: wcOrder.customer_note || null,
    source: 'woocommerce',
    woocommerceId: wcOrder.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    packingSlipPrinted: false,
    clientId  // Will be null if no client was created/found
  };
  
  // If clientId exists, update client's order statistics
  if (clientId) {
    try {
      // console.log(`Updating order statistics for client ${clientId} with order total ${total}`);
      await updateClientOrderStats(clientId);
    } catch (statsError) {
      console.error(`Error updating client order statistics for client ${clientId}:`, statsError);
      // Error in updating stats doesn't affect the order creation
    }
  } else {
    console.log(`No clientId available for order #${wcOrder.number}, skipping order statistics update`);
  }
  
  return orderData;
};

// Sync WooCommerce orders
export const syncWooCommerceOrders = async (currentUser: User) => {
  try {
    // console.log('Starting WooCommerce orders sync...');
    
    // Initialize WooCommerce API
    const api = initWooCommerceAPI();
    
    // Check if credentials exist
    if (!localStorage.getItem('wc_url') || 
        !localStorage.getItem('wc_consumer_key') || 
        !localStorage.getItem('wc_consumer_secret')) {
      // console.error('WooCommerce credentials not found');
      return { 
        success: false, 
        error: 'WooCommerce credentials not found. Please configure them in Settings > WooCommerce.' 
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
          
          // DEBUG: Check if the client was processed correctly
          // console.log(`Client status for new order #${wcOrder.number}:`, {
          //   clientId: newOrderData.clientId || 'No clientId',
          //   customerEmail: newOrderData.customerEmail || 'No email',
          //   customerName: newOrderData.customerName
          // });
          
          // Track client updates
          if (newOrderData.clientId) {
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
          
          const docRef = await addDoc(ordersRef, newOrderData);
          
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
          
          // DEBUG: Check if the client was processed correctly for existing order
          // console.log(`Client status for existing order #${wcOrder.number}:`, {
          //   newClientId: newOrderData.clientId || 'No clientId',
          //   existingClientId: existingOrderData.clientId || 'No clientId',
          //   customerEmail: newOrderData.customerEmail || 'No email',
          //   changeDetected: newOrderData.clientId !== existingOrderData.clientId
          // });
          
          // Track client updates
          if (newOrderData.clientId && newOrderData.clientId !== existingOrderData.clientId) {
            // Client was added or changed
            const clientRef = doc(db, 'clients', newOrderData.clientId);
            const clientDoc = await getDoc(clientRef);
            if (clientDoc.exists()) {
              const clientData = clientDoc.data() as Client;
              if (clientData.totalOrders <= 1) {
                // console.log(`New client detected for existing order: ${newOrderData.clientId}`);
                newClients++;
              } else {
                // console.log(`Updated client detected for existing order: ${newOrderData.clientId}`);
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

// Create a script for scheduled sync (to be used with a cron job)
export const wooSyncScript = async () => {
  // This would be adapted to run from a Node.js script or Firebase Cloud Function
  try {
    console.log('Starting WooCommerce order sync...');
    
    // Initialize WooCommerce API
    const api = initWooCommerceAPI();
    
    // Check if credentials exist
    if (!localStorage.getItem('wc_url') || 
        !localStorage.getItem('wc_consumer_key') || 
        !localStorage.getItem('wc_consumer_secret')) {
      console.error('WooCommerce credentials not found.');
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
        
        // Track client statistics
        if (newOrderData.clientId) {
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
        
        // Track client updates
        if (newOrderData.clientId && newOrderData.clientId !== existingOrderData.clientId) {
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
    
    console.log(`Sync completed: ${newOrders} new orders, ${updatedOrders} updated orders`);
    console.log(`Client sync: ${newClients} new clients, ${updatedClients} updated clients`);
  } catch (error) {
    console.error('Error in WooCommerce sync script:', error);
  }
};