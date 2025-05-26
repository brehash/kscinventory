import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Product } from '../types';

/**
 * Initializes the WooCommerce API client with credentials from Firebase.
 *
 * @returns A WooCommerceRestApi instance configured with the stored credentials.
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
    
    const wooCommerceConfig = {
      url,
      consumerKey,
      consumerSecret,
      version: 'wc/v3'
    };
    
    return new WooCommerceRestApi(wooCommerceConfig);
  } catch (error) {
    console.error("Error initializing WooCommerce API:", error);
    return null;
  }
};

/**
 * Update product stock quantity in WooCommerce.
 *
 * @param product The product to update.
 * @param quantity The new quantity value.
 * @returns Object with success status and optional error message.
 */
export const updateWooCommerceProductStock = async (
  product: Product,
  quantity: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if the product has a WooCommerce ID.
    if (!product.wooCommerceId) {
      return { 
        success: false, 
        error: 'Product does not have a WooCommerce ID' 
      };
    }
    
    // Initialize WooCommerce API
    const api = await initWooCommerceAPI();
    if (!api) {
      return { 
        success: false, 
        error: 'Failed to initialize WooCommerce API. Please check your settings.' 
      };
    }
    
    // Update product stock quantity in WooCommerce.
    const response = await api.put(`products/${product.wooCommerceId}`, {
      stock_quantity: quantity,
      manage_stock: true
    });
    
    if (response && response.status === 200) {
      return { success: true };
    }
    
    return {
      success: false,
      error: 'Unexpected response from WooCommerce API'
    };
  } catch (error) {
    console.error('Error updating WooCommerce product stock:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Find a WooCommerce product by SKU and return its ID.
 *
 * @param sku The product SKU (barcode) to search for.
 * @returns The WooCommerce product ID if found, null otherwise.
 */
export const findWooCommerceProductBySKU = async (
  sku: string
): Promise<number | null> => {
  if (!sku) return null;
  
  try {
    // Initialize WooCommerce API
    const api = await initWooCommerceAPI();
    if (!api) {
      console.error('Failed to initialize WooCommerce API');
      return null;
    }
    
    // Search for product by SKU
    const response = await api.get('products', {
      sku: sku
    });
    
    if (response && response.data && response.data.length > 0) {
      return response.data[0].id;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding WooCommerce product by SKU:', error);
    return null;
  }
};