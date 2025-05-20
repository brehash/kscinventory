import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, User, ActivityLog, Product, Client, ActivityType, ActivityEntityType } from '../types';
import { logActivity } from './activityLogger';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

/**
 * Generates a filename for the exported report
 * @param format The file format extension
 * @returns A string with the filename
 */
export const generateReportFilename = (format: string, type: string = 'report'): string => {
  const date = new Date();
  const formattedDate = date.toISOString().split('T')[0];
  return `${type}-${formattedDate}.${format}`;
};

/**
 * Converts array of objects to CSV format
 * @param data Array of objects to convert
 * @param includeHeaders Whether to include column headers
 * @returns CSV formatted string
 */
export const convertToCSV = (data: any[], includeHeaders = true): string => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Add headers if requested
  if (includeHeaders) {
    csvRows.push(headers.join(','));
  }
  
  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const cell = row[header] || '';
      // Escape quotes and wrap in quotes if the cell contains commas or quotes
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
};

/**
 * Formats currency values for display
 * @param value Number to format as currency
 * @param currency Currency code (default: RON)
 * @returns Formatted currency string
 */
export const formatCurrency = (value: number, currency = 'RON'): string => {
  return `${value.toFixed(2)} ${currency}`;
};

/**
 * Export activities to a file based on provided filters
 * @param format Export format (csv, xlsx, pdf, json)
 * @param includeHeaders Whether to include column headers
 * @param filters Filters to apply to the query
 * @param currentUser The current authenticated user
 */
export const exportActivities = async (
  format: ExportFormat,
  includeHeaders = true,
  filters: {
    type?: ActivityType;
    entityType?: ActivityEntityType;
    userId?: string;
    startDate?: string;
    endDate?: string;
  },
  currentUser: User
): Promise<void> => {
  try {
    // Build the base query for activities
    const activitiesRef = collection(db, 'activities');
    let q = query(activitiesRef, orderBy('date', 'desc'));
    
    // Apply filters if they exist
    const queryFilters = [];
    
    // Activity type filter
    if (filters.type) {
      queryFilters.push(where('type', '==', filters.type));
    }
    
    // Entity type filter
    if (filters.entityType) {
      queryFilters.push(where('entityType', '==', filters.entityType));
    }
    
    // User filter
    if (filters.userId) {
      queryFilters.push(where('userId', '==', filters.userId));
    }
    
    // Date range filters
    if (filters.startDate) {
      const startDateObj = new Date(filters.startDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      queryFilters.push(where('date', '>=', Timestamp.fromDate(startDateObj)));
    }
    
    if (filters.endDate) {
      const endDateObj = new Date(filters.endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      queryFilters.push(where('date', '<=', Timestamp.fromDate(endDateObj)));
    }
    
    // Apply all filters if there are any
    if (queryFilters.length > 0) {
      q = query(activitiesRef, ...queryFilters, orderBy('date', 'desc'));
    }
    
    // Execute query
    const snapshot = await getDocs(q);
    
    // Process activities data
    const activitiesData = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        type: data.type,
        entityType: data.entityType,
        entityName: data.entityName,
        userName: data.userName,
        date: data.date?.toDate().toISOString() || new Date().toISOString(),
        quantity: data.quantity || '',
        userId: data.userId
      };
    });
    
    // Format data for export based on selected format
    let content: string | Blob;
    let mimeType: string;
    let fileName: string;
    
    switch(format) {
      case 'csv':
        content = convertToCSV(activitiesData, includeHeaders);
        mimeType = 'text/csv';
        fileName = generateReportFilename('csv', 'activity-log');
        break;
        
      case 'json':
        content = JSON.stringify(activitiesData, null, 2);
        mimeType = 'application/json';
        fileName = generateReportFilename('json', 'activity-log');
        break;
        
      case 'xlsx':
        // Create workbook
        const wb = XLSX.utils.book_new();
        // Create worksheet from JSON data
        const ws = XLSX.utils.json_to_sheet(activitiesData, { header: Object.keys(activitiesData[0]) });
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, "Activities");
        // Generate XLSX file
        const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        content = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = generateReportFilename('xlsx', 'activity-log');
        break;
        
      case 'pdf':
        // Configure PDF document
        const doc = new jsPDF();
        doc.text('Activity Log Export', 14, 16);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
        
        // Create table data for PDF
        const tableData = activitiesData.map(activity => [
          activity.date.split('T')[0], // Date only
          activity.type,
          activity.entityType,
          activity.entityName,
          activity.userName,
          activity.quantity?.toString() || ''
        ]);
        
        // Create table with column headers
        (doc as any).autoTable({
          startY: 30,
          head: [['Date', 'Type', 'Entity Type', 'Entity Name', 'User', 'Quantity']],
          body: tableData,
        });
        
        // Get the PDF as blob
        content = doc.output('blob');
        mimeType = 'application/pdf';
        fileName = generateReportFilename('pdf', 'activity-log');
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    // Create a download link for the file
    // If the content is a string, convert it to a Blob first
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Log the export activity
    await logActivity(
      'added',
      'export',
      new Date().getTime().toString(),
      `Activity Log Export (${format.toUpperCase()})`,
      currentUser
    );
    
  } catch (error) {
    console.error('Error exporting activities:', error);
    throw error;
  }
};

