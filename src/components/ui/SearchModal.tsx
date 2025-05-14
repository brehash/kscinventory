import React, { useState, useEffect, useRef, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  X, 
  Package, 
  MapPin, 
  Tag, 
  BoxesIcon, 
  Loader2, 
  AlertCircle,
  Plus,
  Minus,
  RotateCcw,
  ArrowRight,
  Truck,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc,
  addDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { 
  Product, 
  ProductCategory, 
  ProductType, 
  Location
} from '../../types';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SearchResult = {
  id: string;
  name: string;
  type: 'product' | 'category' | 'location' | 'productType';
  barcode?: string;
  description?: string;
  quantity?: number;
  minQuantity?: number;
};

// Define mode type
type ModalMode = 'inventory' | 'shipping' | 'receiving';

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isBarcodeMatch, setIsBarcodeMatch] = useState(false);
  const [productToUpdate, setProductToUpdate] = useState<Product | null>(null);
  const [newQuantity, setNewQuantity] = useState(0);
  const [adjustmentAmount, setAdjustmentAmount] = useState(1); // Default adjustment amount
  const [isUpdating, setIsUpdating] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  
  // Mode selection state
  const [mode, setMode] = useState<ModalMode>('inventory');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  
  // Product not found state
  const [isProductNotFound, setIsProductNotFound] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  
  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Keep the search input focused in shipping mode
  useEffect(() => {
    if (isOpen && mode === 'shipping' && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, mode, statusMessage]);
  
  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);
  
  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setError(null);
      setActiveIndex(-1);
      setIsBarcodeMatch(false);
      setProductToUpdate(null);
      setShowProductModal(false);
      setStatusMessage(null);
      setMode('inventory'); // Reset to default mode
      setIsProductNotFound(false);
      setScannedBarcode('');
    }
  }, [isOpen]);
  
  // Handle key navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0 && activeIndex < searchResults.length) {
          handleResultClick(searchResults[activeIndex]);
        } else if (isBarcodeMatch && productToUpdate) {
          // Navigate to product details if it's a barcode match in inventory mode
          if (mode === 'inventory') {
            navigate(`/products/${productToUpdate.id}`);
            onClose();
          } else {
            // In shipping/receiving mode, perform the quantity update
            updateProductQuantity();
          }
        }
        
      }

      console.log(searchQuery)
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex, searchResults, navigate, onClose, isBarcodeMatch, productToUpdate, mode]);
  
  // Search function
  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsProductNotFound(false);
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setIsBarcodeMatch(false);
    setProductToUpdate(null);
    setShowProductModal(false);
    setStatusMessage(null);
    setIsProductNotFound(false);
    
    try {
      const results: SearchResult[] = [];
      const lowerQuery = searchQuery.toLowerCase();
      
      // Check for barcode match first
      const productsRef = collection(db, 'products');
      const barcodeQuery = query(productsRef, where('barcode', '==', searchQuery));
      const barcodeSnapshot = await getDocs(barcodeQuery);
      
      if (!barcodeSnapshot.empty) {
        const productData = barcodeSnapshot.docs[0].data() as Product;
        const product = { 
          id: barcodeSnapshot.docs[0].id, 
          ...productData 
        } as Product;
        
        setProductToUpdate(product);
        
        // Set new quantity based on the mode
        if (mode === 'shipping') {
          // For shipping, default to removing 1 unit
          setNewQuantity(Math.max(0, product.quantity - adjustmentAmount));
          // Auto-decrease in shipping mode
          await updateProductQuantity(product, Math.max(0, product.quantity - adjustmentAmount));
          return; // Stop further processing
        } else if (mode === 'receiving') {
          // For receiving, default to adding 1 unit
          setNewQuantity(product.quantity + adjustmentAmount);
        } else {
          // For inventory mode, just show the current quantity
          setNewQuantity(product.quantity);
        }
        
        setIsBarcodeMatch(true);
        setShowProductModal(true);
        
        // Add to results
        results.push({
          id: product.id,
          name: product.name,
          type: 'product',
          barcode: product.barcode,
          description: product.description,
          quantity: product.quantity,
          minQuantity: product.minQuantity
        });
      } else {
        // Check if this looks like a barcode scan (could be numeric only, alphanumeric, etc.)
        // This is a simple check - you might want to make this more sophisticated
        if (searchQuery.length > 5) { // Most barcodes are longer than 5 characters
          // Save the scanned barcode for potential product creation
          setScannedBarcode(searchQuery);
          setIsProductNotFound(true);
        }
        
        // Fetch and search products
        const productsSnapshot = await getDocs(collection(db, 'products'));
        productsSnapshot.docs.forEach(doc => {
          const product = doc.data() as Product;
          if (
            product.name.toLowerCase().includes(lowerQuery) ||
            (product.description?.toLowerCase() || '').includes(lowerQuery) ||
            (product.barcode?.toLowerCase() || '').includes(lowerQuery)
          ) {
            results.push({
              id: doc.id,
              name: product.name,
              type: 'product',
              barcode: product.barcode,
              description: product.description,
              quantity: product.quantity,
              minQuantity: product.minQuantity
            });
          }
        });
        
        // Only search for other entities in inventory mode
        if (mode === 'inventory') {
          // Fetch and search categories
          const categoriesSnapshot = await getDocs(collection(db, 'categories'));
          categoriesSnapshot.docs.forEach(doc => {
            const category = doc.data() as ProductCategory;
            if (
              category.name.toLowerCase().includes(lowerQuery) ||
              (category.description?.toLowerCase() || '').includes(lowerQuery)
            ) {
              results.push({
                id: doc.id,
                name: category.name,
                type: 'category',
                description: category.description
              });
            }
          });
          
          // Fetch and search locations
          const locationsSnapshot = await getDocs(collection(db, 'locations'));
          locationsSnapshot.docs.forEach(doc => {
            const location = doc.data() as Location;
            if (
              location.name.toLowerCase().includes(lowerQuery) ||
              (location.description?.toLowerCase() || '').includes(lowerQuery)
            ) {
              results.push({
                id: doc.id,
                name: location.name,
                type: 'location',
                description: location.description
              });
            }
          });
          
          // Fetch and search product types
          const typesSnapshot = await getDocs(collection(db, 'productTypes'));
          typesSnapshot.docs.forEach(doc => {
            const productType = doc.data() as ProductType;
            if (
              productType.name.toLowerCase().includes(lowerQuery) ||
              (productType.description?.toLowerCase() || '').includes(lowerQuery)
            ) {
              results.push({
                id: doc.id,
                name: productType.name,
                type: 'productType',
                description: productType.description
              });
            }
          });
        }
      }
      
      setSearchResults(results);
      setActiveIndex(results.length > 0 ? 0 : -1);
    } catch (error) {
      console.error('Error searching:', error);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, mode]);

  // Handle mode change
  const handleModeChange = (newMode: ModalMode) => {
    setMode(newMode);
    setSearchQuery(''); // Clear search when switching modes
    if (searchInputRef.current) {
      searchInputRef.current.value = ''; // Clear input field value
    }
    setSearchResults([]);
    setProductToUpdate(null);
    setShowProductModal(false);
    setStatusMessage(null);
    setIsProductNotFound(false);
    
    // Set default adjustment amount based on mode
    setAdjustmentAmount(1);
    
    // Focus search input after mode change
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };
  
  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'product':
        if (mode === 'inventory') {
          navigate(`/products/${result.id}`);
          onClose();
        } else {
          // In shipping/receiving modes, fetch the product and show the quantity modal
          fetchProductDetails(result.id);
        }
        break;
      case 'category':
        if (mode === 'inventory') {
          navigate('/settings/categories');
          onClose();
        }
        break;
      case 'location':
        if (mode === 'inventory') {
          navigate('/settings/locations');
          onClose();
        }
        break;
      case 'productType':
        if (mode === 'inventory') {
          navigate('/settings/product-types');
          onClose();
        }
        break;
    }
  };
  
  const fetchProductDetails = async (productId: string) => {
    try {
      setIsLoading(true);
      const productDoc = await getDoc(doc(db, 'products', productId));
      
      if (productDoc.exists()) {
        const product = { 
          id: productDoc.id, 
          ...productDoc.data() 
        } as Product;
        
        setProductToUpdate(product);
        
        // Set new quantity based on the mode
        if (mode === 'shipping') {
          // For shipping, default to removing 1 unit
          const newQty = Math.max(0, product.quantity - adjustmentAmount);
          setNewQuantity(newQty);
          // For shipping mode, auto-update quantity
          await updateProductQuantity(product, newQty);
          return;
        } else if (mode === 'receiving') {
          // For receiving, default to adding 1 unit
          setNewQuantity(product.quantity + adjustmentAmount);
        } else {
          // For inventory mode, just show the current quantity
          setNewQuantity(product.quantity);
        }
        
        setShowProductModal(true);
      } else {
        setError('Product not found');
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      setError('Failed to load product details');
    } finally {
      setIsLoading(false);
    }
  };
  
  const getIconForType = (type: string) => {
    switch (type) {
      case 'product':
        return <Package className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />;
      case 'category':
        return <Tag className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />;
      case 'location':
        return <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />;
      case 'productType':
        return <BoxesIcon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />;
      default:
        return <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500" />;
    }
  };
  
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'product':
        return 'Product';
      case 'category':
        return 'Category';
      case 'location':
        return 'Location';
      case 'productType':
        return 'Product Type';
      default:
        return 'Unknown';
    }
  };
  
  const handleAdjustmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setAdjustmentAmount(value);
      
      // Update the new quantity based on the adjustment amount
      if (productToUpdate) {
        if (mode === 'shipping') {
          setNewQuantity(Math.max(0, productToUpdate.quantity - value));
        } else if (mode === 'receiving') {
          setNewQuantity(productToUpdate.quantity + value);
        }
      }
    }
  };
  
  const updateProductQuantity = async (product?: Product, qty?: number) => {
    // Use passed parameters or fall back to state values
    const productToProcess = product || productToUpdate;
    const quantityToSet = qty !== undefined ? qty : newQuantity;
    
    if (!productToProcess || !currentUser) return;
    
    setIsUpdating(true);
    try {
      const productRef = doc(db, 'products', productToProcess.id);
      
      // Determine the activity type based on mode and quantity change
      let activityType: 'added' | 'removed' | 'updated' = 'updated';
      let quantityChange = 0;
      
      if (mode === 'shipping') {
        activityType = 'removed';
        quantityChange = productToProcess.quantity - quantityToSet;
      } else if (mode === 'receiving') {
        activityType = 'added';
        quantityChange = quantityToSet - productToProcess.quantity;
      } else if (quantityToSet !== productToProcess.quantity) {
        // For inventory mode, determine if it's an add or remove based on the direction
        if (quantityToSet > productToProcess.quantity) {
          activityType = 'added';
          quantityChange = quantityToSet - productToProcess.quantity;
        } else {
          activityType = 'removed';
          quantityChange = productToProcess.quantity - quantityToSet;
        }
      }
      
      // Update the product quantity
      await updateDoc(productRef, {
        quantity: quantityToSet,
        updatedAt: new Date()
      });
      
      // Log the activity with the proper quantity
      await logActivity(
        activityType,
        'product',
        productToProcess.id,
        productToProcess.name,
        currentUser,
        mode === 'inventory' ? quantityToSet : quantityChange
      );
      
      // Set success message
      let successMessage = '';
      if (mode === 'shipping') {
        successMessage = `Shipped ${quantityChange} units of ${productToProcess.name}`;
      } else if (mode === 'receiving') {
        successMessage = `Received ${quantityChange} units of ${productToProcess.name}`;
      } else {
        successMessage = `Updated quantity of ${productToProcess.name} to ${quantityToSet}`;
      }
      
      setStatusMessage(successMessage);
      
      // Clear form after successful update
      setSearchQuery('');
      if (searchInputRef.current) {
        searchInputRef.current.value = '';
      }
      setShowProductModal(false);
      setProductToUpdate(null);
      
      // Clear status message after 3 seconds
      setTimeout(() => {
        setStatusMessage(null);
        // Refocus the search input for next scan
        if (searchInputRef.current && mode === 'shipping') {
          searchInputRef.current.focus();
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error updating product quantity:', error);
      setError('Failed to update product quantity.');
    } finally {
      setIsUpdating(false);
    }
  };
  
  const incrementQuantity = () => {
    setNewQuantity(prev => prev + 1);
  };
  
  const decrementQuantity = () => {
    setNewQuantity(prev => (prev > 0 ? prev - 1 : 0));
  };
  
  const resetQuantity = () => {
    if (productToUpdate) {
      if (mode === 'shipping') {
        setNewQuantity(Math.max(0, productToUpdate.quantity - adjustmentAmount));
      } else if (mode === 'receiving') {
        setNewQuantity(productToUpdate.quantity + adjustmentAmount);
      } else {
        setNewQuantity(productToUpdate.quantity);
      }
    }
  };
  
  const getModeDescription = () => {
    switch (mode) {
      case 'shipping':
        return 'Scan product barcodes to quickly decrease inventory for shipping or pick & pack operations';
      case 'receiving':
        return 'Scan product barcodes to quickly add new inventory when receiving stock';
      default:
        return 'Search for products, categories, locations, or scan barcodes to view details';
    }
  };
  
  const getSearchPlaceholder = () => {
    switch (mode) {
      case 'shipping':
        return 'Scan product barcode to ship out...';
      case 'receiving':
        return 'Scan product barcode to receive stock...';
      default:
        return 'Search or scan barcode...';
    }
  };
  
  const getQuantityLabel = () => {
    switch (mode) {
      case 'shipping':
        return 'Quantity to Ship';
      case 'receiving':
        return 'Quantity to Receive';
      default:
        return 'Update Quantity';
    }
  };
  
  const getQuantityActionText = () => {
    switch (mode) {
      case 'shipping':
        return 'Ship Out';
      case 'receiving':
        return 'Receive Stock';
      default:
        return 'Update Quantity';
    }
  };
  
  const handleCreateProduct = () => {
    navigate(`/products/new?barcode=${encodeURIComponent(scannedBarcode)}`);
    onClose();
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-2 sm:p-4 text-center">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>
        
        <div 
          ref={modalRef}
          className="w-full max-w-md sm:max-w-2xl transform overflow-hidden rounded-lg bg-white text-left align-middle shadow-xl transition-all"
        >
          {/* Mode Selection */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => handleModeChange('inventory')}
              className={`flex-1 text-center py-2 text-xs sm:text-sm font-medium focus:outline-none ${
                mode === 'inventory' 
                  ? 'text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-1" />
              Inventory
            </button>
            
            <button
              onClick={() => handleModeChange('shipping')}
              className={`flex-1 text-center py-2 text-xs sm:text-sm font-medium focus:outline-none ${
                mode === 'shipping' 
                  ? 'text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-1" />
              Shipping
            </button>
            
            <button
              onClick={() => handleModeChange('receiving')}
              className={`flex-1 text-center py-2 text-xs sm:text-sm font-medium focus:outline-none ${
                mode === 'receiving' 
                  ? 'text-indigo-600 border-b-2 border-indigo-600' 
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 mx-auto mb-1" />
              Receiving
            </button>
          </div>
          
          {/* Mode Description */}
          <div className="bg-gray-50 px-3 py-2 sm:px-4 sm:py-2 border-b border-gray-200">
            <p className="text-xs text-gray-600">{getModeDescription()}</p>
          </div>
          
          {/* Status Message */}
          {statusMessage && (
            <div className="bg-green-100 border-green-400 text-green-700 px-3 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm">
              {statusMessage}
            </div>
          )}
          
          {/* Search header */}
          <div className="border-b border-gray-200 p-3 sm:p-4">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={getSearchPlaceholder()}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-md border border-gray-300 py-1.5 sm:py-2 pl-9 sm:pl-10 pr-9 sm:pr-10 text-xs sm:text-sm placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button 
                  className="absolute right-3 text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setSearchQuery('');
                    if (searchInputRef.current) {
                      searchInputRef.current.value = '';
                    }
                  }}
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>
            
            <div className="mt-1 flex items-center justify-between text-xs text-gray-500 flex-wrap gap-1">
              <span>
                Press <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-xs">↑</kbd> and <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-xs">↓</kbd> to navigate
              </span>
              <span>
                Press <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-xs">Enter</kbd> to select
              </span>
              <span>
                Press <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-xs">Esc</kbd> to close
              </span>
            </div>
          </div>
          
          {/* Adjustment quantity for shipping/receiving modes */}
          {(mode === 'shipping' || mode === 'receiving') && !showProductModal && !isProductNotFound && (
            <div className="px-3 py-2 sm:px-4 sm:py-3 border-b border-gray-200 flex items-center justify-between">
              <label className="text-xs sm:text-sm text-gray-700 font-medium">
                Default {mode === 'shipping' ? 'shipping' : 'receiving'} quantity:
              </label>
              <div className="flex items-center">
                <button
                  onClick={() => setAdjustmentAmount(Math.max(1, adjustmentAmount - 1))}
                  className="rounded-l-md border border-gray-300 bg-gray-50 p-1 sm:p-1.5 text-gray-500 hover:bg-gray-100"
                >
                  <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
                
                <input
                  type="number"
                  min="1"
                  value={adjustmentAmount}
                  onChange={handleAdjustmentChange}
                  className="w-12 sm:w-16 border-y border-gray-300 py-1 sm:py-1.5 px-2 text-center text-xs sm:text-sm"
                />
                
                <button
                  onClick={() => setAdjustmentAmount(adjustmentAmount + 1)}
                  className="rounded-r-md border border-gray-300 bg-gray-50 p-1 sm:p-1.5 text-gray-500 hover:bg-gray-100"
                >
                  <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>
            </div>
          )}
          
          {/* Product not found prompt */}
          {isProductNotFound && (
            <div className="border-b border-gray-200 p-3 sm:p-4">
              <div className="flex items-start mb-3 sm:mb-4">
                <div className="flex-shrink-0 mt-1">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm sm:text-base font-medium text-gray-900">
                    Product Not Found
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500">
                    The barcode <span className="font-medium">{scannedBarcode}</span> was not found in your inventory.
                  </p>
                </div>
              </div>

              <div className="mt-4 sm:flex sm:justify-between">
                <div className="sm:flex-1 sm:pr-4">
                  <h4 className="text-xs sm:text-sm font-medium text-gray-700">Would you like to create a new product?</h4>
                  <p className="mt-1 text-xs text-gray-500">
                    Creating a new product will add it to your inventory with the scanned barcode.
                  </p>
                </div>
                <div className="mt-4 sm:mt-0">
                  <button
                    onClick={handleCreateProduct}
                    className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 text-xs sm:text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    Create Product
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Product quantity modal for barcode matches */}
          {showProductModal && productToUpdate && (
            <div className="border-b border-gray-200 p-3 sm:p-4">
              <div className="mb-3 sm:mb-4 flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                  {mode === 'shipping' ? 'Ship Product' : 
                   mode === 'receiving' ? 'Receive Product' : 
                   'Product Found'}
                </h3>
                <div className="rounded bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800">
                  {productToUpdate.barcode}
                </div>
              </div>
              
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="flex h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                  <Package className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600" />
                </div>
                
                <div className="flex-1">
                  <h4 className="text-sm sm:text-md font-medium text-gray-900">
                    {productToUpdate.name}
                  </h4>
                  {productToUpdate.description && (
                    <p className="mt-1 text-xs sm:text-sm text-gray-500 line-clamp-1">
                      {productToUpdate.description}
                    </p>
                  )}
                  
                  <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Current quantity:</span>{' '}
                      <span className={`font-semibold ${
                        productToUpdate.quantity <= productToUpdate.minQuantity 
                          ? 'text-amber-500' 
                          : 'text-gray-900'
                      }`}>
                        {productToUpdate.quantity}
                      </span>
                      
                      {productToUpdate.quantity <= productToUpdate.minQuantity && (
                        <div className="text-xs text-amber-500 flex items-center mt-1">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Low stock
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Min quantity:</span>{' '}
                      <span className="font-semibold text-gray-900">{productToUpdate.minQuantity}</span>
                    </div>
                    
                    {/* Show location in shipping/receiving modes */}
                    {(mode === 'shipping' || mode === 'receiving') && (
                      <div className="col-span-2 mt-1">
                        <span className="font-medium text-gray-500">Location:</span>{' '}
                        <span className="font-semibold text-gray-900">
                          {/* We would need to fetch location name here */}
                          Fetching...
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-3 sm:mt-4">
                <label htmlFor="quantity" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  {getQuantityLabel()}
                </label>
                
                {mode === 'shipping' && (
                  <div className="bg-amber-50 p-2 rounded-md text-amber-800 text-xs mb-2">
                    <div className="flex items-start">
                      <div className="mr-1.5 mt-0.5">
                        <AlertCircle className="h-3 w-3" />
                      </div>
                      <div>
                        You are about to decrease the inventory by {adjustmentAmount} units.
                        {productToUpdate.quantity - newQuantity > productToUpdate.quantity && (
                          <span className="font-semibold"> Warning: This will result in negative inventory!</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-1 sm:mt-2 flex items-center">
                  <button
                    onClick={decrementQuantity}
                    className={`rounded-l-md border border-gray-300 bg-gray-50 p-1 sm:p-2 text-gray-500 hover:bg-gray-100 ${
                      mode === 'shipping' ? 'bg-red-50' : ''
                    }`}
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                  <input
                    type="number"
                    id="quantity"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className={`block w-full border-y border-gray-300 py-1.5 sm:py-2 px-3 text-center text-xs sm:text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 ${
                      mode === 'shipping' && newQuantity < productToUpdate.quantity ? 'bg-red-50 text-red-800' :
                      mode === 'receiving' && newQuantity > productToUpdate.quantity ? 'bg-green-50 text-green-800' :
                      ''
                    }`}
                  />
                  <button
                    onClick={incrementQuantity}
                    className={`rounded-r-md border border-gray-300 bg-gray-50 p-1 sm:p-2 text-gray-500 hover:bg-gray-100 ${
                      mode === 'receiving' ? 'bg-green-50' : ''
                    }`}
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                  <button
                    onClick={resetQuantity}
                    className="ml-2 rounded border border-gray-300 p-1 sm:p-2 text-gray-500 hover:bg-gray-100"
                    title="Reset to original quantity"
                  >
                    <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                </div>
                
                {/* Display quantity change indicators */}
                <div className="mt-2 flex justify-between text-xs">
                  {mode === 'shipping' && (
                    <div className="flex items-center text-red-600">
                      <ArrowDown className="h-3 w-3 mr-1" />
                      <span>{productToUpdate.quantity - newQuantity} units out</span>
                    </div>
                  )}
                  
                  {mode === 'receiving' && (
                    <div className="flex items-center text-green-600">
                      <ArrowUp className="h-3 w-3 mr-1" />
                      <span>{newQuantity - productToUpdate.quantity} units in</span>
                    </div>
                  )}
                  
                  {/* Display remaining percentage for shipping mode */}
                  {mode === 'shipping' && productToUpdate.quantity > 0 && (
                    <div className={`${
                      newQuantity / productToUpdate.quantity < 0.2 ? 'text-red-600' : 
                      newQuantity / productToUpdate.quantity < 0.5 ? 'text-amber-600' : 
                      'text-gray-600'
                    }`}>
                      {Math.round((newQuantity / productToUpdate.quantity) * 100)}% remaining
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => {
                    navigate(`/products/${productToUpdate.id}`);
                    onClose();
                  }}
                  className="inline-flex items-center rounded border border-gray-300 bg-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  View Details
                  <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
                </button>
                
                <button
                  onClick={() => updateProductQuantity()}
                  disabled={isUpdating || (mode === 'inventory' && newQuantity === productToUpdate.quantity)}
                  className={`inline-flex items-center rounded px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                    mode === 'shipping' 
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                      : mode === 'receiving'
                        ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                        : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                  }`}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    getQuantityActionText()
                  )}
                </button>
              </div>
            </div>
          )}
          
          {/* Search results */}
          <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 sm:py-8">
                <Loader2 className="mr-2 h-5 w-5 sm:h-6 sm:w-6 animate-spin text-indigo-500" />
                <span className="text-xs sm:text-sm text-gray-600">Searching...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-6 sm:py-8 text-red-500">
                <AlertCircle className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-xs sm:text-sm">{error}</span>
              </div>
            ) : searchResults.length === 0 && searchQuery && !isProductNotFound ? (
              <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-gray-500">
                <span className="text-xs sm:text-sm mb-2">No results found for "{searchQuery}"</span>
                {mode === 'inventory' && (
                  <button
                    onClick={handleCreateProduct}
                    className="mt-2 inline-flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-900"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Create a new product
                  </button>
                )}
              </div>
            ) : searchQuery && !isProductNotFound ? (
              <ul className="divide-y divide-gray-200">
                {searchResults.map((result, index) => (
                  <li
                    key={`${result.type}-${result.id}`}
                    className={`cursor-pointer px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-50 ${
                      index === activeIndex ? 'bg-indigo-50' : ''
                    }`}
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-start">
                      <div className="mr-2 sm:mr-3 flex-shrink-0">
                        {getIconForType(result.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                            {result.name}
                          </p>
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-800">
                            {getTypeLabel(result.type)}
                          </span>
                        </div>
                        {result.description && (
                          <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                            {result.description}
                          </p>
                        )}
                        {result.type === 'product' && (
                          <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                            {result.barcode && (
                              <span>Barcode: {result.barcode}</span>
                            )}
                            {result.quantity !== undefined && (
                              <span className={result.quantity <= (result.minQuantity || 0) ? 'text-amber-500 font-medium' : ''}>
                                Qty: {result.quantity}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-4 px-2">
                <p className="text-xs sm:text-sm text-center text-gray-500">
                  {mode === 'shipping' 
                    ? 'Scan a product barcode to ship out items' 
                    : mode === 'receiving'
                      ? 'Scan a product barcode to receive new stock'
                      : 'Type to search or scan a barcode'
                  }
                </p>
                
                <div className="mt-4 bg-gray-50 rounded-md p-3">
                  <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Quick Tips:</h4>
                  <ul className="text-xs text-gray-600 space-y-1.5">
                    <li className="flex items-start">
                      <span className="mr-1.5">•</span>
                      <span>
                        {mode === 'shipping' 
                          ? 'Scan products to quickly reduce inventory for shipping'
                          : mode === 'receiving'
                            ? 'Scan products to quickly add inventory when receiving stock'
                            : 'Search by name, barcode, or scan products directly'
                        }
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-1.5">•</span>
                      <span>
                        You can adjust the quantity before confirming
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-1.5">•</span>
                      <span>
                        Press <kbd className="rounded border border-gray-300 bg-gray-100 px-1 py-0.5 text-xs">Enter</kbd> after scanning to quickly confirm
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;