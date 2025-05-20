import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product, Order, Client, ActivityLog, User } from '../types';
import { logActivity } from './activityLogger';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Export formats
export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

/**
 * Generate a filename for an export
 * @param dataType The type of data being exported
 * @param format The file format
 * @returns A filename with the current date
 */
const generateFilename = (dataType: string, format: ExportFormat): string => {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  return `${dataType}_export_${dateStr}.${format}`;
};

/**
 * Convert data to CSV format
 * @param data Array of objects to convert to CSV
 * @param includeHeaders Whether to include column headers
 * @returns CSV string
 */
export const convertToCSV = (data: any[], includeHeaders: boolean = true): string => {
  if (data.length === 0) return '';
  
  // Get all possible headers from all objects
  const headers = Array.from(
    new Set(
      data.reduce((acc, obj) => [...acc, ...Object.keys(obj)], [] as string[])
    )
  );
  
  let csv = '';
  
  // Add headers if requested
  if (includeHeaders) {
    csv += headers.join(',') + '\r\n';
  }
  
  // Add data rows
  data.forEach(obj => {
    const row = headers.map(header => {
      const value = obj[header] === undefined ? '' : obj[header];
      
      // Handle strings that need escaping
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      
      // Handle dates
      if (value instanceof Date) {
        return value.toISOString();
      }
      
      return value;
    }).join(',');
    
    csv += row + '\r\n';
  });
  
  return csv;
};

/**
 * Export data as a file in the specified format
 * @param data The data to export
 * @param format The file format
 * @param filename The name of the file
 * @param includeHeaders Whether to include column headers (for CSV)
 */
