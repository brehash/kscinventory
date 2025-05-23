import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { Product } from '../types';

// Initialize WooCommerce API with stored credentials
const initWooCommerceAPI = () => {
  // Get settings from localStorage
  const url = localStorage.getItem('wc_url') || '';
  const consumerKey = localStorage.getItem('wc_consumer_key') || '';
  const consumerSecret = localStorage.getItem('wc_consumer_secret') || '';
  
  return new WooCommerceRestApi({
    url,
    consumerKey,
    consumerSecret,
    version: 'wc/v3'
  });
};

/**
 * Update product stock quantity in WooCommerce
 * 
 * @param product The product to update
 * @param quantity The new quantity value
 * @returns Object with success status and optional error message
 */
export const updateWooCommerceProductStock = async (
  product: Product,
  quantity: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if the product has a WooCommerce ID
    if (!product.wooCommerceId) {
      return { 
        success: false, 
        error: 'Product does not have a WooCommerce ID' 
      };
    }
    
    // Check if WooCommerce credentials are set
    if (!localStorage.getItem('wc_url') || 
        !localStorage.getItem('wc_consumer_key') || 
        !localStorage.getItem('wc_consumer_secret')) {
      return { 
        success: false, 
        error: 'WooCommerce credentials not found. Please configure them in Settings > WooCommerce.' 
      };
    }
    
    // Initialize WooCommerce API
    const api = initWooCommerceAPI();
    
    // Update product stock quantity in WooCommerce
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
 * Find a WooCommerce product by SKU and return its ID
 * 
 * @param sku The product SKU (barcode) to search for
 * @returns The WooCommerce product ID if found, null otherwise
 */
export const findWooCommerceProductBySKU = async (
  sku: string
): Promise<number | null> => {
  if (!sku) return null;
  
  try {
    // Check if WooCommerce credentials are set
    if (!localStorage.getItem('wc_url') || 
        !localStorage.getItem('wc_consumer_key') || 
        !localStorage.getItem('wc_consumer_secret')) {
      console.error('WooCommerce credentials not found');
      return null;
    }
    
    // Initialize WooCommerce API
    const api = initWooCommerceAPI();
    
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