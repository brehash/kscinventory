import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, deleteDoc, doc, addDoc, updateDoc, getDoc, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product, ProductCategory, Location, ProductType, Provider, PriceHistory } from '../../types';
import { 
  Search, 
  Plus, 
  Filter, 
  ArrowUp, 
  ArrowDown, 
  Edit, 
  Trash,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Modal from '../ui/Modal';
import ProductForm from './ProductForm';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { Link } from 'react-router-dom';
import ReactPaginate from 'react-paginate';

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Product>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);
  const [lastVisibleProduct, setLastVisibleProduct] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const { currentUser } = useAuth();

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
        
        // Fetch products
        await fetchProducts(0);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  const fetchProducts = async (page = 0) => {
    try {
      setLoading(true);
      
      // Create the base query collection
      let productsRef = collection(db, 'products');
      let baseQuery = productsRef;
      
      // Add filters if selected
      const filters = [];
      
      if (selectedCategory) {
        filters.push(where('categoryId', '==', selectedCategory));
      }
      
      if (selectedLocation) {
        filters.push(where('locationId', '==', selectedLocation));
      }
      
      if (selectedProvider) {
        filters.push(where('providerId', '==', selectedProvider));
      }
      
      // If we have filters, apply them to the baseQuery
      if (filters.length > 0) {
        baseQuery = query(productsRef, ...filters);
      }
      
      // Get total count for pagination
      const countSnapshot = await getCountFromServer(baseQuery);
      const totalCount = countSnapshot.data().count;
      setTotalProducts(totalCount);
      setPageCount(Math.ceil(totalCount / itemsPerPage));
      
      // Create the paged query
      let productsQuery;
      
      // Set up pagination query
      if (page === 0) {
        // First page
        productsQuery = query(
          baseQuery,
          orderBy(sortField, sortDirection),
          limit(itemsPerPage)
        );
      } else if (lastVisibleProduct) {
        // Subsequent pages
        productsQuery = query(
          baseQuery,
          orderBy(sortField, sortDirection),
          startAfter(lastVisibleProduct),
          limit(itemsPerPage)
        );
      } else {
        // If we lost our lastVisibleProduct reference, start from beginning
        productsQuery = query(
          baseQuery,
          orderBy(sortField, sortDirection),
          limit(itemsPerPage)
        );
        setCurrentPage(0);
      }
      
      const productsSnapshot = await getDocs(productsQuery);
      
      if (productsSnapshot.empty) {
        setProducts([]);
        setFilteredProducts([]);
        setLoading(false);
        return;
      }
      
      // Save the last document for pagination
      setLastVisibleProduct(productsSnapshot.docs[productsSnapshot.docs.length - 1]);
      
      let productsData = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      // Apply search filter (client-side)
      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        productsData = productsData.filter(product => 
          product.name.toLowerCase().includes(lowerCaseQuery) || 
          (product.barcode && product.barcode.toLowerCase().includes(lowerCaseQuery)) ||
          product.description.toLowerCase().includes(lowerCaseQuery)
        );
      }
      
      setProducts(productsData);
      setFilteredProducts(productsData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  };

  // Handler for page change
  const handlePageClick = (event: { selected: number }) => {
    const newPage = event.selected;
    setCurrentPage(newPage);
    fetchProducts(newPage);
  };

  // Add keyboard navigation for pagination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentPage > 0) {
        e.preventDefault();
        handlePageClick({ selected: currentPage - 1 });
      } else if (e.key === 'ArrowRight' && currentPage < pageCount - 1) {
        e.preventDefault();
        handlePageClick({ selected: currentPage + 1 });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage, pageCount]);

  useEffect(() => {
    if (!loading) {
      setCurrentPage(0);
      setLastVisibleProduct(null);
      fetchProducts(0);
    }
  }, [searchQuery, selectedCategory, selectedLocation, selectedProvider, sortField, sortDirection]);
  
  // Apply search filter immediately on searchQuery change
  useEffect(() => {
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const filtered = products.filter(product => 
        product.name.toLowerCase().includes(lowerCaseQuery) || 
        (product.barcode && product.barcode.toLowerCase().includes(lowerCaseQuery)) ||
        product.description.toLowerCase().includes(lowerCaseQuery)
      );
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts(products);
    }
  }, [products, searchQuery]);

  const handleSort = (field: keyof Product) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAddProduct = async (productData: Partial<Product>) => {
    if (!currentUser) return;
    
    try {
      const newProduct = {
        ...productData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, 'products'), newProduct);
      
      // Add the new product to the local state with its ID
      const addedProduct = { id: docRef.id, ...newProduct } as Product;
      setProducts([...products, addedProduct]);
      setFilteredProducts([...filteredProducts, addedProduct]);
      
      // Log the activity
      await logActivity(
        'added', 
        'product', 
        docRef.id, 
        productData.name || 'New Product', 
        currentUser,
        productData.quantity
      );
      
      setShowAddModal(false);
      
      // Refresh products to update pagination
      fetchProducts(currentPage);
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleEditProduct = async (productData: Partial<Product>) => {
    if (!productToEdit || !currentUser) return;
    
    try {
      // Get the original product first
      const productRef = doc(db, 'products', productToEdit.id);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) {
        console.error('Product does not exist');
        return;
      }
      
      const originalProduct = productSnap.data() as Product;
      const newCost = productData.cost !== undefined ? productData.cost : originalProduct.cost;
      const oldCost = originalProduct.cost;
      
      // Check if cost has changed (handling undefined cases)
      const costChanged = newCost !== undefined && oldCost !== undefined && newCost !== oldCost;
      
      // Get provider information for the price history
      let providerName = 'Unknown Provider';
      if (originalProduct.providerId) {
        const providerRef = doc(db, 'providers', originalProduct.providerId);
        const providerSnap = await getDoc(providerRef);
        if (providerSnap.exists()) {
          providerName = providerSnap.data().name;
        }
      }
      
      // Prepare updated product data
      const updatedProduct: Partial<Product> = {
        ...productData,
        updatedAt: new Date()
      };
      
      // If cost changed, update lastCost field
      if (costChanged && oldCost !== undefined) {
        updatedProduct.lastCost = oldCost;
        
        // Calculate change percentage
        const changePercentage = ((newCost as number) - oldCost) / oldCost * 100;
        
        // Create a price history record
        const priceHistoryData: PriceHistory = {
          productId: productToEdit.id,
          oldCost: oldCost,
          newCost: newCost as number,
          changeDate: new Date(),
          userId: currentUser.uid,
          userName: currentUser.displayName || currentUser.email || 'Unknown User',
          providerId: originalProduct.providerId || 'unknown',
          providerName: providerName,
          changePercentage: changePercentage
        };
        
        // Add to priceHistory subcollection
        await addDoc(
          collection(db, `products/${productToEdit.id}/priceHistory`),
          priceHistoryData
        );
      }
      
      // Update the product in Firestore
      await updateDoc(productRef, updatedProduct);
      
      // Update the product in the local state
      const updatedProductFull = { 
        ...productToEdit, 
        ...updatedProduct 
      } as Product;
      
      setProducts(products.map(product => 
        product.id === productToEdit.id 
          ? updatedProductFull
          : product
      ));
      
      setFilteredProducts(filteredProducts.map(product => 
        product.id === productToEdit.id 
          ? updatedProductFull
          : product
      ));
      
      // Log the activity
      await logActivity(
        'updated', 
        'product', 
        productToEdit.id, 
        productData.name || productToEdit.name, 
        currentUser,
        productData.quantity
      );
      
      setShowEditModal(false);
      setProductToEdit(null);
      
      // Refresh products to update pagination
      fetchProducts(currentPage);
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  const handleDelete = async () => {
    if (!productToDelete || !currentUser) return;
    
    try {
      await deleteDoc(doc(db, 'products', productToDelete.id));
      
      // Log the activity
      await logActivity(
        'deleted', 
        'product', 
        productToDelete.id, 
        productToDelete.name, 
        currentUser
      );
      
      setProducts(products.filter(p => p.id !== productToDelete.id));
      setFilteredProducts(filteredProducts.filter(p => p.id !== productToDelete.id));
      setShowDeleteModal(false);
      setProductToDelete(null);
      
      // Recalculate pagination
      setTotalProducts(totalProducts - 1);
      setPageCount(Math.ceil((totalProducts - 1) / itemsPerPage));
      
      // If we deleted the last item on the page, go to previous page
      if (filteredProducts.length === 1 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
        fetchProducts(currentPage - 1);
      } else {
        fetchProducts(currentPage);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleOpenEditModal = (product: Product) => {
    setProductToEdit(product);
    setShowEditModal(true);
  };

  const confirmDelete = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    return location ? location.name : 'Unknown';
  };

  const getProductTypeName = (typeId: string) => {
    const type = productTypes.find(t => t.id === typeId);
    return type ? type.name : 'Unknown';
  };

  const getProviderName = (providerId: string) => {
    if (!providerId) return 'None';
    const provider = providers.find(p => p.id === providerId);
    return provider ? provider.name : 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Products</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your inventory products</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-sm rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-1 sm:mr-2" />
          Add Product
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative inline-block w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="relative inline-block w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </div>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Locations</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="relative inline-block w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </div>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Providers</option>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    <span>Name</span>
                    {sortField === 'name' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="hidden sm:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('barcode')}
                >
                  <div className="flex items-center">
                    <span>Barcode</span>
                    {sortField === 'barcode' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Category
                </th>
                <th 
                  scope="col" 
                  className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Location
                </th>
                <th 
                  scope="col" 
                  className="hidden lg:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Provider
                </th>
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('quantity')}
                >
                  <div className="flex items-center">
                    <span>Qty</span>
                    {sortField === 'quantity' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('price')}
                >
                  <div className="flex items-center">
                    <span>Price</span>
                    {sortField === 'price' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('vatPercentage')}
                >
                  <div className="flex items-center">
                    <span>VAT</span>
                    {sortField === 'vatPercentage' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="relative px-4 sm:px-6 py-2 sm:py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          {/* Added Link around the product name */}
                          <Link 
                            to={`/products/${product.id}`}
                            className="text-xs sm:text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {product.name}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-500">{product.barcode || '-'}</div>
                    </td>
                    <td className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {getCategoryName(product.categoryId)}
                      </span>
                    </td>
                    <td className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      {getLocationName(product.locationId)}
                    </td>
                    <td className="hidden lg:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                        {product.providerId ? getProviderName(product.providerId) : 'None'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {product.quantity <= product.minQuantity && (
                          <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 mr-1" />
                        )}
                        <span className={`text-xs sm:text-sm ${product.quantity <= product.minQuantity ? 'text-amber-500 font-medium' : 'text-gray-500'}`}>
                          {product.quantity}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      {product.price.toFixed(2)} RON
                    </td>
                    <td className="hidden md:table-cell px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      {product.vatPercentage || 0}%
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {/* Added link to product details */}
                        <Link
                          to={`/products/${product.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="View details"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleOpenEditModal(product)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                        <button
                          onClick={() => confirmDelete(product)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 sm:px-6 py-4 text-center text-gray-500">
                    No products found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pageCount > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageClick({ selected: Math.max(0, currentPage - 1) })}
                disabled={currentPage === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageClick({ selected: Math.min(pageCount - 1, currentPage + 1) })}
                disabled={currentPage === pageCount - 1}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{filteredProducts.length > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{' '}
                  <span className="font-medium">
                    {Math.min((currentPage + 1) * itemsPerPage, totalProducts)}
                  </span>{' '}
                  of <span className="font-medium">{totalProducts}</span> products
                </p>
              </div>
              <div>
                <ReactPaginate
                  previousLabel={<ChevronLeft className="h-5 w-5" />}
                  nextLabel={<ChevronRight className="h-5 w-5" />}
                  breakLabel="..."
                  breakClassName="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                  pageCount={pageCount}
                  marginPagesDisplayed={2}
                  pageRangeDisplayed={5}
                  onPageChange={handlePageClick}
                  containerClassName="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                  pageClassName="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  previousClassName="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  nextClassName="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  activeClassName="z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                  forcePage={currentPage}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Add Product Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Product"
      >
        <ProductForm
          onSubmit={handleAddProduct}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>
      
      {/* Edit Product Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setProductToEdit(null);
        }}
        title="Edit Product"
      >
        {productToEdit && (
          <ProductForm
            initialData={productToEdit}
            onSubmit={handleEditProduct}
            onCancel={() => {
              setShowEditModal(false);
              setProductToEdit(null);
            }}
          />
        )}
      </Modal>
      
      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Product"
      >
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-10 w-10 sm:h-10 sm:w-10 rounded-full bg-red-100 sm:mx-0">
            <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <p className="text-xs sm:text-sm text-gray-500">
              Are you sure you want to delete {productToDelete?.name}? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleDelete}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-xs sm:text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(false)}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ProductList;