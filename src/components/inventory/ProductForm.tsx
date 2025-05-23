import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product, ProductCategory, ProductType, Location, Provider } from '../../types';
import { Plus, X, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { findWooCommerceProductBySKU } from '../../utils/wooCommerceProductSync';

interface ProductFormProps {
  initialData?: Partial<Product>;
  onSubmit: (data: Partial<Product>) => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const { currentUser } = useAuth();
  
  // Initialize form data with initialData or defaults
  const [formData, setFormData] = useState<Partial<Product>>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    barcode: initialData?.barcode || '',
    categoryId: initialData?.categoryId || '',
    typeId: initialData?.typeId || '',
    locationId: initialData?.locationId || '',
    providerId: initialData?.providerId || '', 
    quantity: initialData?.quantity !== undefined ? initialData.quantity : 1,
    minQuantity: initialData?.minQuantity !== undefined ? initialData.minQuantity : 1,
    price: initialData?.price !== undefined ? initialData.price : 0,
    cost: initialData?.cost !== undefined ? initialData.cost : 0,
    vatPercentage: initialData?.vatPercentage !== undefined ? initialData.vatPercentage : 19,
    wooCommerceId: initialData?.wooCommerceId || undefined,
  });
  
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingWooCommerce, setCheckingWooCommerce] = useState(false);
  
  // Inline creation form visibility states
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showProductTypeForm, setShowProductTypeForm] = useState(false);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [showProviderForm, setShowProviderForm] = useState(false);
  
  // Inline creation form data
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [newProductType, setNewProductType] = useState({ name: '', description: '' });
  const [newLocation, setNewLocation] = useState({ name: '', description: '' });
  const [newProvider, setNewProvider] = useState({ 
    name: '', 
    description: '', 
    website: '', 
    phoneNumber: '',
    excludeFromReports: false 
  });
  
  // Loading states for entity creation
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [creatingProductType, setCreatingProductType] = useState(false);
  const [creatingLocation, setCreatingLocation] = useState(false);
  const [creatingProvider, setCreatingProvider] = useState(false);
  
  // Error states for entity creation
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [productTypeError, setProductTypeError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  
  // Update form data when initialData changes
  useEffect(() => {
    if (initialData) {
      console.log('Setting form data from initialData:', initialData);
      setFormData({
        name: initialData.name || formData.name,
        description: initialData.description || formData.description,
        barcode: initialData.barcode || formData.barcode,
        categoryId: initialData.categoryId || formData.categoryId,
        typeId: initialData.typeId || formData.typeId,
        locationId: initialData.locationId || formData.locationId,
        providerId: initialData.providerId || formData.providerId,
        quantity: initialData.quantity !== undefined ? initialData.quantity : formData.quantity,
        minQuantity: initialData.minQuantity !== undefined ? initialData.minQuantity : formData.minQuantity,
        price: initialData.price !== undefined ? initialData.price : formData.price,
        cost: initialData.cost !== undefined ? initialData.cost : formData.cost,
        vatPercentage: initialData.vatPercentage !== undefined ? initialData.vatPercentage : formData.vatPercentage,
        wooCommerceId: initialData.wooCommerceId !== undefined ? initialData.wooCommerceId : formData.wooCommerceId,
      });
    }
  }, [initialData]);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categoriesData = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProductCategory[];
        setCategories(categoriesData);
        
        // Fetch product types
        const typesSnapshot = await getDocs(collection(db, 'productTypes'));
        const typesData = typesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProductType[];
        setProductTypes(typesData);
        
        // Fetch locations
        const locationsSnapshot = await getDocs(collection(db, 'locations'));
        const locationsData = locationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Location[];
        setLocations(locationsData);
        
        // Fetch providers
        const providersSnapshot = await getDocs(collection(db, 'providers'));
        const providersData = providersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Provider[];
        setProviders(providersData);
        
        // Only set default values if there's no initialData or the respective field is empty
        const newFormData = { ...formData };
        let dataChanged = false;
        
        // Set default category if not already set
        if (!formData.categoryId) {
          const defaultCategory = categoriesData.find(cat => cat.default);
          if (defaultCategory) {
            newFormData.categoryId = defaultCategory.id;
            dataChanged = true;
          }
        }
        
        // Set default product type if not already set
        if (!formData.typeId) {
          const defaultProductType = typesData.find(type => type.default);
          if (defaultProductType) {
            newFormData.typeId = defaultProductType.id;
            dataChanged = true;
          }
        }
        
        // Set default location if not already set
        if (!formData.locationId) {
          const defaultLocation = locationsData.find(loc => loc.default);
          if (defaultLocation) {
            newFormData.locationId = defaultLocation.id;
            dataChanged = true;
          }
        }
        
        if (dataChanged) {
          setFormData(newFormData);
        }
        
        setLoading(false);

        // If adding a new product with a barcode, check for WooCommerce match
        if (!initialData?.id && formData.barcode && !formData.wooCommerceId) {
          checkForWooCommerceMatch(formData.barcode);
        }
      } catch (error) {
        console.error('Error fetching form data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Check for WooCommerce product match when barcode changes
  useEffect(() => {
    if (!initialData?.id && formData.barcode && !formData.wooCommerceId && !checkingWooCommerce) {
      checkForWooCommerceMatch(formData.barcode);
    }
  }, [formData.barcode]);
  
  // Check if the barcode matches a WooCommerce product
  const checkForWooCommerceMatch = async (barcode: string) => {
    if (!barcode || checkingWooCommerce) return;
    
    try {
      setCheckingWooCommerce(true);
      
      const wooCommerceId = await findWooCommerceProductBySKU(barcode);
      
      if (wooCommerceId) {
        console.log(`Found matching WooCommerce product with ID: ${wooCommerceId}`);
        setFormData(prev => ({
          ...prev,
          wooCommerceId
        }));
      }
    } catch (error) {
      console.error('Error checking for WooCommerce match:', error);
    } finally {
      setCheckingWooCommerce(false);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric inputs
    if (['quantity', 'minQuantity', 'price', 'cost', 'vatPercentage'].includes(name)) {
      const numValue = parseFloat(value);
      setFormData({ ...formData, [name]: isNaN(numValue) ? 0 : numValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };
  
  // Handler for new category form changes
  const handleCategoryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewCategory({ ...newCategory, [name]: value });
  };
  
  // Handler for new product type form changes
  const handleProductTypeChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewProductType({ ...newProductType, [name]: value });
  };
  
  // Handler for new location form changes
  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewLocation({ ...newLocation, [name]: value });
  };
  
  // Handler for new provider form changes
  const handleProviderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setNewProvider({ 
      ...newProvider, 
      [name]: type === 'checkbox' ? checked : value 
    });
  };
  
  // Handler to create a new category
  const createCategory = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default action
    if (!currentUser) return;
    
    // Validation
    if (!newCategory.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    
    try {
      setCreatingCategory(true);
      setCategoryError(null);
      
      // Create new category in Firestore
      const categoryData = {
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
        default: false, // New categories are not default by default
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'categories'), categoryData);
      
      // Log the activity
      await logActivity(
        'added',
        'category',
        docRef.id,
        categoryData.name,
        currentUser
      );
      
      // Add the new category to the categories state
      const newCategoryWithId = { 
        id: docRef.id, 
        ...categoryData 
      } as ProductCategory;
      
      setCategories([...categories, newCategoryWithId]);
      
      // Set the new category as the selected one
      setFormData({ ...formData, categoryId: docRef.id });
      
      // Reset form fields but keep form open
      setNewCategory({ name: '', description: '' });
      
    } catch (error) {
      console.error('Error creating category:', error);
      setCategoryError('Failed to create category. Please try again.');
    } finally {
      setCreatingCategory(false);
    }
  };
  
  // Handler to create a new product type
  const createProductType = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default action
    if (!currentUser) return;
    
    // Validation
    if (!newProductType.name.trim()) {
      setProductTypeError('Product type name is required');
      return;
    }
    
    try {
      setCreatingProductType(true);
      setProductTypeError(null);
      
      // Create new product type in Firestore
      const productTypeData = {
        name: newProductType.name.trim(),
        description: newProductType.description.trim(),
        default: false, // New product types are not default by default
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'productTypes'), productTypeData);
      
      // Log the activity
      await logActivity(
        'added',
        'productType',
        docRef.id,
        productTypeData.name,
        currentUser
      );
      
      // Add the new product type to the product types state
      const newProductTypeWithId = { 
        id: docRef.id, 
        ...productTypeData 
      } as ProductType;
      
      setProductTypes([...productTypes, newProductTypeWithId]);
      
      // Set the new product type as the selected one
      setFormData({ ...formData, typeId: docRef.id });
      
      // Reset form fields but keep form open
      setNewProductType({ name: '', description: '' });
      
    } catch (error) {
      console.error('Error creating product type:', error);
      setProductTypeError('Failed to create product type. Please try again.');
    } finally {
      setCreatingProductType(false);
    }
  };
  
  // Handler to create a new location
  const createLocation = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default action
    if (!currentUser) return;
    
    // Validation
    if (!newLocation.name.trim()) {
      setLocationError('Location name is required');
      return;
    }
    
    try {
      setCreatingLocation(true);
      setLocationError(null);
      
      // Create new location in Firestore
      const locationData = {
        name: newLocation.name.trim(),
        description: newLocation.description.trim(),
        default: false, // New locations are not default by default
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'locations'), locationData);
      
      // Log the activity
      await logActivity(
        'added',
        'location',
        docRef.id,
        locationData.name,
        currentUser
      );
      
      // Add the new location to the locations state
      const newLocationWithId = { 
        id: docRef.id, 
        ...locationData 
      } as Location;
      
      setLocations([...locations, newLocationWithId]);
      
      // Set the new location as the selected one
      setFormData({ ...formData, locationId: docRef.id });
      
      // Reset form fields but keep form open
      setNewLocation({ name: '', description: '' });
      
    } catch (error) {
      console.error('Error creating location:', error);
      setLocationError('Failed to create location. Please try again.');
    } finally {
      setCreatingLocation(false);
    }
  };
  
  // Handler to create a new provider
  const createProvider = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent any default action
    if (!currentUser) return;
    
    // Validation
    if (!newProvider.name.trim()) {
      setProviderError('Provider name is required');
      return;
    }
    
    try {
      setCreatingProvider(true);
      setProviderError(null);
      
      // Create new provider in Firestore
      const providerData = {
        name: newProvider.name.trim(),
        description: newProvider.description.trim(),
        website: newProvider.website.trim() || null,
        phoneNumber: newProvider.phoneNumber.trim() || null,
        excludeFromReports: newProvider.excludeFromReports || false,
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'providers'), providerData);
      
      // Log the activity
      await logActivity(
        'added',
        'provider',
        docRef.id,
        providerData.name,
        currentUser
      );
      
      // Add the new provider to the providers state
      const newProviderWithId = { 
        id: docRef.id, 
        ...providerData 
      } as Provider;
      
      setProviders([...providers, newProviderWithId]);
      
      // Set the new provider as the selected one
      setFormData({ ...formData, providerId: docRef.id });
      
      // Reset form fields but keep form open
      setNewProvider({ 
        name: '', 
        description: '', 
        website: '', 
        phoneNumber: '',
        excludeFromReports: false
      });
      
    } catch (error) {
      console.error('Error creating provider:', error);
      setProviderError('Failed to create provider. Please try again.');
    } finally {
      setCreatingProvider(false);
    }
  };
  
  // Toggle handlers for showing/hiding forms
  const toggleCategoryForm = () => {
    setShowCategoryForm(!showCategoryForm);
    if (showCategoryForm) {
      setNewCategory({ name: '', description: '' });
      setCategoryError(null);
    }
  };
  
  const toggleProductTypeForm = () => {
    setShowProductTypeForm(!showProductTypeForm);
    if (showProductTypeForm) {
      setNewProductType({ name: '', description: '' });
      setProductTypeError(null);
    }
  };
  
  const toggleLocationForm = () => {
    setShowLocationForm(!showLocationForm);
    if (showLocationForm) {
      setNewLocation({ name: '', description: '' });
      setLocationError(null);
    }
  };
  
  const toggleProviderForm = () => {
    setShowProviderForm(!showProviderForm);
    if (showProviderForm) {
      setNewProvider({ 
        name: '', 
        description: '', 
        website: '', 
        phoneNumber: '',
        excludeFromReports: false
      });
      setProviderError(null);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label htmlFor="name" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Product Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name || ''}
            onChange={handleChange}
            className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="barcode" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Barcode
          </label>
          <div className="relative">
            <input
              type="text"
              id="barcode"
              name="barcode"
              value={formData.barcode || ''}
              onChange={handleChange}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            {checkingWooCommerce && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              </div>
            )}
            {formData.wooCommerceId && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                  WC Linked
                </span>
              </div>
            )}
          </div>
          {checkingWooCommerce && (
            <p className="mt-1 text-xs text-blue-500">Checking for WooCommerce match...</p>
          )}
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="categoryId" className="block text-xs sm:text-sm font-medium text-gray-700">
              Category *
            </label>
            <button
              type="button"
              onClick={toggleCategoryForm}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              {showCategoryForm ? (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  Add New
                </>
              )}
            </button>
          </div>
          
          {!showCategoryForm ? (
            <select
              id="categoryId"
              name="categoryId"
              value={formData.categoryId || ''}
              onChange={handleChange}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            >
              <option value="">Select a category</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name} {category.default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50 mb-2">
              <h4 className="text-xs font-medium mb-2">Add New Category</h4>
              {/* Removed the form tag that was causing issues */}
              <div className="space-y-2">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={newCategory.name}
                    onChange={handleCategoryChange}
                    placeholder="Category name"
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <textarea
                    name="description"
                    value={newCategory.description}
                    onChange={handleCategoryChange}
                    placeholder="Description (optional)"
                    rows={2}
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {categoryError && (
                  <div className="text-xs text-red-500">{categoryError}</div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button" // Changed to button type
                    onClick={createCategory} // Use onClick instead of onSubmit
                    disabled={creatingCategory}
                    className="inline-flex items-center px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {creatingCategory ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Category'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="typeId" className="block text-xs sm:text-sm font-medium text-gray-700">
              Product Type *
            </label>
            <button
              type="button"
              onClick={toggleProductTypeForm}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              {showProductTypeForm ? (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  Add New
                </>
              )}
            </button>
          </div>
          
          {!showProductTypeForm ? (
            <select
              id="typeId"
              name="typeId"
              value={formData.typeId || ''}
              onChange={handleChange}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            >
              <option value="">Select a product type</option>
              {productTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name} {type.default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50 mb-2">
              <h4 className="text-xs font-medium mb-2">Add New Product Type</h4>
              {/* Removed the form tag that was causing issues */}
              <div className="space-y-2">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={newProductType.name}
                    onChange={handleProductTypeChange}
                    placeholder="Product type name"
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <textarea
                    name="description"
                    value={newProductType.description}
                    onChange={handleProductTypeChange}
                    placeholder="Description (optional)"
                    rows={2}
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {productTypeError && (
                  <div className="text-xs text-red-500">{productTypeError}</div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button" // Changed to button type
                    onClick={createProductType} // Use onClick instead of onSubmit
                    disabled={creatingProductType}
                    className="inline-flex items-center px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {creatingProductType ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Product Type'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="locationId" className="block text-xs sm:text-sm font-medium text-gray-700">
              Location *
            </label>
            <button
              type="button"
              onClick={toggleLocationForm}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              {showLocationForm ? (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  Add New
                </>
              )}
            </button>
          </div>
          
          {!showLocationForm ? (
            <select
              id="locationId"
              name="locationId"
              value={formData.locationId || ''}
              onChange={handleChange}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              required
            >
              <option value="">Select a location</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name} {location.default ? "(Default)" : ""}
                </option>
              ))}
            </select>
          ) : (
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50 mb-2">
              <h4 className="text-xs font-medium mb-2">Add New Location</h4>
              {/* Removed the form tag that was causing issues */}
              <div className="space-y-2">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={newLocation.name}
                    onChange={handleLocationChange}
                    placeholder="Location name"
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <textarea
                    name="description"
                    value={newLocation.description}
                    onChange={handleLocationChange}
                    placeholder="Description (optional)"
                    rows={2}
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                {locationError && (
                  <div className="text-xs text-red-500">{locationError}</div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button" // Changed to button type
                    onClick={createLocation} // Use onClick instead of onSubmit
                    disabled={creatingLocation}
                    className="inline-flex items-center px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {creatingLocation ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Location'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="providerId" className="block text-xs sm:text-sm font-medium text-gray-700">
              Provider
            </label>
            <button
              type="button"
              onClick={toggleProviderForm}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center"
            >
              {showProviderForm ? (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3 mr-1" />
                  Add New
                </>
              )}
            </button>
          </div>
          
          {!showProviderForm ? (
            <select
              id="providerId"
              name="providerId"
              value={formData.providerId || ''}
              onChange={handleChange}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a provider</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50 mb-2">
              <h4 className="text-xs font-medium mb-2">Add New Provider</h4>
              {/* Removed the form tag that was causing issues */}
              <div className="space-y-2">
                <div>
                  <input
                    type="text"
                    name="name"
                    value={newProvider.name}
                    onChange={handleProviderChange}
                    placeholder="Provider name"
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <textarea
                    name="description"
                    value={newProvider.description}
                    onChange={handleProviderChange}
                    placeholder="Description (optional)"
                    rows={2}
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <input
                    type="url"
                    name="website"
                    value={newProvider.website}
                    onChange={handleProviderChange}
                    placeholder="Website (optional)"
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <input
                    type="tel"
                    name="phoneNumber"
                    value={newProvider.phoneNumber}
                    onChange={handleProviderChange}
                    placeholder="Phone number (optional)"
                    className="block w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="excludeFromReports"
                    name="excludeFromReports"
                    checked={newProvider.excludeFromReports}
                    onChange={handleProviderChange}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="excludeFromReports" className="ml-2 block text-xs text-gray-700">
                    Exclude from reports
                  </label>
                </div>
                <p className="text-xs text-gray-500">
                  Products from this provider will still be tracked but won't appear in provider-based reports.
                </p>
                {providerError && (
                  <div className="text-xs text-red-500">{providerError}</div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button" // Changed to button type
                    onClick={createProvider} // Use onClick instead of onSubmit
                    disabled={creatingProvider}
                    className="inline-flex items-center px-2 py-1 text-xs text-white bg-indigo-600 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {creatingProvider ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Provider'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div>
          <label htmlFor="quantity" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Quantity *
          </label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={formData.quantity || 0}
            onChange={handleChange}
            min="0"
            className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="minQuantity" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Minimum Quantity *
          </label>
          <input
            type="number"
            id="minQuantity"
            name="minQuantity"
            value={formData.minQuantity || 0}
            onChange={handleChange}
            min="0"
            className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="cost" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Cost Price (RON)
          </label>
          <input
            type="number"
            id="cost"
            name="cost"
            value={formData.cost || 0}
            onChange={handleChange}
            min="0"
            step="0.01"
            className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        
        <div>
          <label htmlFor="price" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            Selling Price (RON) *
          </label>
          <input
            type="number"
            id="price"
            name="price"
            value={formData.price || 0}
            onChange={handleChange}
            min="0"
            step="0.01"
            className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="vatPercentage" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
            VAT Percentage (%) *
          </label>
          <input
            type="number"
            id="vatPercentage"
            name="vatPercentage"
            value={formData.vatPercentage || 19}
            onChange={handleChange}
            min="0"
            max="100"
            step="1"
            className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
      </div>

      {/* WooCommerce ID display */}
      {formData.wooCommerceId && (
        <div className="bg-indigo-50 p-2 rounded-md border border-indigo-100">
          <p className="text-xs text-indigo-800 flex items-center">
            <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
            This product is linked to WooCommerce product ID: {formData.wooCommerceId}
          </p>
          <p className="text-xs text-indigo-600 mt-1">
            Stock changes will automatically sync with your WooCommerce store.
          </p>
        </div>
      )}
      
      <div>
        <label htmlFor="description" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          rows={3}
          className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        ></textarea>
      </div>
      
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-md text-xs sm:text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          {initialData?.id ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </form>
  );
};

export default ProductForm;