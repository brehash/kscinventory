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
    
    // Note: We're not using date filters here as products may not have a specific date field
    // to filter on. This would be more applicable for orders, activities, etc.
    
    const querySnapshot = await getDocs(q);
    const products = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Clean up data for export - flatten and convert dates to strings
      return {
        id: doc.id,
        name: data.name,
        barcode: data.barcode || '',
        category_id: data.categoryId,
        type_id: data.typeId,
        location_id: data.locationId,
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
    const orders = querySnapshot.docs.map(doc => {
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
        created_at: data.createdAt?.toDate().toISOString() || '',
        updated_at: data.updatedAt?.toDate().toISOString() || '',
        fulfilled_at: data.fulfilledAt?.toDate().toISOString() || '',
        fulfilled_by: data.fulfilledBy || ''
      };
    });
    
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
    
    const querySnapshot = await getDocs(q);
    const clients = querySnapshot.docs.map(doc => {
      const data = doc.data();
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
        website: data.website || '',
        is_active: data.isActive ? 'Yes' : 'No',
        total_orders: data.totalOrders || 0,
        total_spent: data.totalSpent || 0,
        average_order_value: data.averageOrderValue || 0,
        last_order_date: data.lastOrderDate?.toDate().toISOString() || '',
        created_at: data.createdAt?.toDate().toISOString() || '',
        updated_at: data.updatedAt?.toDate().toISOString() || ''
      };
    });
    
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