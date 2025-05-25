import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where, deleteDoc, doc, addDoc, updateDoc, getDoc, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product, ProductCategory, ProductType, Location, Provider, PriceHistory } from '../../types';
import { Plus } from 'lucide-react';
import Modal from '../ui/Modal';
import ProductForm from './ProductForm';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';

// Import sub-components
import ProductListFilters from './ProductListFilters';
import ProductTable from './ProductTable';
import ProductPagination from './ProductPagination';
import ProductDeleteConfirmation from './ProductDeleteConfirmation';
import MoveItemModal from './MoveItemModal';

// Create a cache for frequently accessed data
interface Cache {
  products: { [key: string]: Product[] };
  categories: ProductCategory[];
  locations: Location[];
  productTypes: ProductType[];
  providers: Provider[];
  expiresAt: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache lifetime

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
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [productToMove, setProductToMove] = useState<Product | null>(null);

  // Cache state
  const [cache, setCache] = useState<Cache>({
    products: {},
    categories: [],
    locations: [],
    productTypes: [],
    providers: [],
    expiresAt: 0
  });

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Fetch metadata (categories, locations, etc.) once on initial load
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        // Check if we have valid cached metadata
        const now = Date.now();

        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categoriesData = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProductCategory[];
        setCategories(categoriesData);
        
        const typesSnapshot = await getDocs(collection(db, 'productTypes'));
        const typesData = typesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProductType[];
        setProductTypes(typesData);
        
        const locationsSnapshot = await getDocs(collection(db, 'locations'));
        const locationsData = locationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Location[];
        setLocations(locationsData);
        
        const providersSnapshot = await getDocs(collection(db, 'providers'));
        const providersData = providersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Provider[];
        setProviders(providersData);