export const exportDataAsFile = (
  data: any[],
  format: ExportFormat,
  filename: string,
  includeHeaders: boolean = true
): void => {
  // Prepare the data based on format
  let content: string | Blob;
  let mimeType: string;
  
  switch (format) {
    case 'csv':
      content = convertToCSV(data, includeHeaders);
      mimeType = 'text/csv;charset=utf-8;';
      break;
      
    case 'xlsx':
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
      content = new Blob(
        [XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      break;
      
    case 'pdf':
      // Create PDF document
      const doc = new jsPDF();
      
      if (data.length > 0) {
        // Extract column headers from the first object
        const headers = Object.keys(data[0]);
        
        // Prepare rows data
        const rows = data.map(item => {
          return headers.map(header => {
            const value = item[header];
            
            // Format dates
            if (value instanceof Date) {
              return value.toLocaleDateString();
            }
            
            return value !== undefined ? String(value) : '';
          });
        });
        
        // Add table to PDF
        (doc as any).autoTable({
          head: [headers],
          body: rows,
          startY: 20,
          margin: { top: 15 },
          styles: { fontSize: 8 },
          headStyles: { fillColor: [79, 70, 229] } // indigo-600 color
        });
        
        // Add title
        doc.setFontSize(16);
        doc.text(filename.replace(`.${format}`, ''), 14, 15);
      } else {
        // If no data, just add a message
        doc.setFontSize(16);
        doc.text(filename.replace(`.${format}`, ''), 14, 15);
        doc.setFontSize(12);
        doc.text('No data available for this report', 14, 30);
      }
      
      content = doc.output('blob');
      mimeType = 'application/pdf';
      break;
      
    case 'json':
      content = JSON.stringify(data, null, 2);
      mimeType = 'application/json;charset=utf-8;';
      break;
      
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
  
  // Create download link
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  
  // Trigger download
  document.body.appendChild(a);
  a.click();
  
  // Cleanup
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

/**
 * Export products data in the specified format
 * @param format The export format
 * @param includeHeaders Whether to include column headers
 * @param filters Optional filters to apply
 * @param currentUser The current user
 */
export const exportProducts = async (
  format: ExportFormat,
  includeHeaders: boolean = true,
  filters: {
    categoryId?: string;
    locationId?: string;
    providerId?: string;
    typeId?: string;
    minQuantity?: number;
    maxQuantity?: number;
    startDate?: string;
    endDate?: string;
  } = {},
  currentUser: User
): Promise<void> => {
  try {
    // Fetch products with optional filters
    const productsRef = collection(db, 'products');
    let q = query(productsRef);
    
    // Apply filters if provided
    if (filters.categoryId) {
      q = query(q, where('categoryId', '==', filters.categoryId));
    }
    
    if (filters.locationId) {
      q = query(q, where('locationId', '==', filters.locationId));
    }
    
    if (filters.providerId) {
      q = query(q, where('providerId', '==', filters.providerId));
    }
    
    if (filters.typeId) {
      q = query(q, where('typeId', '==', filters.typeId));
    }
    
    const querySnapshot = await getDocs(q);
    
    // Get reference data for better export formatting
    const categoriesSnapshot = await getDocs(collection(db, 'categories'));
    const categories = new Map<string, string>();
    categoriesSnapshot.docs.forEach(doc => categories.set(doc.id, doc.data().name));
    
    const locationsSnapshot = await getDocs(collection(db, 'locations'));
    const locations = new Map<string, string>();
    locationsSnapshot.docs.forEach(doc => locations.set(doc.id, doc.data().name));
    
    const productTypesSnapshot = await getDocs(collection(db, 'productTypes'));
    const productTypes = new Map<string, string>();
    productTypesSnapshot.docs.forEach(doc => productTypes.set(doc.id, doc.data().name));
    
    const providersSnapshot = await getDocs(collection(db, 'providers'));
    const providers = new Map<string, string>();
    providersSnapshot.docs.forEach(doc => providers.set(doc.id, doc.data().name));
    
    // Process products with filters and transformations
    let products = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Clean up data for export - flatten and convert dates to strings
      return {
        id: doc.id,
        name: data.name,
        barcode: data.barcode || '',
        category: categories.get(data.categoryId) || 'Unknown',
        category_id: data.categoryId,
        type: productTypes.get(data.typeId) || 'Unknown',
        type_id: data.typeId,
        location: locations.get(data.locationId) || 'Unknown',
        location_id: data.locationId,
        provider: data.providerId ? (providers.get(data.providerId) || 'Unknown') : '',
        provider_id: data.providerId || '',
        quantity: data.quantity,
        min_quantity: data.minQuantity,
        price: data.price,
        cost: data.cost || 0,
        vat_percentage: data.vatPercentage,
        total_value: (data.quantity * (data.cost || 0)).toFixed(2),
        retail_value: (data.quantity * data.price).toFixed(2),
        created_at: data.createdAt?.toDate().toISOString() || '',
        updated_at: data.updatedAt?.toDate().toISOString() || ''
      };
    });
    
    // Apply additional client-side filters
    if (filters.minQuantity !== undefined) {
      products = products.filter(product => product.quantity >= filters.minQuantity!);
    }
    
    if (filters.maxQuantity !== undefined) {
      products = products.filter(product => product.quantity <= filters.maxQuantity!);
    }
    
    // Log the export activity
    await logActivity(
      'added',
      'export', 
      Date.now().toString(), // Using timestamp as ID
      `Products Export (${format.toUpperCase()})`,
      currentUser
    );
    
    // Generate filename
    const filename = generateFilename('products', format);
    
    // Export the data
    exportDataAsFile(products, format, filename, includeHeaders);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error exporting products:', error);
    return Promise.reject(error);
  }
};

/**
 * Export orders data in the specified format
 * @param format The export format
 * @param includeHeaders Whether to include column headers
 * @param filters Optional filters to apply
 * @param currentUser The current user
 */
export const exportOrders = async (
  format: ExportFormat,
  includeHeaders: boolean = true,
  filters: {
    status?: string;
    paymentMethod?: string;
    source?: string;
    minTotal?: number;
    maxTotal?: number;
    clientId?: string;
    startDate?: string;
    endDate?: string;
  } = {},
  currentUser: User
): Promise<void> => {
  try {
    // Fetch orders with optional filters
    const ordersRef = collection(db, 'orders');
    let q = query(ordersRef);
    
    // Apply filters if provided
    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    
    if (filters.paymentMethod) {
      q = query(q, where('paymentMethod', '==', filters.paymentMethod));
    }
    
    if (filters.source) {
      q = query(q, where('source', '==', filters.source));
    }
    
    if (filters.clientId) {
      q = query(q, where('clientId', '==', filters.clientId));
    }
    
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      q = query(q, where('orderDate', '>=', Timestamp.fromDate(startDate)));
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      q = query(q, where('orderDate', '<=', Timestamp.fromDate(endDate)));
    }
    
    q = query(q, orderBy('orderDate', 'desc'));
    
    const querySnapshot = await getDocs(q);
    
    // Transform orders for export
    let orders = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Clean up data for export - flatten and convert dates to strings
      return {
        id: doc.id,
        order_number: data.orderNumber,
        customer_name: data.customerName,
        customer_email: data.customerEmail || '',
        order_date: data.orderDate?.toDate().toISOString() || '',
        status: data.status,
        subtotal: data.subtotal,
        shipping_cost: data.shippingCost,
        tax: data.tax,
        total: data.total,
        payment_method: data.paymentMethod,
        source: data.source,
        items_count: data.items?.length || 0,
        shipping_address: `${data.shippingAddress?.address1 || ''}, ${data.shippingAddress?.city || ''}, ${data.shippingAddress?.country || ''}`,
        billing_address: `${data.billingAddress?.address1 || ''}, ${data.billingAddress?.city || ''}, ${data.billingAddress?.country || ''}`,
        created_at: data.createdAt?.toDate().toISOString() || '',
        updated_at: data.updatedAt?.toDate().toISOString() || '',
        fulfilled_at: data.fulfilledAt?.toDate().toISOString() || '',
        fulfilled_by: data.fulfilledBy || ''
      };
    });
    
    // Apply additional client-side filters
    if (filters.minTotal !== undefined) {
      orders = orders.filter(order => order.total >= filters.minTotal!);
    }
    
    if (filters.maxTotal !== undefined) {
      orders = orders.filter(order => order.total <= filters.maxTotal!);
    }
    
    // Log the export activity
    await logActivity(
      'added',
      'export', 
      Date.now().toString(), // Using timestamp as ID
      `Orders Export (${format.toUpperCase()})`,
      currentUser
    );
    
    // Generate filename
    const filename = generateFilename('orders', format);
    
    // Export the data
    exportDataAsFile(orders, format, filename, includeHeaders);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error exporting orders:', error);
    return Promise.reject(error);
  }
};

