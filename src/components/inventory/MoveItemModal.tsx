import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product, Location } from '../../types';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { ArrowRight, Truck, MapPin, ArrowRightLeft, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import Modal from '../ui/Modal';

interface MoveItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: (sourceLocationId: string, destinationLocationId: string, quantity: number) => void;
}

const MoveItemModal: React.FC<MoveItemModalProps> = ({ 
  isOpen, 
  onClose, 
  product, 
  onSuccess 
}) => {
  const { currentUser } = useAuth();
  
  // State for locations
  const [locations, setLocations] = useState<Location[]>([]);
  const [sourceLocation, setSourceLocation] = useState<Location | null>(null);
  const [destinationLocationId, setDestinationLocationId] = useState<string>('');
  
  // State for quantity to move
  const [quantity, setQuantity] = useState<number>(1);
  
  // UI States
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingLocations, setLoadingLocations] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  
  // Load all available locations when the modal opens
  useEffect(() => {
    if (isOpen && product) {
      fetchLocations();
      setQuantity(1); // Reset quantity when modal opens
      setDestinationLocationId(''); // Reset destination
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, product]);
  
  // Fetch all locations and set the source location
  const fetchLocations = async () => {
    try {
      setLoadingLocations(true);
      
      // Get all locations
      const locationsCollection = collection(db, 'locations');
      const locationsSnapshot = await getDocs(locationsCollection);
      
      if (locationsSnapshot.empty) {
        setError('No locations available');
        setLoadingLocations(false);
        return;
      }
      
      const locationsData = locationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Location[];
      
      setLocations(locationsData);
      
      // Set source location from product's current location
      if (product && product.locationId) {
        const sourceLocationDoc = locationsData.find(loc => loc.id === product.locationId);
        if (sourceLocationDoc) {
          setSourceLocation(sourceLocationDoc);
        }
      }
      
      setLoadingLocations(false);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setError('Failed to load locations. Please try again.');
      setLoadingLocations(false);
    }
  };

  // Handle quantity change with validation
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      if (product) {
        // Limit quantity to the available amount
        setQuantity(Math.min(Math.max(1, value), product.quantity));
      } else {
        setQuantity(Math.max(1, value));
      }
    }
  };
  
  // Execute item move
  const handleMoveItem = async () => {
    if (!product || !currentUser || !sourceLocation) {
      setError('Missing required data');
      return;
    }
    
    if (!destinationLocationId) {
      setError('Please select a destination location');
      return;
    }
    
    if (product.locationId === destinationLocationId) {
      setError('Source and destination locations must be different');
      return;
    }
    
    if (quantity <= 0 || quantity > product.quantity) {
      setError(`Quantity must be between 1 and ${product.quantity}`);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Check if the product already exists in the destination location
      const productsRef = collection(db, 'products');
      const destProductQuery = await getDocs(
        collection(db, 'products')
      );
      
      // Find if there's a matching product at the destination
      // Need to check manually since Firestore can't query for multiple fields with equality
      let destProductDoc = destProductQuery.docs.find(doc => {
        const data = doc.data();
        return data.name === product.name && 
               data.barcode === product.barcode &&
               data.locationId === destinationLocationId;
      });
      
      // Moving all quantity or partial quantity?
      const movingAllItems = quantity === product.quantity;
      
      // Case 1: Moving all items - simply update the locationId
      if (movingAllItems) {
        // Update product location
        await updateDoc(doc(db, 'products', product.id), {
          locationId: destinationLocationId,
          updatedAt: new Date()
        });
        
        // Log activity for moving entire product
        await logActivity(
          'updated',
          'product',
          product.id,
          product.name,
          currentUser
        );
      } 
      // Case 2: Destination has a matching product - update quantities
      else if (destProductDoc) {
        const destProduct = { 
          id: destProductDoc.id, 
          ...destProductDoc.data() 
        } as Product;
        
        // Increase quantity at destination
        await updateDoc(doc(db, 'products', destProduct.id), {
          quantity: destProduct.quantity + quantity,
          updatedAt: new Date()
        });
        
        // Decrease quantity at source
        await updateDoc(doc(db, 'products', product.id), {
          quantity: product.quantity - quantity,
          updatedAt: new Date()
        });
        
        // Log activity for source product (removal)
        await logActivity(
          'removed',
          'product',
          product.id,
          product.name,
          currentUser,
          quantity
        );
        
        // Log activity for destination product (addition)
        await logActivity(
          'added',
          'product',
          destProduct.id,
          destProduct.name,
          currentUser,
          quantity
        );
      }
      // Case 3: Create a new product entry at the destination
      else {
        // Create new product at destination
        const newProductData = {
          ...product,
          id: undefined, // Remove ID so Firestore will generate a new one
          locationId: destinationLocationId,
          quantity: quantity,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        delete newProductData.id; // Ensure ID is removed
        
        const newProductRef = await addDoc(collection(db, 'products'), newProductData);
        
        // Update quantity at source
        await updateDoc(doc(db, 'products', product.id), {
          quantity: product.quantity - quantity,
          updatedAt: new Date()
        });
        
        // Log activity for source product (removal)
        await logActivity(
          'removed',
          'product',
          product.id,
          product.name,
          currentUser,
          quantity
        );
        
        // Log activity for destination product (addition)
        await logActivity(
          'added',
          'product',
          newProductRef.id,
          product.name,
          currentUser,
          quantity
        );
      }
      
      // Show success message
      setSuccess(true);
      
      // Call onSuccess callback if provided
      if (onSuccess && sourceLocation) {
        onSuccess(sourceLocation.id, destinationLocationId, quantity);
      }
      
      // Close modal after a delay
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error moving item:', error);
      setError('Failed to move item. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  if (!product || !sourceLocation) {
    return null;
  }
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Move Items Between Locations"
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <p className="text-sm text-green-700">
                Successfully moved {quantity} units of {product.name}
              </p>
            </div>
          </div>
        )}
        
        {/* Product Information */}
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-md flex items-center justify-center mr-3">
              <Truck className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">{product.name}</h3>
              {product.barcode && (
                <p className="text-xs text-gray-500 mt-1">
                  Barcode: {product.barcode}
                </p>
              )}
              <p className="text-xs text-gray-600 mt-1">
                Available Quantity: <span className="font-semibold">{product.quantity}</span>
              </p>
            </div>
          </div>
        </div>
        
        {/* Source and Destination Locations */}
        <div className="border-t border-b border-gray-200 py-4">
          {/* Source Location */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 text-gray-500 mr-1" />
                Source Location
              </div>
            </label>
            <div className="bg-gray-100 p-2 rounded border border-gray-200 text-sm text-gray-800">
              {sourceLocation.name}
            </div>
          </div>
          
          {/* Destination Location */}
          <div>
            <label htmlFor="destinationLocation" className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center">
                <MapPin className="h-4 w-4 text-indigo-500 mr-1" />
                Destination Location
              </div>
            </label>
            {loadingLocations ? (
              <div className="flex items-center p-2">
                <Loader2 className="h-4 w-4 mr-2 animate-spin text-indigo-500" />
                <span className="text-sm text-gray-500">Loading locations...</span>
              </div>
            ) : (
              <select
                id="destinationLocation"
                value={destinationLocationId}
                onChange={(e) => setDestinationLocationId(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              >
                <option value="">Select destination location</option>
                {locations
                  .filter(loc => loc.id !== product.locationId) // Filter out the current location
                  .map(location => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))
                }
              </select>
            )}
          </div>
          
          {/* Visual movement indicator */}
          <div className="flex justify-center items-center my-4">
            <div className="h-px bg-gray-200 flex-grow"></div>
            <ArrowRightLeft className="h-5 w-5 mx-2 text-indigo-500" />
            <div className="h-px bg-gray-200 flex-grow"></div>
          </div>
          
          {/* Quantity to Move */}
          <div className="mt-4">
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
              Quantity to Move
            </label>
            <div className="flex items-center">
              <input
                type="number"
                id="quantity"
                min="1"
                max={product.quantity}
                value={quantity}
                onChange={handleQuantityChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            {product.quantity === quantity ? (
              <p className="mt-1 text-xs text-amber-600">
                You are moving all available units of this product.
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">
                {quantity} out of {product.quantity} units will be moved.
              </p>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleMoveItem}
            disabled={loading || quantity <= 0 || !destinationLocationId}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Moving...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Move Items
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default MoveItemModal;