/**
 * Exports order data based on provided filters
 * @param format Export format (csv, xlsx, pdf, json)
 * @param includeHeaders Whether to include column headers in exports
 * @param filters Object containing filters to apply to the query
 * @param currentUser The current authenticated user
 * @returns Promise that resolves when export is complete
 */
export const exportOrders = async (
  format: ExportFormat,
  includeHeaders = true,
  filters: {
    status?: string;
    paymentMethod?: string;
    source?: string;
    clientId?: string;
    minTotal?: number;
    maxTotal?: number;
    startDate: string;
    endDate: string;
  },
  currentUser: User
): Promise<void> => {
  try {
    // Convert ISO date strings to Date objects
    const startDateObj = new Date(filters.startDate);
    startDateObj.setHours(0, 0, 0, 0); // Start of day
    
    const endDateObj = new Date(filters.endDate);
    endDateObj.setHours(23, 59, 59, 999); // End of day
    
    // Base query
    const ordersRef = collection(db, 'orders');
    let q = query(
      ordersRef, 
      where('orderDate', '>=', Timestamp.fromDate(startDateObj)),
      where('orderDate', '<=', Timestamp.fromDate(endDateObj)),
      orderBy('orderDate', 'desc')
    );
    
    // Apply additional filters if provided
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
    
    const querySnapshot = await getDocs(q);
    let ordersData = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      orderDate: doc.data().orderDate?.toDate().toISOString() || new Date().toISOString(),
      createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString() || new Date().toISOString(),
      ...(doc.data().fulfilledAt ? { fulfilledAt: doc.data().fulfilledAt.toDate().toISOString() } : {})
    })) as any[];
    
    // Apply total filters if provided
    if (filters.minTotal !== undefined) {
      ordersData = ordersData.filter(order => order.total >= filters.minTotal);
    }
    
    if (filters.maxTotal !== undefined) {
      ordersData = ordersData.filter(order => order.total <= filters.maxTotal);
    }
    
    // Prepare data for export
    const exportData = ordersData.map(order => {
      // Format the order data for export
      return {
        orderNumber: order.orderNumber,
        orderDate: new Date(order.orderDate).toLocaleDateString(),
        customerName: order.customerName,
        customerEmail: order.customerEmail || '',
        status: order.status,
        paymentMethod: order.paymentMethod,
        source: order.source,
        itemCount: order.items?.length || 0,
        subtotal: order.subtotal.toFixed(2),
        shipping: order.shippingCost.toFixed(2),
        tax: order.tax.toFixed(2),
        total: order.total.toFixed(2),
        notes: order.notes || ''
      };
    });
    
    let content: string | Blob;
    let mimeType: string;
    let fileName: string;
    
    // Generate the content based on the requested format
    switch(format) {
      case 'csv':
        content = convertToCSV(exportData, includeHeaders);
        mimeType = 'text/csv';
        fileName = generateReportFilename('csv', 'orders');
        break;
        
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        fileName = generateReportFilename('json', 'orders');
        break;
        
      case 'xlsx':
        // Create workbook with XLSX
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData, { header: Object.keys(exportData[0]) });
        XLSX.utils.book_append_sheet(wb, ws, "Orders");
        const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        content = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = generateReportFilename('xlsx', 'orders');
        break;
        
      case 'pdf':
        // Create PDF document
        const doc = new jsPDF();
        doc.text('Orders Export', 14, 16);
        doc.text(`Date Range: ${filters.startDate} to ${filters.endDate}`, 14, 22);
        
        // Create table data for PDF
        const tableData = exportData.map(order => [
          order.orderNumber,
          order.orderDate,
          order.customerName,
          order.status,
          order.paymentMethod,
          order.total
        ]);
        
        (doc as any).autoTable({
          startY: 30,
          head: [['Order #', 'Date', 'Customer', 'Status', 'Payment', 'Total (RON)']],
          body: tableData,
        });
        
        content = doc.output('blob');
        mimeType = 'application/pdf';
        fileName = generateReportFilename('pdf', 'orders');
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    // Generate download
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Log activity
    await logActivity(
      'added',
      'export',
      new Date().getTime().toString(),
      `Orders Export (${format.toUpperCase()})`,
      currentUser
    );
    
  } catch (error) {
    console.error('Error exporting orders:', error);
    throw error;
  }
};

