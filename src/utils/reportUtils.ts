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
 * @param reportType The specific report type
 * @returns A filename with the current date
 */
const generateFilename = (dataType: string, format: ExportFormat, reportType?: string): string => {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  let filename = `${dataType}_export_${dateStr}`;
  if (reportType) {
    filename += `_${reportType}`;
  }
  return `${filename}.${format}`;
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
 * @param reportType The specific type of report to generate
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
  currentUser: User,
  reportType: string = 'all'  // Added reportType parameter
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
      // Base product fields for all report types
      const baseProduct: any = {
        id: doc.id,
        name: data.name,
        barcode: data.barcode || '',
        category: categories.get(data.categoryId) || 'Unknown',
        location: locations.get(data.locationId) || 'Unknown',
        type: productTypes.get(data.typeId) || 'Unknown',
        provider: data.providerId ? (providers.get(data.providerId) || 'Unknown') : '',
        quantity: data.quantity,
        min_quantity: data.minQuantity,
      };
      
      // Add specific fields based on the report type
      switch (reportType) {
        case 'stock-value':
          // Stock value report - focus on cost values
          return {
            ...baseProduct,
            cost_price: data.cost || 0,
            total_cost_value: (data.quantity * (data.cost || 0)).toFixed(2),
            price: data.price,
            total_selling_value: (data.quantity * data.price).toFixed(2),
            profit_margin: data.cost ? ((data.price - data.cost) / data.cost * 100).toFixed(2) + '%' : 'N/A'
          };
        
        case 'low-stock':
          // Low stock report - focus on inventory levels
          return {
            ...baseProduct,
            stock_status: data.quantity <= data.minQuantity ? 'LOW' : 'OK',
            shortage: data.quantity <= data.minQuantity ? (data.minQuantity - data.quantity) : 0,
            last_updated: data.updatedAt?.toDate().toISOString() || ''
          };
        
        case 'valuation':
          // Valuation report - comprehensive pricing information
          return {
            ...baseProduct,
            cost: data.cost || 0,
            last_cost: data.lastCost || 0,
            cost_change: data.lastCost && data.cost ? 
              ((data.cost - data.lastCost) / data.lastCost * 100).toFixed(2) + '%' : 'N/A',
            selling_price: data.price,
            vat_percentage: data.vatPercentage + '%',
            total_cost_value: (data.quantity * (data.cost || 0)).toFixed(2),
            total_selling_value: (data.quantity * data.price).toFixed(2),
            profit_per_unit: data.cost ? (data.price - data.cost).toFixed(2) : 'N/A'
          };
        
        case 'stock-movement':
          // Stock movement report - focus on stock level changes
          // This would ideally include historical data but we'll use current values
          return {
            ...baseProduct,
            current_stock: data.quantity,
            current_value: (data.quantity * (data.cost || 0)).toFixed(2),
            min_stock_threshold: data.minQuantity,
            reorder_status: data.quantity <= data.minQuantity ? 'REORDER' : 'OK'
          };
        
        default:
          // Default report - all product details
          return {
            ...baseProduct,
            category_id: data.categoryId,
            type_id: data.typeId,
            location_id: data.locationId,
            provider_id: data.providerId || '',
            price: data.price,
            cost: data.cost || 0,
            vat_percentage: data.vatPercentage,
            total_value: (data.quantity * (data.cost || 0)).toFixed(2),
            retail_value: (data.quantity * data.price).toFixed(2),
            created_at: data.createdAt?.toDate().toISOString() || '',
            updated_at: data.updatedAt?.toDate().toISOString() || ''
          };
      }
    });
    
    // Apply additional client-side filters
    if (filters.minQuantity !== undefined) {
      products = products.filter(product => product.quantity >= filters.minQuantity!);
    }
    
    if (filters.maxQuantity !== undefined) {
      products = products.filter(product => product.quantity <= filters.maxQuantity!);
    }
    
    // Apply additional filters specific to report type
    if (reportType === 'low-stock') {
      products = products.filter(product => product.quantity <= product.min_quantity);
    }
    
    // Sort data based on report type
    if (reportType === 'stock-value') {
      products.sort((a, b) => {
        const aValue = parseFloat(a.total_cost_value);
        const bValue = parseFloat(b.total_cost_value);
        return bValue - aValue; // Sort by descending value
      });
    } else if (reportType === 'low-stock') {
      products.sort((a, b) => {
        // Sort first by status (LOW before OK)
        if (a.stock_status === 'LOW' && b.stock_status !== 'LOW') return -1;
        if (a.stock_status !== 'LOW' && b.stock_status === 'LOW') return 1;
        
        // Then by shortage amount (descending)
        return b.shortage - a.shortage;
      });
    }
    
    // Log the export activity
    await logActivity(
      'added',
      'export', 
      Date.now().toString(), // Using timestamp as ID
      `Products Export (${format.toUpperCase()}) - ${reportType}`,
      currentUser
    );
    
    // Generate filename with report type
    const filename = generateFilename('products', format, reportType);
    
    // Export the data
    exportDataAsFile(products, format, filename, includeHeaders);
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error exporting products:', error);
    return Promise.reject(error);
  }
};

// Rest of the file remains the same...