/**
 * Export clients data in the specified format
 * @param format The export format
 * @param includeHeaders Whether to include column headers
 * @param filters Optional filters to apply
 * @param currentUser The current user
 */
export const exportClients = async (
  format: ExportFormat,
  includeHeaders: boolean = true,
  filters: {
    isActive?: boolean;
    minTotalOrders?: number;
    minTotalSpent?: number;
    tags?: string[];
    startDate?: string;
    endDate?: string;
  } = {},
  currentUser: User
): Promise<void> => {
  try {
    // Fetch clients with optional filters
    const clientsRef = collection(db, 'clients');
    let q = query(clientsRef);
    
    // Apply filters if provided
    if (filters.isActive !== undefined) {
      q = query(q, where('isActive', '==', filters.isActive));
    }
    
    // Date filters would apply to createdAt or lastOrderDate depending on requirements
    if (filters.startDate && filters.endDate) {
      // Example: filter by createdAt date
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      
      q = query(q, where('createdAt', '>=', Timestamp.fromDate(startDate)));
      q = query(q, where('createdAt', '<=', Timestamp.fromDate(endDate)));
    }
    
    const querySnapshot = await getDocs(q);
    
    // Process clients with additional filters
    let clients = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Format address for display
      let formattedAddress = '';
      if (data.address) {
        const addr = data.address;
        formattedAddress = [
          addr.address1,
          addr.address2,
          `${addr.city}, ${addr.state} ${addr.postcode}`,
          addr.country
        ].filter(Boolean).join(', ');
      }
      
      // Clean up data for export - flatten and convert dates to strings
      return {
        id: doc.id,
        name: data.name,
        email: data.email || '',
        phone: data.phone || '',
        company_name: data.companyName || '',
        tax_id: data.taxId || '',
        contact_person: data.contactPerson || '',
        contact_role: data.contactRole || '',
        address: formattedAddress,
        website: data.website || '',
        tags: (data.tags || []).join(', '),
        is_active: data.isActive ? 'Yes' : 'No',
        total_orders: data.totalOrders || 0,
        total_spent: data.totalSpent || 0,
        average_order_value: data.averageOrderValue || 0,
        last_order_date: data.lastOrderDate?.toDate().toISOString() || '',
        created_at: data.createdAt?.toDate().toISOString() || '',
        updated_at: data.updatedAt?.toDate().toISOString() || '',
        source: data.source || 'manual'
      };
    });
    
    // Apply additional client-side filters
    if (filters.minTotalOrders !== undefined) {
      clients = clients.filter(client => client.total_orders >= filters.minTotalOrders!);
    }
    
    if (filters.minTotalSpent !== undefined) {
      clients = clients.filter(client => client.total_spent >= filters.minTotalSpent!);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      clients = clients.filter(client => {
        const clientTags = client.tags.split(', ');
        return filters.tags!.every(tag => clientTags.includes(tag));
      });
    }
    
    // Log the export activity
    await logActivity(
      'added',
      'export', 
      Date.now().toString(), // Using timestamp as ID
      `Clients Export (${format.toUpperCase()})`,
      currentUser
    );
    
    // Generate filename
    const filename = generateFilename('clients', format);
    
    // Export the data
    exportDataAsFile(clients, format, filename, includeHeaders);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error exporting clients:', error);
    return Promise.reject(error);
  }
};