/**
 * Export products data based on provided filters
 * @param format Export format (csv, xlsx, pdf, json)
 * @param includeHeaders Whether to include column headers
 * @param filters Filters to apply to the query
 * @param currentUser The current authenticated user
 * @param reportType Optional report type for specialized exports
 */
export const exportProducts = async (
  format: ExportFormat,
  includeHeaders = true,
  filters: {
    categoryId?: string;
    locationId?: string;
    providerId?: string;
    typeId?: string;
    minQuantity?: number;
    maxQuantity?: number;
    startDate: string;
    endDate: string;
  },
  currentUser: User,
  reportType?: string
): Promise<void> => {
  try {
    // Build the query based on filters
    const productsRef = collection(db, 'products');
    let q = query(productsRef);
    
    // Apply filters
    const queryFilters = [];
    
    if (filters.categoryId) {
      queryFilters.push(where('categoryId', '==', filters.categoryId));
    }
    
    if (filters.locationId) {
      queryFilters.push(where('locationId', '==', filters.locationId));
    }
    
    if (filters.providerId) {
      queryFilters.push(where('providerId', '==', filters.providerId));
    }
    
    if (filters.typeId) {
      queryFilters.push(where('typeId', '==', filters.typeId));
    }
    
    // Apply any query filters
    if (queryFilters.length > 0) {
      q = query(productsRef, ...queryFilters);
    }
    
    // Execute query and get products
    const snapshot = await getDocs(q);
    let productsData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
    
    // Apply client-side filters
    if (filters.minQuantity !== undefined) {
      productsData = productsData.filter(product => product.quantity >= filters.minQuantity!);
    }
    
    if (filters.maxQuantity !== undefined) {
      productsData = productsData.filter(product => product.quantity <= filters.maxQuantity!);
    }
    
    // Get related entity names
    const [categories, locations, productTypes, providers] = await Promise.all([
      getDocs(collection(db, 'categories')),
      getDocs(collection(db, 'locations')),
      getDocs(collection(db, 'productTypes')),
      getDocs(collection(db, 'providers'))
    ]);
    
    const categoryMap = new Map();
    categories.docs.forEach(doc => categoryMap.set(doc.id, doc.data().name));
    
    const locationMap = new Map();
    locations.docs.forEach(doc => locationMap.set(doc.id, doc.data().name));
    
    const typeMap = new Map();
    productTypes.docs.forEach(doc => typeMap.set(doc.id, doc.data().name));
    
    const providerMap = new Map();
    providers.docs.forEach(doc => providerMap.set(doc.id, doc.data().name));
    
    // Format data depending on report type
    const reportTitle = reportType || 'Product Inventory';
    let exportData;
    
    switch(reportType) {
      case 'low-stock':
        // Special formatting for low stock report - filter products below min quantity
        const lowStockProducts = productsData.filter(p => p.quantity <= p.minQuantity);
        
        exportData = lowStockProducts.map(product => ({
          name: product.name,
          barcode: product.barcode || '',
          category: categoryMap.get(product.categoryId) || 'Unknown',
          location: locationMap.get(product.locationId) || 'Unknown',
          currentQuantity: product.quantity,
          minQuantity: product.minQuantity,
          deficitQuantity: product.minQuantity - product.quantity,
          status: product.quantity === 0 ? 'Out of Stock' : 'Low Stock',
          lastUpdated: product.updatedAt?.toLocaleDateString() || 'Unknown'
        }));
        break;
      
      case 'stock-value':
        // Special formatting for stock value report
        exportData = productsData.map(product => ({
          name: product.name,
          barcode: product.barcode || '',
          category: categoryMap.get(product.categoryId) || 'Unknown',
          location: locationMap.get(product.locationId) || 'Unknown',
          quantity: product.quantity,
          costPrice: product.cost?.toFixed(2) || 'N/A',
          totalCostValue: ((product.cost || 0) * product.quantity).toFixed(2),
          sellingPrice: product.price.toFixed(2),
          totalSellingValue: (product.price * product.quantity).toFixed(2),
          profitMargin: product.cost ? (((product.price - product.cost) / product.cost) * 100).toFixed(2) + '%' : 'N/A'
        }));
        break;
        
      // Add case for stock-movement if needed
        
      default:
        // Default product export format
        exportData = productsData.map(product => ({
          name: product.name,
          barcode: product.barcode || '',
          category: categoryMap.get(product.categoryId) || 'Unknown',
          type: typeMap.get(product.typeId) || 'Unknown',
          location: locationMap.get(product.locationId) || 'Unknown',
          provider: product.providerId ? providerMap.get(product.providerId) || 'Unknown' : 'None',
          quantity: product.quantity,
          minQuantity: product.minQuantity,
          cost: product.cost?.toFixed(2) || 'N/A',
          price: product.price.toFixed(2),
          vatPercentage: product.vatPercentage + '%',
          totalValue: ((product.cost || 0) * product.quantity).toFixed(2),
          sellingValue: (product.price * product.quantity).toFixed(2)
        }));
    }
    
    // Sort data based on report type
    if (reportType === 'low-stock') {
      // Sort by deficit (most critical first)
      exportData.sort((a, b) => b.deficitQuantity - a.deficitQuantity);
    } else if (reportType === 'stock-value') {
      // Sort by total cost value (highest first)
      exportData.sort((a, b) => parseFloat(b.totalCostValue) - parseFloat(a.totalCostValue));
    }
    
    // Generate output based on requested format
    let content: string | Blob;
    let mimeType: string;
    let fileName: string;
    
    switch(format) {
      case 'csv':
        content = convertToCSV(exportData, includeHeaders);
        mimeType = 'text/csv';
        fileName = generateReportFilename('csv', `products-${reportType || 'inventory'}`);
        break;
        
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        fileName = generateReportFilename('json', `products-${reportType || 'inventory'}`);
        break;
        
      case 'xlsx':
        // Create Excel workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Products");
        const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        content = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = generateReportFilename('xlsx', `products-${reportType || 'inventory'}`);
        break;
        
      case 'pdf':
        // Create PDF document
        const doc = new jsPDF();
        doc.text(reportTitle, 14, 16);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
        
        // Columns to include depend on the report type
        let columns: string[];
        let tableData: any[][];
        
        if (reportType === 'low-stock') {
          columns = ['Name', 'Location', 'Current', 'Min', 'Status'];
          tableData = exportData.map(p => [
            p.name, 
            p.location, 
            p.currentQuantity.toString(), 
            p.minQuantity.toString(),
            p.status
          ]);
        } else if (reportType === 'stock-value') {
          columns = ['Name', 'Location', 'Qty', 'Cost', 'Value', 'Price', 'Retail Value'];
          tableData = exportData.map(p => [
            p.name,
            p.location,
            p.quantity.toString(),
            p.costPrice,
            p.totalCostValue,
            p.sellingPrice,
            p.totalSellingValue
          ]);
        } else {
          columns = ['Name', 'Category', 'Location', 'Qty', 'Cost', 'Price', 'Value'];
          tableData = exportData.map(p => [
            p.name,
            p.category,
            p.location,
            p.quantity.toString(),
            p.cost,
            p.price,
            p.totalValue
          ]);
        }
        
        // Add table to PDF
        (doc as any).autoTable({
          startY: 30,
          head: [columns],
          body: tableData,
        });
        
        content = doc.output('blob');
        mimeType = 'application/pdf';
        fileName = generateReportFilename('pdf', `products-${reportType || 'inventory'}`);
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    // Generate download
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Log activity
    await logActivity(
      'added',
      'export',
      new Date().getTime().toString(),
      `Products Export (${reportType || 'Inventory'})`,
      currentUser
    );
    
  } catch (error) {
    console.error('Error exporting products:', error);
    throw error;
  }
};

/**
 * Export client data with optional filters
 * @param format Export format (csv, xlsx, pdf, json)
 * @param includeHeaders Whether to include column headers
 * @param filters Filters to apply to the query
 * @param currentUser The current authenticated user
 */
export const exportClients = async (
  format: ExportFormat,
  includeHeaders = true,
  filters: {
    isActive?: boolean;
    tags?: string[];
    minTotalOrders?: number;
    minTotalSpent?: number;
    startDate: string;
    endDate: string;
  },
  currentUser: User
): Promise<void> => {
  try {
    // Base query for clients
    const clientsRef = collection(db, 'clients');
    let q = query(clientsRef);
    
    // Apply filters
    const queryFilters = [];
    
    if (filters.isActive !== undefined) {
      queryFilters.push(where('isActive', '==', filters.isActive));
    }
    
    // For filtering by tags, we need client-side filtering
    // For filtering by min values, we need client-side filtering
    
    // Apply any query filters
    if (queryFilters.length > 0) {
      q = query(clientsRef, ...queryFilters);
    }
    
    // Fetch clients
    const snapshot = await getDocs(q);
    let clientsData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate().toISOString() || new Date().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate().toISOString() || new Date().toISOString(),
      lastOrderDate: doc.data().lastOrderDate?.toDate().toISOString()
    })) as any[];
    
    // Apply client-side filters
    if (filters.minTotalOrders !== undefined) {
      clientsData = clientsData.filter(client => (client.totalOrders || 0) >= filters.minTotalOrders!);
    }
    
    if (filters.minTotalSpent !== undefined) {
      clientsData = clientsData.filter(client => (client.totalSpent || 0) >= filters.minTotalSpent!);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      clientsData = clientsData.filter(client => {
        if (!client.tags) return false;
        return filters.tags!.every(tag => client.tags.includes(tag));
      });
    }
    
    // Format data for export
    const exportData = clientsData.map(client => {
      // Prepare address for display
      const address = client.address ? [
        client.address.address1,
        client.address.address2,
        `${client.address.city}, ${client.address.state} ${client.address.postcode}`,
        client.address.country
      ].filter(Boolean).join(', ') : 'Not provided';
      
      return {
        name: client.name,
        email: client.email || '',
        phone: client.phone || '',
        company: client.companyName || '',
        taxId: client.taxId || '',
        contactPerson: client.contactPerson || '',
        contactRole: client.contactRole || '',
        address: address,
        tags: client.tags ? client.tags.join(', ') : '',
        status: client.isActive ? 'Active' : 'Inactive',
        totalOrders: client.totalOrders || 0,
        totalSpent: (client.totalSpent || 0).toFixed(2),
        averageOrderValue: (client.averageOrderValue || 0).toFixed(2),
        lastOrder: client.lastOrderDate ? new Date(client.lastOrderDate).toLocaleDateString() : 'Never',
        createdAt: new Date(client.createdAt).toLocaleDateString(),
        source: client.source || 'manual'
      };
    });
    
    // Generate output based on requested format
    let content: string | Blob;
    let mimeType: string;
    let fileName: string;
    
    switch(format) {
      case 'csv':
        content = convertToCSV(exportData, includeHeaders);
        mimeType = 'text/csv';
        fileName = generateReportFilename('csv', 'clients');
        break;
        
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        fileName = generateReportFilename('json', 'clients');
        break;
        
      case 'xlsx':
        // Create Excel workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Clients");
        const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        content = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = generateReportFilename('xlsx', 'clients');
        break;
        
      case 'pdf':
        // Create PDF document
        const doc = new jsPDF();
        doc.text('Client Export', 14, 16);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
        
        // Basic client fields for PDF
        const columns = ['Name', 'Email', 'Phone', 'Company', 'Status', 'Total Orders', 'Total Spent'];
        
        // Prepare data for table
        const tableData = exportData.map(client => [
          client.name,
          client.email,
          client.phone,
          client.company,
          client.status,
          client.totalOrders.toString(),
          `${client.totalSpent} RON`
        ]);
        
        // Add table to PDF
        (doc as any).autoTable({
          startY: 30,
          head: [columns],
          body: tableData,
        });
        
        content = doc.output('blob');
        mimeType = 'application/pdf';
        fileName = generateReportFilename('pdf', 'clients');
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    // Generate download
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Log activity
    await logActivity(
      'added',
      'export',
      new Date().getTime().toString(),
      `Clients Export (${format.toUpperCase()})`,
      currentUser
    );
    
  } catch (error) {
    console.error('Error exporting clients:', error);
    throw error;
  }
};

