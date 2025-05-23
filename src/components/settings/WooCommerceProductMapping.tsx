import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product } from '../../types';
import { Search, Link as LinkIcon, Unlink, Loader2, AlertTriangle, CheckCircle, Upload } from 'lucide-react';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { findWooCommerceProductBySKU, updateWooCommerceProductStock } from '../../utils/wooCommerceProductSync';

// WooCommerce Product type for mapping
interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  permalink: string;
  stock_quantity?: number;
}

const WooCommerceProductMapping: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [wooCommerceProducts, setWooCommerceProducts] = useState<WooCommerceProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [wcLoading, setWcLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnmapped, setFilterUnmapped] = useState(false);
  
  // Mapping state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedWcProduct, setSelectedWcProduct] = useState<WooCommerceProduct | null>(null);
  const [isMappingInProgress, setIsMappingInProgress] = useState(false);
  const [isSyncingStock, setIsSyncingStock] = useState(false);
  const [mappingSuccess, setMappingSuccess] = useState<string | null>(null);
  
  // Initialize WooCommerce API
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
  
  // Fetch products from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const productsRef = collection(db, 'products');
        const querySnapshot = await getDocs(productsRef);
        
        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        
        setProducts(productsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching products:', err);
        setError('Failed to load products');
        setLoading(false);
      }
    };
    
    fetchProducts();
  }, []);
  
  // Fetch WooCommerce products
  useEffect(() => {
    const fetchWooCommerceProducts = async () => {
      try {
        setWcLoading(true);
        
        // Check if WooCommerce credentials are set
        if (!localStorage.getItem('wc_url') || 
            !localStorage.getItem('wc_consumer_key') || 
            !localStorage.getItem('wc_consumer_secret')) {
          setError('WooCommerce credentials not found. Please configure them first.');
          setWcLoading(false);
          return;
        }
        
        // Initialize WooCommerce API
        const api = initWooCommerceAPI();
        
        // Fetch products from WooCommerce
        const response = await api.get('products', {
          per_page: 100, // Adjust as needed
        });
        
        if (response && response.data) {
          setWooCommerceProducts(response.data);
        } else {
          setError('Failed to fetch WooCommerce products');
        }
        
        setWcLoading(false);
      } catch (err) {
        console.error('Error fetching WooCommerce products:', err);
        setError('Failed to load WooCommerce products');
        setWcLoading(false);
      }
    };
    
    fetchWooCommerceProducts();
  }, []);
  
  // Filter products based on search query and unmapped filter
  const filteredProducts = products.filter(product => {
    const matchesSearch = 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.barcode?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    if (filterUnmapped) {
      return matchesSearch && !product.wooCommerceId;
    }
    
    return matchesSearch;
  });
  
  // Handle mapping a product to a WooCommerce product
  const handleMapProduct = async () => {
    if (!selectedProduct || !selectedWcProduct) return;
    
    try {
      setIsMappingInProgress(true);
      setMappingSuccess(null);
      
      // Update product in Firestore with WooCommerce ID
      const productRef = doc(db, 'products', selectedProduct.id);
      await updateDoc(productRef, {
        wooCommerceId: selectedWcProduct.id,
        updatedAt: new Date()
      });
      
      // Update the product in local state
      const updatedProducts = products.map(product => 
        product.id === selectedProduct.id 
          ? { ...product, wooCommerceId: selectedWcProduct.id } 
          : product
      );
      setProducts(updatedProducts);
      
      // Sync stock quantity to WooCommerce
      const syncResult = await updateWooCommerceProductStock(
        { ...selectedProduct, wooCommerceId: selectedWcProduct.id },
        selectedProduct.quantity
      );
      
      // Show success message
      setMappingSuccess(
        syncResult.success
          ? `Successfully mapped ${selectedProduct.name} to ${selectedWcProduct.name} and synced stock`
          : `Mapped ${selectedProduct.name} to ${selectedWcProduct.name} but stock sync failed: ${syncResult.error}`
      );
      
      // Reset selection
      setSelectedProduct(null);
      setSelectedWcProduct(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMappingSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error mapping product:', err);
      setError('Failed to map product to WooCommerce');
    } finally {
      setIsMappingInProgress(false);
    }
  };
  
  // Handle removing a mapping
  const handleUnmapProduct = async (product: Product) => {
    try {
      setIsMappingInProgress(true);
      
      // Update product in Firestore to remove WooCommerce ID
      const productRef = doc(db, 'products', product.id);
      await updateDoc(productRef, {
        wooCommerceId: null,
        updatedAt: new Date()
      });
      
      // Update the product in local state
      const updatedProducts = products.map(p => 
        p.id === product.id 
          ? { ...p, wooCommerceId: undefined } 
          : p
      );
      setProducts(updatedProducts);
      
      // Show success message
      setMappingSuccess(`Successfully unmapped ${product.name}`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setMappingSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error unmapping product:', err);
      setError('Failed to remove WooCommerce mapping');
    } finally {
      setIsMappingInProgress(false);
    }
  };

  // Handle syncing product stock to WooCommerce
  const handleSyncStock = async (product: Product) => {
    if (!product.wooCommerceId) return;
    
    try {
      setIsSyncingStock(true);
      setMappingSuccess(null);
      
      // Sync stock quantity to WooCommerce
      const result = await updateWooCommerceProductStock(product, product.quantity);
      
      if (result.success) {
        setMappingSuccess(`Successfully synced ${product.name} stock to WooCommerce (${product.quantity} units)`);
      } else {
        setError(`Failed to sync stock: ${result.error}`);
      }
      
      // Clear messages after 3 seconds
      setTimeout(() => {
        setMappingSuccess(null);
        setError(null);
      }, 3000);
    } catch (err) {
      console.error('Error syncing stock:', err);
      setError('Failed to sync stock to WooCommerce');
    } finally {
      setIsSyncingStock(false);
    }
  };
  
  // Handle automatic mapping of all products by SKU
  const handleBulkMapBySKU = async () => {
    try {
      setIsMappingInProgress(true);
      setMappingSuccess(null);
      
      let mappedCount = 0;
      let failedCount = 0;
      
      // Get unmapped products with a barcode
      const productsToMap = products.filter(
        product => !product.wooCommerceId && product.barcode
      );
      
      if (productsToMap.length === 0) {
        setMappingSuccess('No products to map. All products with barcodes are already mapped.');
        setIsMappingInProgress(false);
        return;
      }
      
      // Process each product
      for (const product of productsToMap) {
        if (!product.barcode) continue;
        
        // Find matching WooCommerce product by SKU
        const wooCommerceId = await findWooCommerceProductBySKU(product.barcode);
        
        if (wooCommerceId) {
          // Update product in Firestore
          const productRef = doc(db, 'products', product.id);
          await updateDoc(productRef, {
            wooCommerceId,
            updatedAt: new Date()
          });
          
          // Sync stock quantity
          await updateWooCommerceProductStock(
            { ...product, wooCommerceId },
            product.quantity
          );
          
          mappedCount++;
        } else {
          failedCount++;
        }
      }
      
      // Update products in local state
      const updatedProducts = await getDocs(collection(db, 'products'));
      setProducts(
        updatedProducts.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[]
      );
      
      // Show success message
      setMappingSuccess(
        `Auto-mapping complete: ${mappedCount} products mapped, ${failedCount} not found in WooCommerce.`
      );
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setMappingSuccess(null);
      }, 5000);
    } catch (err) {
      console.error('Error in bulk mapping:', err);
      setError('Failed to complete auto-mapping by SKU');
    } finally {
      setIsMappingInProgress(false);
    }
  };
  
  // Find the WooCommerce product name for a mapped product
  const getWooCommerceProductName = (wooCommerceId: number | undefined) => {
    if (!wooCommerceId) return 'Not mapped';
    const wcProduct = wooCommerceProducts.find(p => p.id === wooCommerceId);
    return wcProduct ? wcProduct.name : `WC ID: ${wooCommerceId}`;
  };
  
  if (loading || wcLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mr-2" />
        <span className="text-gray-600">
          {loading ? 'Loading products...' : 'Loading WooCommerce products...'}
        </span>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {mappingSuccess && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-sm text-green-700">{mappingSuccess}</p>
          </div>
        </div>
      )}
      
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center">
            <input
              id="filterUnmapped"
              type="checkbox"
              checked={filterUnmapped}
              onChange={(e) => setFilterUnmapped(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor="filterUnmapped" className="ml-2 block text-sm text-gray-700">
              Show only unmapped products
            </label>
          </div>
          
          <button
            onClick={handleBulkMapBySKU}
            disabled={isMappingInProgress}
            className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isMappingInProgress ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Auto-Map by SKU
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Mapping UI */}
      {selectedProduct && (
        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200 mb-4">
          <h3 className="text-sm font-medium text-indigo-800 mb-2">Map Product to WooCommerce</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Selected inventory product */}
            <div className="bg-white p-3 rounded-md border border-indigo-100">
              <h4 className="text-sm font-medium mb-1">Selected Inventory Product:</h4>
              <p className="text-sm text-gray-800">{selectedProduct.name}</p>
              {selectedProduct.barcode && (
                <p className="text-xs text-gray-500 mt-1">Barcode: {selectedProduct.barcode}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Quantity: {selectedProduct.quantity}</p>
            </div>
            
            {/* WooCommerce product selector */}
            <div className="bg-white p-3 rounded-md border border-indigo-100">
              <h4 className="text-sm font-medium mb-1">Select WooCommerce Product:</h4>
              <select
                value={selectedWcProduct?.id || ''}
                onChange={(e) => {
                  const wcProductId = parseInt(e.target.value);
                  const wcProduct = wooCommerceProducts.find(p => p.id === wcProductId) || null;
                  setSelectedWcProduct(wcProduct);
                }}
                className="block w-full border border-gray-300 rounded-md py-2 pl-3 pr-10 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- Select a WooCommerce product --</option>
                {wooCommerceProducts.map((wcProduct) => (
                  <option key={wcProduct.id} value={wcProduct.id}>
                    {wcProduct.name} {wcProduct.sku ? `(SKU: ${wcProduct.sku})` : ''}
                  </option>
                ))}
              </select>
              
              {selectedWcProduct && (
                <div className="mt-2 text-xs">
                  <p className="text-gray-800">
                    <strong>Name:</strong> {selectedWcProduct.name}
                  </p>
                  {selectedWcProduct.sku && (
                    <p className="text-gray-800">
                      <strong>SKU:</strong> {selectedWcProduct.sku}
                    </p>
                  )}
                  <p className="text-gray-800">
                    <strong>Current Stock:</strong> {selectedWcProduct.stock_quantity !== undefined ? selectedWcProduct.stock_quantity : 'Not managed'}
                  </p>
                  <a 
                    href={selectedWcProduct.permalink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 inline-flex items-center mt-1"
                  >
                    <LinkIcon className="h-3 w-3 mr-1" /> View on store
                  </a>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end mt-4 space-x-3">
            <button
              onClick={() => setSelectedProduct(null)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleMapProduct}
              disabled={!selectedWcProduct || isMappingInProgress}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isMappingInProgress ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Mapping...
                </>
              ) : (
                <>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Map Product
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* Products table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Product Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Barcode/SKU
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Stock
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                WooCommerce Mapping
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{product.barcode || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{product.quantity}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.wooCommerceId ? (
                      <div className="flex items-center">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          {getWooCommerceProductName(product.wooCommerceId)}
                        </span>
                      </div>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                        Not mapped
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      {product.wooCommerceId && (
                        <button
                          onClick={() => handleSyncStock(product)}
                          disabled={isSyncingStock}
                          className="text-blue-600 hover:text-blue-900"
                          title="Sync stock to WooCommerce"
                        >
                          <Upload className="h-5 w-5" />
                        </button>
                      )}
                    
                      {product.wooCommerceId ? (
                        <button
                          onClick={() => handleUnmapProduct(product)}
                          disabled={isMappingInProgress}
                          className="text-red-600 hover:text-red-900"
                          title="Remove mapping"
                        >
                          <Unlink className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Map to WooCommerce product"
                        >
                          <LinkIcon className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchQuery 
                    ? 'No products found matching your search criteria.' 
                    : filterUnmapped 
                      ? 'All products are already mapped to WooCommerce.' 
                      : 'No products found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WooCommerceProductMapping;