/**
 * Export activity logs in the specified format
 * @param format The export format
 * @param includeHeaders Whether to include column headers
 * @param filters Optional filters to apply
 * @param currentUser The current user
 */
export const exportActivities = async (
  format: ExportFormat,
  includeHeaders: boolean = true,
  filters: {
    type?: string;
    entityType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  } = {},
  currentUser: User
): Promise<void> => {
  try {
    // Fetch activities with optional filters
    const activitiesRef = collection(db, 'activities');
    let q = query(activitiesRef);
    
    // Apply filters if provided
    if (filters.type) {
      q = query(q, where('type', '==', filters.type));
    }
    
    if (filters.entityType) {
      q = query(q, where('entityType', '==', filters.entityType));
    }
    
    if (filters.userId) {
      q = query(q, where('userId', '==', filters.userId));
    }
    
    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      q = query(q, where('date', '>=', startDate));
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      q = query(q, where('date', '<=', endDate));
    }
    
    q = query(q, orderBy('date', 'desc'));
    
    const querySnapshot = await getDocs(q);
    const activities = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Clean up data for export - flatten and convert dates to strings
      return {
        id: doc.id,
        type: data.type,
        entity_type: data.entityType,
        entity_id: data.entityId,
        entity_name: data.entityName,
        quantity: data.quantity || '',
        date: data.date?.toDate().toISOString() || '',
        user_id: data.userId,
        user_name: data.userName,
        source_location_id: data.sourceLocationId || '',
        destination_location_id: data.destinationLocationId || ''
      };
    });
    
    // Log the export activity
    await logActivity(
      'added',
      'export', 
      Date.now().toString(), // Using timestamp as ID
      `Activity Logs Export (${format.toUpperCase()})`,
      currentUser
    );
    
    // Generate filename
    const filename = generateFilename('activity_logs', format);
    
    // Export the data
    exportDataAsFile(activities, format, filename, includeHeaders);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error exporting activity logs:', error);
    return Promise.reject(error);
  }
};