        // Update cache with new metadata
        setCache(prev => ({
          ...prev,
          categories: categoriesData,
          locations: locationsData,
          productTypes: typesData,
          providers: providersData,
          expiresAt: now + CACHE_TTL
        }));
      } catch (error) {
        console.error('Error fetching metadata:', error);
      }
    };

    fetchMetadata();
  }, []);

  // Initial products fetch
  useEffect(() => {
    fetchProducts(0);
  }, []);

  // Generate a cache key based on current filters and sort settings
  const getCacheKey = () => {
    return `${searchQuery}|${selectedCategory}|${selectedLocation}|${selectedProvider}|${sortField}|${sortDirection}|${currentPage}`;
  };

  const fetchProducts = async (page = 0) => {
    try {
      setLoading(true);
      
      const cacheKey = getCacheKey();
      const now = Date.now();
      
      // Create the base query collection
      let productsRef = collection(db, 'products');
      
      // Apply serverside filters if possible
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
      
      // Create the base query with filters
      let baseQuery = filters.length > 0 
        ? query(productsRef, ...filters)
        : query(productsRef);
      
      // Get all products for search filtering (before pagination)
      let allProductsSnapshot;
      let filteredProductsData: Product[] = [];
      
      if (searchQuery) {
        // Fetch all products matching other filters but without pagination limits
        // This is inefficient but necessary for client-side text search
        allProductsSnapshot = await getDocs(baseQuery);
        
        // Filter products by search query
        const lowerCaseQuery = searchQuery.toLowerCase();
        filteredProductsData = allProductsSnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Product))
          .filter(product => 
            (product.name?.toLowerCase() || '').includes(lowerCaseQuery) ||
            (product.barcode?.toLowerCase() || '').includes(lowerCaseQuery) ||
            (product.description?.toLowerCase() || '').includes(lowerCaseQuery)
          );
        
        // Set total count for pagination based on filtered results
        setTotalProducts(filteredProductsData.length);
        setPageCount(Math.ceil(filteredProductsData.length / itemsPerPage));
        
        // Apply sorting to filtered products
        filteredProductsData.sort((a, b) => {
          if (a[sortField] < b[sortField]) return sortDirection === 'asc' ? -1 : 1;
          if (a[sortField] > b[sortField]) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });
        
        console.log("query: ", searchQuery)
        console.log("filteredProducts: " , filteredProductsData)
        // Get the subset of products for the current page
        const startIndex = page * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedProducts = filteredProductsData.slice(startIndex, endIndex);
        console.log("paginatedProducts: ", paginatedProducts)
        
        setProducts(paginatedProducts);
        setFilteredProducts(paginatedProducts);
        setLoading(false);
        return;
      }
      
      // If no search query, proceed with regular pagination using Firestore
      
      // Get total count for pagination
      const countSnapshot = await getCountFromServer(baseQuery);
      const totalCount = countSnapshot.data().count;
      setTotalProducts(totalCount);
      setPageCount(Math.ceil(totalCount / itemsPerPage));
      
      // Create the paged query
      let productsQuery;
      
      // Set up pagination query with sorting
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
      
      const snapshot = await getDocs(productsQuery);
      
      if (snapshot.empty) {
        setProducts([]);
        setFilteredProducts([]);
        setLoading(false);
        return;
      }
      
      // Save the last document for pagination
      setLastVisibleProduct(snapshot.docs[snapshot.docs.length - 1]);
      
      let productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      setProducts(productsData);
      setFilteredProducts(productsData);
      
      // Update cache with new data
      setCache(prev => ({
        ...prev,
        products: {
          ...prev.products,
          [cacheKey]: productsData
        },
        expiresAt: now + CACHE_TTL
      }));
      
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

  // Handle search query changes
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(0);
    setLastVisibleProduct(null);
    fetchProducts(0);
  };

  const handleSort = (field: keyof Product) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Reset filters and search
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedLocation('');
    setSelectedProvider('');
    setCurrentPage(0);
    setLastVisibleProduct(null);
    fetchProducts(0);
  };

  useEffect(() => {
    if (!loading) {
      setCurrentPage(0);
      setLastVisibleProduct(null);
      fetchProducts(0);
    }
  }, [selectedCategory, selectedLocation, selectedProvider, sortField, sortDirection]);

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
      
      // Invalidate cache
      setCache(prev => ({
        ...prev,
        products: {},
        expiresAt: 0
      }));
      
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
      
      // Invalidate cache
      setCache(prev => ({
        ...prev,
        products: {},
        expiresAt: 0
      }));
      
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
      
      // Invalidate cache
      setCache(prev => ({
        ...prev,
        products: {},
        expiresAt: 0
      }));
      
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

  const handleOpenMoveModal = (product: Product) => {
    setProductToMove(product);
    setShowMoveModal(true);
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

  // Handle move success
  const handleMoveSuccess = (sourceLocationId: string, destinationLocationId: string, quantity: number) => {
    // Invalidate cache
    setCache(prev => ({
      ...prev,
      products: {},
      expiresAt: 0
    }));
    
    // Refresh the products list
    fetchProducts(currentPage);
  };

  if (loading && products.length === 0) {
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
        {/* Filter controls */}
        <ProductListFilters 
          searchQuery={searchQuery}
          setSearchQuery={handleSearch}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          selectedProvider={selectedProvider}
          setSelectedProvider={setSelectedProvider}
          categories={categories}
          locations={locations}
          providers={providers}
          onResetFilters={handleResetFilters}
        />
        
        {/* Product table */}
        <ProductTable 
          filteredProducts={filteredProducts}
          getCategoryName={getCategoryName}
          getLocationName={getLocationName}
          getProductTypeName={getProductTypeName}
          getProviderName={getProviderName}
          sortField={sortField}
          sortDirection={sortDirection}
          handleSort={handleSort}
          handleOpenEditModal={handleOpenEditModal}
          confirmDelete={confirmDelete}
          handleMoveItems={handleOpenMoveModal}
        />
        
        {/* Pagination */}
        <ProductPagination 
          currentPage={currentPage}
          pageCount={pageCount}
          itemsPerPage={itemsPerPage}
          totalProducts={searchQuery ? filteredProducts.length : totalProducts}
          handlePageClick={handlePageClick}
        />
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
      <ProductDeleteConfirmation
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDelete={handleDelete}
        productName={productToDelete?.name}
      />

      {/* Move items modal */}
      <MoveItemModal
        isOpen={showMoveModal}
        onClose={() => {
          setShowMoveModal(false);
          setProductToMove(null);
        }}
        product={productToMove}
        onSuccess={handleMoveSuccess}
      />
    </div>
  );
};

export default ProductList;