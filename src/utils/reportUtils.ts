import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order } from '../types';

/**
 * Generates a filename for the exported report
 * @param format The file format extension
 * @returns A string with the filename
 */
export const generateReportFilename = (format: string): string => {
  const date = new Date();
  const formattedDate = date.toISOString().split('T')[0];
  return `sales-report-${formattedDate}.${format}`;
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
 * Exports order data based on provided filters
 * @param format Export format (csv, xlsx, pdf, json)
 * @param includeHeaders Whether to include column headers in exports
 * @param filters Object containing filters to apply to the query
 * @param currentUser The current authenticated user
 * @returns Promise that resolves when export is complete
 */
export const exportOrders = async (
  format: 'csv' | 'xlsx' | 'pdf' | 'json',
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
  currentUser: any
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
        customerEmail: order.customerEmail,
        status: order.status,
        paymentMethod: order.paymentMethod,
        source: order.source,
        itemCount: order.items.length,
        total: order.total.toFixed(2),
        notes: order.notes || ''
      };
    });
    
    let content: string | Blob;
    let mimeType: string;
    
    // Generate the content based on the requested format
    switch(format) {
      case 'csv':
        content = convertToCSV(exportData, includeHeaders);
        mimeType = 'text/csv';
        break;
        
      case 'json':
        content = JSON.stringify(exportData, null, 2);
        mimeType = 'application/json';
        break;
        
      case 'xlsx':
        // For simplicity, we're using CSV format and changing the extension
        // In a real app, you would use a library like xlsx to generate actual Excel files
        content = convertToCSV(exportData, includeHeaders);
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
        
      case 'pdf':
        // For simplicity, just convert to CSV for now
        // In a real app, you would use a library like jsPDF to generate PDF files
        content = convertToCSV(exportData, includeHeaders);
        mimeType = 'application/pdf';
        break;
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    // Generate a download link
    const filename = generateReportFilename(format);
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    // Create a temporary link element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error exporting orders:', error);
    throw error;
  }
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