/**
 * Export data based on custom field selection
 * @param dataFields Array of field IDs to include in the export
 * @param format The export format
 * @param includeHeaders Whether to include column headers
 * @param filters Optional filters to apply
 * @param currentUser The current user
 */
export const exportCustom = async (
  dataFields: string[],
  format: ExportFormat,
  includeHeaders: boolean = true,
  filters: {
    startDate?: string;
    endDate?: string;
  } = {},
  currentUser: User
): Promise<void> => {
  try {
    // Organize fields by data type
    const productFields = dataFields.filter(field => field.startsWith('product_'));
    const orderFields = dataFields.filter(field => field.startsWith('order_'));
    const clientFields = dataFields.filter(field => field.startsWith('client_'));
    
    // Initialize result arrays
    let results: any[] = [];
    
    // Field maps for extracting the right data
    const fieldMaps = {
      product_: {
        name: 'name',
        barcode: 'barcode',
        category: 'categoryId',
        location: 'locationId',
        quantity: 'quantity',
        cost: 'cost',
        price: 'price'
      },
      order_: {
        number: 'orderNumber',
        date: 'orderDate',
        customer: 'customerName',
        status: 'status',
        total: 'total'
      },
      client_: {
        name: 'name',
        email: 'email',
        orders: 'totalOrders',
        total_spent: 'totalSpent'
      }
    };
    
    // Fetch and process data based on selected fields
    if (productFields.length > 0) {
      const productsRef = collection(db, 'products');
      const querySnapshot = await getDocs(productsRef);
      
      let productResults = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const result: any = { id: doc.id };
        
        productFields.forEach(field => {
          const fieldName = field.replace('product_', '');
          const dbField = fieldMaps.product_[fieldName as keyof typeof fieldMaps.product_];
          result[field] = data[dbField] !== undefined ? data[dbField] : '';
        });
        
        return result;
      });
      
      results = [...productResults];
    }
    
    if (orderFields.length > 0) {
      const ordersRef = collection(db, 'orders');
      let q = query(ordersRef);
      
      // Apply date filters if provided
      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        q = query(q, where('orderDate', '>=', Timestamp.fromDate(startDate)));
      }
      
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        q = query(q, where('orderDate', '<=', Timestamp.fromDate(endDate)));
      }
      
      const querySnapshot = await getDocs(q);
      
      let orderResults = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const result: any = { id: doc.id };
        
        orderFields.forEach(field => {
          const fieldName = field.replace('order_', '');
          const dbField = fieldMaps.order_[fieldName as keyof typeof fieldMaps.order_];
          
          if (dbField === 'orderDate') {
            result[field] = data[dbField]?.toDate().toISOString() || '';
          } else {
            result[field] = data[dbField] !== undefined ? data[dbField] : '';
          }
        });
        
        return result;
      });
      
      // If we already have product results, we need to join the data
      if (results.length > 0) {
        // Implement join logic based on your data relationships
        // This is a simplified example that just concatenates the results
        results = [...results, ...orderResults];
      } else {
        results = orderResults;
      }
    }
    
    if (clientFields.length > 0) {
      const clientsRef = collection(db, 'clients');
      const querySnapshot = await getDocs(clientsRef);
      
      let clientResults = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const result: any = { id: doc.id };
        
        clientFields.forEach(field => {
          const fieldName = field.replace('client_', '');
          const dbField = fieldMaps.client_[fieldName as keyof typeof fieldMaps.client_];
          result[field] = data[dbField] !== undefined ? data[dbField] : '';
        });
        
        return result;
      });
      
      if (results.length > 0) {
        results = [...results, ...clientResults];
      } else {
        results = clientResults;
      }
    }
    
    // Log the export activity
    await logActivity(
      'added',
      'export', 
      Date.now().toString(), // Using timestamp as ID
      `Custom Export (${format.toUpperCase()})`,
      currentUser
    );
    
    // Generate filename
    const filename = generateFilename('custom_export', format);
    
    // Export the data
    exportDataAsFile(results, format, filename, includeHeaders);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error generating custom export:', error);
    return Promise.reject(error);
  }
};

