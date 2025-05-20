import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product, ActivityLog, User } from '../types';
import { logActivity } from './activityLogger';

/**
 * Converts a Date to a string in the format expected by SAGA (dd.mm.yyyy)
 * @param date The Date to format
 * @returns A string in the format dd.mm.yyyy
 */
const formatDateForSaga = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

/**
 * Fetches all products from the database
 * @returns An array of products
 */
const fetchAllProducts = async (): Promise<Product[]> => {
  try {
    const productsRef = collection(db, 'products');
    const querySnapshot = await getDocs(productsRef);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Product));
  } catch (error) {
    console.error('Error fetching products:', error);
    throw new Error('Failed to fetch products from the database');
  }
};

/**
 * Fetches product activity logs for the specified date range
 * @param startDate The start date of the range (ISO string)
 * @param endDate The end date of the range (ISO string)
 * @returns An array of activity logs
 */
const fetchProductActivities = async (startDate: string, endDate: string): Promise<ActivityLog[]> => {
  try {
    // Convert ISO date strings to Date objects
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0); // Start of day
    
    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999); // End of day
    
    const activitiesRef = collection(db, 'activities');
    const q = query(
      activitiesRef,
      where('entityType', '==', 'product'),
      where('date', '>=', startDateObj),
      where('date', '<=', endDateObj),
      orderBy('date', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate() || new Date()
    } as ActivityLog));
  } catch (error) {
    console.error('Error fetching product activities:', error);
    throw new Error('Failed to fetch product activities from the database');
  }
};

/**
 * Generates a SAGA-compatible CSV export for inventory
 * @param startDate The start date of the period (ISO string)
 * @param endDate The end date of the period (ISO string)
 * @param currentUser The current user initiating the export
 * @returns The export data as a string
 */
export const generateSagaExport = async (
  startDate: string,
  endDate: string,
  currentUser: User
): Promise<{ data: string; count: number }> => {
  try {
    // Fetch all products
    const products = await fetchAllProducts();
    
    // Fetch all product activity logs for the period
    const activities = await fetchProductActivities(startDate, endDate);
    
    // Create a map to quickly look up products by ID
    const productMap = new Map<string, Product>();
    products.forEach(product => productMap.set(product.id, product));
    
    // Calculate product quantities at the start and end of the period
    const productMovements = new Map<string, {
      productId: string;
      productName: string;
      costPrice: number;
      sellingPrice: number;
      initialQuantity: number;
      finalQuantity: number;
    }>();
    
    // Initialize product movements with current quantities (final quantities)
    products.forEach(product => {
      productMovements.set(product.id, {
        productId: product.id,
        productName: product.name,
        costPrice: product.cost || 0,
        sellingPrice: product.price,
        initialQuantity: product.quantity, // Will be adjusted based on activities
        finalQuantity: product.quantity
      });
    });
    
    // Process activities to calculate initial quantities
    activities.forEach(activity => {
      const movement = productMovements.get(activity.entityId);
      if (!movement) return;
      
      // Adjust initial quantity based on the activity
      if (activity.type === 'added' && activity.quantity) {
        movement.initialQuantity -= activity.quantity;
      } else if (activity.type === 'removed' && activity.quantity) {
        movement.initialQuantity += activity.quantity;
      }
      // 'updated' activities with a quantity don't affect the calculation as they're absolute values, not deltas
    });
    
    // Convert to SAGA CSV format
    let csvData = '';
    
    // Add CSV headers
    csvData += 'Cod;Denumire;UM;Categorie;Cantitate initiala;Valoare initiala;Cantitate finala;Valoare finala\r\n';
    
    // Add product rows
    let productCount = 0;
    productMovements.forEach(movement => {
      if (movement.initialQuantity < 0) {
        // SAGA can't handle negative initial quantities, so adjust for this case
        console.warn(`Product ${movement.productName} has negative initial quantity (${movement.initialQuantity}). Setting to 0.`);
        movement.initialQuantity = 0;
      }
      
      const initialValue = movement.initialQuantity * movement.costPrice;
      const finalValue = movement.finalQuantity * movement.costPrice;
      
      // Skip products with no movement if initial and final quantities are 0
      if (movement.initialQuantity === 0 && movement.finalQuantity === 0) {
        return;
      }
      
      // Format for SAGA - fields are separated by semicolons
      csvData += `${movement.productId.substring(0, 10)};`; // Cod - limit to 10 characters
      csvData += `${movement.productName};`; // Denumire
      csvData += 'BUC;'; // UM (unit of measure) - "BUC" is standard for pieces in Romania
      csvData += 'MARFA;'; // Categorie - "MARFA" is standard for goods in SAGA
      csvData += `${movement.initialQuantity.toFixed(2).replace('.', ',')};`; // Cantitate initiala
      csvData += `${initialValue.toFixed(2).replace('.', ',')};`; // Valoare initiala
      csvData += `${movement.finalQuantity.toFixed(2).replace('.', ',')};`; // Cantitate finala
      csvData += `${finalValue.toFixed(2).replace('.', ',')}\r\n`; // Valoare finala
      
      productCount++;
    });
    
    // If no products, add a message in the CSV
    if (productCount === 0) {
      csvData += 'Nu exista produse pentru exportat in perioada selectata.;;;;;;\r\n';
    }
    
    // Log the activity
    await logActivity(
      'added',
      'export', // New entity type
      Date.now().toString(), // Using timestamp as ID
      `SAGA Export ${startDate} to ${endDate}`,
      currentUser
    );
    
    return { data: csvData, count: productCount };
  } catch (error) {
    console.error('Error generating SAGA export:', error);
    throw error;
  }
};