import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, OrderItem, UnidentifiedItem } from '../types';

/**
 * Flags orders that contain a newly created product (identified by barcode or name)
 * and updates them by moving the item from unidentifiedItems to regular items
 * 
 * @param productId - The ID of the newly created product
 * @param productName - The name of the product
 * @param productBarcode - The barcode of the product (optional)
 * @param productPrice - The price of the product
 * @returns An object containing the number of orders updated and any error message
 */
export const flagOrdersWithProduct = async (
  productId: string,
  productName: string,
  productBarcode?: string,
  productPrice?: number
): Promise<{ updatedCount: number; error?: string }> => {
  try {
    if (!productId || !productName) {
      return { updatedCount: 0, error: 'Product ID and name are required' };
    }
    
    const ordersRef = collection(db, 'orders');
    const ordersWithUnidentifiedItems = query(
      ordersRef,
      where('hasUnidentifiedItems', '==', true)
    );
    
    const querySnapshot = await getDocs(ordersWithUnidentifiedItems);
    
    let updatedCount = 0;
    
    // Process each order with unidentified items
    for (const orderDoc of querySnapshot.docs) {
      const orderData = orderDoc.data() as Order;
      const orderWithId = { ...orderData, id: orderDoc.id };
      
      // Skip if no unidentified items
      if (!orderWithId.unidentifiedItems || orderWithId.unidentifiedItems.length === 0) {
        continue;
      }
      
      let orderUpdated = false;
      const remainingUnidentifiedItems: UnidentifiedItem[] = [];
      let newOrderItems = [...orderWithId.items];
      
      // Process each unidentified item
      for (const unidentifiedItem of orderWithId.unidentifiedItems) {
        const isBarcodeMatch = productBarcode && 
          unidentifiedItem.sku && 
          unidentifiedItem.sku.toLowerCase() === productBarcode.toLowerCase();
          
        const isNameMatch = unidentifiedItem.name.toLowerCase() === productName.toLowerCase();
        
        // If either barcode or name matches, convert to a regular order item
        if (isBarcodeMatch || isNameMatch) {
          // Create new order item from the unidentified item
          const newItem: OrderItem = {
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`, // Generate a unique ID
            productId,
            productName,
            quantity: unidentifiedItem.quantity,
            price: productPrice !== undefined ? productPrice : unidentifiedItem.price,
            total: productPrice !== undefined 
              ? productPrice * unidentifiedItem.quantity 
              : unidentifiedItem.price * unidentifiedItem.quantity
          };
          
          // Add the new item to the order's items
          newOrderItems.push(newItem);
          orderUpdated = true;
        } else {
          // Keep this item in the unidentified items list
          remainingUnidentifiedItems.push(unidentifiedItem);
        }
      }
      
      // Update the order if any items were moved from unidentified to identified
      if (orderUpdated) {
        const hasRemainingUnidentifiedItems = remainingUnidentifiedItems.length > 0;
        
        await updateDoc(doc(db, 'orders', orderDoc.id), {
          items: newOrderItems,
          unidentifiedItems: remainingUnidentifiedItems,
          hasUnidentifiedItems: hasRemainingUnidentifiedItems,
          updatedAt: new Date()
        });
        
        updatedCount++;
      }
    }
    
    return { updatedCount };
  } catch (error) {
    console.error('Error flagging orders with product:', error);
    return { 
      updatedCount: 0, 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    };
  }
};