/**
 * Export dashboard as PDF with charts
 * @param dashboardData The dashboard data including charts
 * @param currentUser The current user
 * @returns Promise that resolves when the export is complete
 */
export const exportDashboardAsPDF = async (
  dashboardData: {
    title: string;
    subtitle?: string;
    date: string;
    stats: {
      totalProducts: number;
      totalValue: number;
      lowStockCount: number;
      totalSales: number;
      totalOrders: number;
      totalClients: number;
    },
    chartImages?: string[]
  },
  currentUser: User
): Promise<void> => {
  try {
    const doc = new jsPDF();
    let yPos = 15;
    const marginLeft = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text(dashboardData.title, marginLeft, yPos);
    yPos += 10;
    
    // Add subtitle if provided
    if (dashboardData.subtitle) {
      doc.setFontSize(12);
      doc.setTextColor(107, 114, 128); // gray-500
      doc.text(dashboardData.subtitle, marginLeft, yPos);
      yPos += 10;
    }
    
    // Add date
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // gray-500
    doc.text(`Generated: ${dashboardData.date}`, marginLeft, yPos);
    yPos += 15;
    
    // Add stats section
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55); // gray-800
    doc.text("Key Metrics", marginLeft, yPos);
    yPos += 8;
    
    const stats = [
      { label: "Total Products", value: dashboardData.stats.totalProducts.toString() },
      { label: "Inventory Value", value: `${dashboardData.stats.totalValue.toLocaleString()} RON` },
      { label: "Low Stock Items", value: dashboardData.stats.lowStockCount.toString() },
      { label: "Total Sales", value: `${dashboardData.stats.totalSales.toLocaleString()} RON` },
      { label: "Total Orders", value: dashboardData.stats.totalOrders.toString() },
      { label: "Total Clients", value: dashboardData.stats.totalClients.toString() }
    ];
    
    // Create a stats table
    const statsData = stats.map(stat => [stat.label, stat.value]);
    
    (doc as any).autoTable({
      startY: yPos,
      head: [["Metric", "Value"]],
      body: statsData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: marginLeft }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // Add charts if provided
    if (dashboardData.chartImages && dashboardData.chartImages.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(31, 41, 55); // gray-800
      doc.text("Charts & Graphs", marginLeft, yPos);
      yPos += 10;
      
      // Add each chart image
      for (let i = 0; i < dashboardData.chartImages.length; i++) {
        const chartImage = dashboardData.chartImages[i];
        
        // Check if we need to add a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }
        
        try {
          // Add the chart image
          const imgWidth = pageWidth - (marginLeft * 2);
          const imgHeight = 80;
          doc.addImage(chartImage, 'PNG', marginLeft, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 15;
        } catch (err) {
          console.error(`Error adding chart image ${i}:`, err);
        }
      }
    }
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175); // gray-400
      doc.text(
        `Inventory Management System - Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    // Log the export activity
    await logActivity(
      'added',
      'export', 
      Date.now().toString(), // Using timestamp as ID
      `Dashboard Export (PDF)`,
      currentUser
    );
    
    // Generate filename
    const filename = generateFilename('dashboard_report', 'pdf');
    
    // Save the PDF
    doc.save(filename);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error exporting dashboard as PDF:', error);
    return Promise.reject(error);
  }
};

// Utility for converting DOM elements to images for PDF export
export const domToImage = async (element: HTMLElement): Promise<string> => {
  // Using html2canvas dynamic import
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(element, {
    scale: 2, // Higher scale for better quality
    logging: false,
    useCORS: true,
    allowTaint: true
  });
  
  return canvas.toDataURL('image/png');
};