/**
 * Export custom report based on selected fields
 * @param selectedFields Array of field IDs to include in export
 * @param format Export format (csv, xlsx, pdf, json)
 * @param includeHeaders Whether to include column headers
 * @param filters Date range and other filters
 * @param currentUser The current authenticated user
 */
export const exportCustom = async (
  selectedFields: string[],
  format: ExportFormat,
  includeHeaders = true,
  filters: {
    startDate: string;
    endDate: string;
  },
  currentUser: User
): Promise<void> => {
  try {
    // Determine which collections to query based on selected fields
    const needsProducts = selectedFields.some(field => field.startsWith('product_'));
    const needsOrders = selectedFields.some(field => field.startsWith('order_'));
    const needsClients = selectedFields.some(field => field.startsWith('client_'));
    
    // Initialize data arrays
    let productsData: any[] = [];
    let ordersData: any[] = [];
    let clientsData: any[] = [];
    
    // Fetch required data
    if (needsProducts) {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Get related data for products
      const [categories, locations, productTypes, providers] = await Promise.all([
        getDocs(collection(db, 'categories')),
        getDocs(collection(db, 'locations')),
        getDocs(collection(db, 'productTypes')),
        getDocs(collection(db, 'providers'))
      ]);
      
      const categoryMap = new Map();
      categories.docs.forEach(doc => categoryMap.set(doc.id, doc.data().name));
      
      const locationMap = new Map();
      locations.docs.forEach(doc => locationMap.set(doc.id, doc.data().name));
      
      const typeMap = new Map();
      productTypes.docs.forEach(doc => typeMap.set(doc.id, doc.data().name));
      
      const providerMap = new Map();
      providers.docs.forEach(doc => providerMap.set(doc.id, doc.data().name));
      
      // Enhance product data with related information
      productsData = productsData.map(product => ({
        ...product,
        categoryName: categoryMap.get(product.categoryId) || 'Unknown',
        locationName: locationMap.get(product.locationId) || 'Unknown',
        typeName: typeMap.get(product.typeId) || 'Unknown',
        providerName: product.providerId ? providerMap.get(product.providerId) || 'Unknown' : 'None',
        totalValue: (product.cost || 0) * product.quantity,
        totalSellingValue: product.price * product.quantity
      }));
    }
    
    if (needsOrders) {
      // Convert ISO date strings to Date objects
      const startDateObj = new Date(filters.startDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      
      const endDateObj = new Date(filters.endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      
      const ordersQuery = query(
        collection(db, 'orders'),
        where('orderDate', '>=', Timestamp.fromDate(startDateObj)),
        where('orderDate', '<=', Timestamp.fromDate(endDateObj)),
        orderBy('orderDate', 'desc')
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderDate: doc.data().orderDate?.toDate() || new Date(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        fulfilledAt: doc.data().fulfilledAt?.toDate()
      }));
    }
    
    if (needsClients) {
      const clientsSnapshot = await getDocs(collection(db, 'clients'));
      clientsData = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        lastOrderDate: doc.data().lastOrderDate?.toDate()
      }));
    }
    
    // Build export rows
    const exportRows: Record<string, any>[] = [];
    
    // Map of field IDs to human-readable names
    const fieldNameMap: Record<string, string> = {
      // Product fields
      product_name: 'Product Name',
      product_barcode: 'Barcode',
      product_category: 'Category',
      product_location: 'Location',
      product_type: 'Product Type',
      product_provider: 'Provider',
      product_quantity: 'Quantity',
      product_min_quantity: 'Min Quantity',
      product_cost: 'Cost Price',
      product_price: 'Selling Price',
      product_vat: 'VAT %',
      product_total_value: 'Total Value',
      product_total_selling: 'Total Selling Value',
      product_created_at: 'Created Date',
      product_updated_at: 'Last Updated',
      
      // Order fields
      order_number: 'Order Number',
      order_date: 'Order Date',
      order_customer: 'Customer Name',
      order_email: 'Customer Email',
      order_status: 'Status',
      order_subtotal: 'Subtotal',
      order_shipping: 'Shipping Cost',
      order_tax: 'Tax Amount',
      order_total: 'Total',
      order_payment_method: 'Payment Method',
      order_source: 'Order Source',
      order_items_count: 'Items Count',
      order_fulfilled_at: 'Fulfillment Date',
      order_fulfilled_by: 'Fulfilled By',
      
      // Client fields
      client_name: 'Client Name',
      client_email: 'Email',
      client_phone: 'Phone',
      client_company: 'Company',
      client_tax_id: 'Tax ID/VAT',
      client_contact_person: 'Contact Person',
      client_contact_role: 'Contact Role',
      client_address: 'Address',
      client_tags: 'Tags',
      client_status: 'Status',
      client_orders: 'Number of Orders',
      client_total_spent: 'Total Spent',
      client_average_order: 'Avg Order Value',
      client_last_order: 'Last Order Date',
      client_created_at: 'Created Date',
      client_source: 'Source'
    };
    
    // Create export data structure
    const exportData: Record<string, any>[] = [];
    
    // Process each data type and add to export rows
    if (needsProducts) {
      productsData.forEach(product => {
        const row: Record<string, any> = {};
        
        selectedFields.forEach(field => {
          if (field.startsWith('product_')) {
            switch (field) {
              case 'product_name':
                row[fieldNameMap[field]] = product.name;
                break;
              case 'product_barcode':
                row[fieldNameMap[field]] = product.barcode || '';
                break;
              case 'product_category':
                row[fieldNameMap[field]] = product.categoryName;
                break;
              case 'product_location':
                row[fieldNameMap[field]] = product.locationName;
                break;
              case 'product_type':
                row[fieldNameMap[field]] = product.typeName;
                break;
              case 'product_provider':
                row[fieldNameMap[field]] = product.providerName;
                break;
              case 'product_quantity':
                row[fieldNameMap[field]] = product.quantity;
                break;
              case 'product_min_quantity':
                row[fieldNameMap[field]] = product.minQuantity;
                break;
              case 'product_cost':
                row[fieldNameMap[field]] = product.cost?.toFixed(2) || 'N/A';
                break;
              case 'product_price':
                row[fieldNameMap[field]] = product.price.toFixed(2);
                break;
              case 'product_vat':
                row[fieldNameMap[field]] = `${product.vatPercentage}%`;
                break;
              case 'product_total_value':
                row[fieldNameMap[field]] = product.totalValue.toFixed(2);
                break;
              case 'product_total_selling':
                row[fieldNameMap[field]] = product.totalSellingValue.toFixed(2);
                break;
              case 'product_created_at':
                row[fieldNameMap[field]] = product.createdAt?.toLocaleDateString() || 'Unknown';
                break;
              case 'product_updated_at':
                row[fieldNameMap[field]] = product.updatedAt?.toLocaleDateString() || 'Unknown';
                break;
            }
          }
        });
        
        if (Object.keys(row).length > 0) {
          exportData.push(row);
        }
      });
    }
    
    if (needsOrders) {
      ordersData.forEach(order => {
        const row: Record<string, any> = {};
        
        selectedFields.forEach(field => {
          if (field.startsWith('order_')) {
            switch (field) {
              case 'order_number':
                row[fieldNameMap[field]] = order.orderNumber;
                break;
              case 'order_date':
                row[fieldNameMap[field]] = order.orderDate.toLocaleDateString();
                break;
              case 'order_customer':
                row[fieldNameMap[field]] = order.customerName;
                break;
              case 'order_email':
                row[fieldNameMap[field]] = order.customerEmail || '';
                break;
              case 'order_status':
                row[fieldNameMap[field]] = order.status;
                break;
              case 'order_subtotal':
                row[fieldNameMap[field]] = order.subtotal.toFixed(2);
                break;
              case 'order_shipping':
                row[fieldNameMap[field]] = order.shippingCost.toFixed(2);
                break;
              case 'order_tax':
                row[fieldNameMap[field]] = order.tax.toFixed(2);
                break;
              case 'order_total':
                row[fieldNameMap[field]] = order.total.toFixed(2);
                break;
              case 'order_payment_method':
                row[fieldNameMap[field]] = order.paymentMethod;
                break;
              case 'order_source':
                row[fieldNameMap[field]] = order.source;
                break;
              case 'order_items_count':
                row[fieldNameMap[field]] = order.items?.length || 0;
                break;
              case 'order_fulfilled_at':
                row[fieldNameMap[field]] = order.fulfilledAt ? order.fulfilledAt.toLocaleDateString() : '';
                break;
              case 'order_fulfilled_by':
                row[fieldNameMap[field]] = order.fulfilledBy || '';
                break;
            }
          }
        });
        
        if (Object.keys(row).length > 0) {
          exportData.push(row);
        }
      });
    }
    
    if (needsClients) {
      clientsData.forEach(client => {
        const row: Record<string, any> = {};
        
        // Format address for display
        const address = client.address ? [
          client.address.address1,
          client.address.address2,
          `${client.address.city}, ${client.address.state} ${client.address.postcode}`,
          client.address.country
        ].filter(Boolean).join(', ') : 'Not provided';
        
        selectedFields.forEach(field => {
          if (field.startsWith('client_')) {
            switch (field) {
              case 'client_name':
                row[fieldNameMap[field]] = client.name;
                break;
              case 'client_email':
                row[fieldNameMap[field]] = client.email || '';
                break;
              case 'client_phone':
                row[fieldNameMap[field]] = client.phone || '';
                break;
              case 'client_company':
                row[fieldNameMap[field]] = client.companyName || '';
                break;
              case 'client_tax_id':
                row[fieldNameMap[field]] = client.taxId || '';
                break;
              case 'client_contact_person':
                row[fieldNameMap[field]] = client.contactPerson || '';
                break;
              case 'client_contact_role':
                row[fieldNameMap[field]] = client.contactRole || '';
                break;
              case 'client_address':
                row[fieldNameMap[field]] = address;
                break;
              case 'client_tags':
                row[fieldNameMap[field]] = client.tags ? client.tags.join(', ') : '';
                break;
              case 'client_status':
                row[fieldNameMap[field]] = client.isActive ? 'Active' : 'Inactive';
                break;
              case 'client_orders':
                row[fieldNameMap[field]] = client.totalOrders || 0;
                break;
              case 'client_total_spent':
                row[fieldNameMap[field]] = (client.totalSpent || 0).toFixed(2);
                break;
              case 'client_average_order':
                row[fieldNameMap[field]] = (client.averageOrderValue || 0).toFixed(2);
                break;
              case 'client_last_order':
                row[fieldNameMap[field]] = client.lastOrderDate ? client.lastOrderDate.toLocaleDateString() : 'Never';
                break;
              case 'client_created_at':
                row[fieldNameMap[field]] = client.createdAt?.toLocaleDateString() || 'Unknown';
                break;
              case 'client_source':
                row[fieldNameMap[field]] = client.source || 'manual';
                break;
            }
          }
        });
        
        if (Object.keys(row).length > 0) {
          exportData.push(row);
        }
      });
    }
    
    // If no data to export
    if (exportData.length === 0) {
      throw new Error('No data to export based on the selected fields and filters');
    }
    
    // Generate export in the requested format
    let content: string | Blob;
    let mimeType: string;
    let fileName: string;
    
    switch(format) {
      case 'csv':
        content = convertToCSV(exportData, includeHeaders);
        mimeType = 'text/csv';
        fileName = generateReportFilename('csv', 'custom-report');
        break;
        
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        fileName = generateReportFilename('json', 'custom-report');
        break;
        
      case 'xlsx':
        // Create Excel workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Custom Report");
        const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        content = new Blob([xlsxData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        fileName = generateReportFilename('xlsx', 'custom-report');
        break;
        
      case 'pdf':
        // Create PDF document
        const doc = new jsPDF();
        doc.text('Custom Report', 14, 16);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
        
        // Get headers from first data row
        const headers = Object.keys(exportData[0]);
        const tableData = exportData.map(row => Object.values(row));
        
        // Add table to PDF
        (doc as any).autoTable({
          startY: 30,
          head: [headers],
          body: tableData,
        });
        
        content = doc.output('blob');
        mimeType = 'application/pdf';
        fileName = generateReportFilename('pdf', 'custom-report');
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    // Generate download
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Log activity
    await logActivity(
      'added',
      'export',
      new Date().getTime().toString(),
      `Custom Report Export`,
      currentUser
    );
    
  } catch (error) {
    console.error('Error exporting custom report:', error);
    throw error;
  }
};

/**
 * Converts a DOM element to an image using HTML2Canvas
 * @param element The DOM element to convert
 * @returns A data URL of the image
 */
export const domToImage = async (element: HTMLElement): Promise<string> => {
  // This would typically use html2canvas, but since it's not imported,
  // we'll return a placeholder for now
  console.warn('html2canvas is not available, returning placeholder image');
  return '';
};

/**
 * Export dashboard data as a PDF report
 * @param dashboardData Data to include in the dashboard
 * @param currentUser The current authenticated user
 */
export const exportDashboardAsPDF = async (
  dashboardData: {
    title: string;
    subtitle: string;
    date: string;
    stats: {
      totalProducts: number;
      totalValue: number;
      lowStockCount: number;
      totalSales: number;
      totalOrders: number;
      totalClients: number;
    };
    chartImages: string[];
  },
  currentUser: User
): Promise<void> => {
  try {
    // Create PDF document
    const doc = new jsPDF();
    
    // Add title and subtitle
    doc.setFontSize(18);
    doc.text(dashboardData.title, 14, 20);
    
    doc.setFontSize(12);
    doc.text(dashboardData.subtitle, 14, 28);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${dashboardData.date}`, 14, 34);
    
    // Add stats
    let yPos = 45;
    
    doc.setFontSize(14);
    doc.text('Summary Statistics', 14, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.text(`Total Products: ${dashboardData.stats.totalProducts}`, 20, yPos); yPos += 6;
    doc.text(`Inventory Value: ${dashboardData.stats.totalValue.toLocaleString()} RON`, 20, yPos); yPos += 6;
    doc.text(`Low Stock Items: ${dashboardData.stats.lowStockCount}`, 20, yPos); yPos += 6;
    doc.text(`Total Sales: ${dashboardData.stats.totalSales.toLocaleString()} RON`, 20, yPos); yPos += 6;
    doc.text(`Total Orders: ${dashboardData.stats.totalOrders}`, 20, yPos); yPos += 6;
    doc.text(`Total Clients: ${dashboardData.stats.totalClients}`, 20, yPos); yPos += 12;
    
    // Add charts if available
    if (dashboardData.chartImages.length > 0) {
      doc.setFontSize(14);
      doc.text('Charts & Visualizations', 14, yPos);
      yPos += 8;
      
      // Add each chart image
      for (const chartImage of dashboardData.chartImages) {
        if (chartImage && chartImage !== '') {
          // Skip empty images
          doc.addImage(chartImage, 'PNG', 14, yPos, 180, 80);
          yPos += 90;
          
          // Add new page if needed
          if (yPos > 250) {
            doc.addPage();
            yPos = 20;
          }
        }
      }
    }
    
    // Save the PDF
    const fileName = `dashboard-report-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    // Log activity
    await logActivity(
      'added',
      'export',
      new Date().getTime().toString(),
      `Dashboard Export (PDF)`,
      currentUser
    );
    
  } catch (error) {
    console.error('Error exporting dashboard as PDF:', error);
    throw error;
  }
};