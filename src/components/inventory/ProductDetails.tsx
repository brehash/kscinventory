import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product, ProductCategory, ProductType, Location, Provider, PriceHistory } from '../../types';
import { 
  ArrowLeft, 
  AlertTriangle, 
  Edit, 
  ShoppingBag, 
  Globe, 
  Phone,
  TrendingUp,
  TrendingDown,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import PriceHistoryTable from './PriceHistoryTable';
import ProductActivityLog from '../activity/ProductActivityLog';

const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<ProductCategory | null>(null);
  const [productType, setProductType] = useState<ProductType | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [recentPriceChange, setRecentPriceChange] = useState<PriceHistory | null>(null);
  const [hasPriceHistory, setHasPriceHistory] = useState(false);

  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!id) return;

      try {
        const productDoc = await getDoc(doc(db, 'products', id));
        
        if (!productDoc.exists()) {
          setError('Product not found');
          setLoading(false);
          return;
        }
        
        const productData = { id: productDoc.id, ...productDoc.data() } as Product;
        setProduct(productData);
        
        // Fetch related data
        const categoryDoc = await getDoc(doc(db, 'categories', productData.categoryId));
        if (categoryDoc.exists()) {
          setCategory({ id: categoryDoc.id, ...categoryDoc.data() } as ProductCategory);
        }
        
        const typeDoc = await getDoc(doc(db, 'productTypes', productData.typeId));
        if (typeDoc.exists()) {
          setProductType({ id: typeDoc.id, ...typeDoc.data() } as ProductType);
        }
        
        const locationDoc = await getDoc(doc(db, 'locations', productData.locationId));
        if (locationDoc.exists()) {
          setLocation({ id: locationDoc.id, ...locationDoc.data() } as Location);
        }
        
        // Fetch provider data only if providerId exists
        if (productData.providerId) {
          const providerDoc = await getDoc(doc(db, 'providers', productData.providerId));
          if (providerDoc.exists()) {
            setProvider({ id: providerDoc.id, ...providerDoc.data() } as Provider);
          }
        }
        
        // Check if product has price history and get most recent change
        const priceHistoryRef = collection(db, `products/${id}/priceHistory`);
        const q = query(priceHistoryRef, orderBy('changeDate', 'desc'), limit(1));
        const historySnapshot = await getDocs(q);
        
        if (!historySnapshot.empty) {
          setHasPriceHistory(true);
          const recentChange = {
            id: historySnapshot.docs[0].id,
            ...historySnapshot.docs[0].data(),
            changeDate: historySnapshot.docs[0].data().changeDate?.toDate() || new Date()
          } as PriceHistory;
          
          setRecentPriceChange(recentChange);
        } else {
          setHasPriceHistory(false);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching product details:', err);
        setError('Failed to load product details');
        setLoading(false);
      }
    };

    fetchProductDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 sm:h-16 sm:w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">{error || 'Product not found'}</h2>
          <p className="text-gray-600 mb-4">The product you are looking for could not be found.</p>
          <button
            onClick={() => navigate('/products')}
            className="inline-flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  // Calculate total value including VAT
  // Handle the case where cost might be undefined
  const cost = product.cost !== undefined ? product.cost : 0;
  const vatAmount = (product.price * product.quantity) * (product.vatPercentage / 100);
  const totalWithVat = (product.price * product.quantity) + vatAmount;
  
  // Calculate price change percentage if lastCost exists
  const hasCostChanged = product.lastCost !== undefined && product.cost !== undefined;
  let costChangePercent = 0;
  let costIncreased = false;

  if (hasCostChanged && product.lastCost !== undefined && product.cost !== undefined && product.lastCost > 0) {
    costChangePercent = ((product.cost - product.lastCost) / product.lastCost) * 100;
    costIncreased = costChangePercent > 0;
  }

  return (
    <div>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/products')}
            className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">{product.name}</h1>
            <p className="text-xs sm:text-base text-gray-600">Product Details</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/products/${id}/edit`)}
          className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Edit Product
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Barcode</h3>
              <p className="text-xs sm:text-sm text-gray-900">{product.barcode || 'Not available'}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Category</h3>
              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                {category?.name || 'Unknown'}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Type</h3>
              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                {productType?.name || 'Unknown'}
              </span>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Location</h3>
              <p className="text-xs sm:text-sm text-gray-900">{location?.name || 'Unknown'}</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Provider Information</h2>
          {provider ? (
            <div className="bg-indigo-50 p-3 sm:p-4 rounded-lg">
              <div className="flex items-center mb-2 sm:mb-3">
                <div className="rounded-full bg-indigo-100 p-1.5 sm:p-2 mr-2 sm:mr-3">
                  <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                </div>
                <h3 className="text-base sm:text-lg font-medium text-gray-900">{provider.name}</h3>
              </div>
              
              {provider.description && (
                <p className="text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">{provider.description}</p>
              )}
              
              <div className="flex flex-col sm:flex-row sm:space-x-8">
                {provider.website && (
                  <a 
                    href={provider.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 mb-1 sm:mb-0"
                  >
                    <Globe className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    Visit Website
                  </a>
                )}
                
                {provider.phoneNumber && (
                  <div className="flex items-center text-xs sm:text-sm text-gray-700">
                    <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    {provider.phoneNumber}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500 italic">No provider information available</p>
          )}
        </div>
        
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Inventory Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Current Quantity</h3>
              <div className="flex items-center">
                {product.quantity <= product.minQuantity && (
                  <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 mr-1" />
                )}
                <p className={`text-base sm:text-lg font-semibold ${
                  product.quantity <= product.minQuantity ? 'text-amber-500' : 'text-gray-900'
                }`}>
                  {product.quantity}
                </p>
              </div>
              {product.quantity <= product.minQuantity && (
                <p className="text-xs text-amber-500 mt-1">
                  Below minimum quantity ({product.minQuantity})
                </p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Minimum Quantity</h3>
              <p className="text-base sm:text-lg font-semibold text-gray-900">{product.minQuantity}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Total Cost Value</h3>
              <p className="text-base sm:text-lg font-semibold text-gray-900">
                {(product.quantity * (product.cost || 0)).toFixed(2)} RON
              </p>
            </div>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Pricing Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Cost Price</h3>
              <div className="flex items-center">
                <p className="text-base sm:text-lg font-semibold text-gray-900 mr-2">
                  {product.cost !== undefined ? `${product.cost.toFixed(2)} RON` : 'Not set'}
                </p>
                
                {hasCostChanged && (
                  <div className={`flex items-center text-xs rounded-full px-2 py-1 ${
                    costIncreased ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {costIncreased ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    <span>{Math.abs(costChangePercent).toFixed(2)}% {costIncreased ? 'increase' : 'decrease'}</span>
                  </div>
                )}
              </div>
              
              {hasCostChanged && (
                <p className="text-xs text-gray-500 mt-1">
                  Previous cost: {product.lastCost?.toFixed(2)} RON
                </p>
              )}
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Selling Price</h3>
              <p className="text-base sm:text-lg font-semibold text-gray-900">{product.price.toFixed(2)} RON</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">VAT Percentage</h3>
              <p className="text-base sm:text-lg font-semibold text-gray-900">{product.vatPercentage || 0}%</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">Profit Margin</h3>
              <p className="text-base sm:text-lg font-semibold text-gray-900">
                {product.cost !== undefined && product.cost > 0 
                  ? `${(((product.price - product.cost) / product.cost) * 100).toFixed(2)}%` 
                  : 'N/A'}
              </p>
            </div>
          </div>

          <div className="mt-4 sm:mt-6 bg-gray-50 p-3 sm:p-4 rounded-lg">
            <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Total Value Calculation</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div>
                <p className="text-gray-500">Base Value (without VAT):</p>
                <p className="font-medium">{(product.price * product.quantity).toFixed(2)} RON</p>
              </div>
              <div>
                <p className="text-gray-500">VAT Amount ({product.vatPercentage || 0}%):</p>
                <p className="font-medium">{vatAmount.toFixed(2)} RON</p>
              </div>
              <div>
                <p className="text-gray-500">Total Value (with VAT):</p>
                <p className="font-bold">{totalWithVat.toFixed(2)} RON</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Price History Section */}
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800">Price Change History</h2>
            {hasPriceHistory && (
              <button 
                onClick={() => setShowPriceHistory(!showPriceHistory)}
                className="inline-flex items-center text-xs sm:text-sm text-indigo-600 hover:text-indigo-800"
              >
                <History className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                {showPriceHistory ? 'Hide History' : 'View History'}
                {showPriceHistory ? (
                  <ChevronUp className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                ) : (
                  <ChevronDown className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </button>
            )}
          </div>
          
          {hasPriceHistory ? (
            <>
              {recentPriceChange && !showPriceHistory && (
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mb-3">
                  <h3 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Most Recent Price Change</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm">
                      <span className="text-gray-500">Changed from </span>
                      <span className="font-medium">{recentPriceChange.oldCost.toFixed(2)} RON</span>
                      <span className="text-gray-500"> to </span>
                      <span className="font-medium">{recentPriceChange.newCost.toFixed(2)} RON</span>
                    </div>
                    
                    <div className="flex items-center">
                      <div className={`flex items-center text-xs rounded-full px-2 py-0.5 ${
                        recentPriceChange.changePercentage > 0 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {recentPriceChange.changePercentage > 0 ? (
                          <TrendingUp className="h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="h-3 w-3 mr-1" />
                        )}
                        {Math.abs(recentPriceChange.changePercentage).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {showPriceHistory && id && (
                <PriceHistoryTable productId={id} />
              )}
            </>
          ) : (
            <p className="text-xs sm:text-sm text-gray-500 italic">No price changes have been recorded yet for this product.</p>
          )}
        </div>
        
        {product.description && (
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Description</h2>
            <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-line">{product.description}</p>
          </div>
        )}
        
        {/* Activity Log Section */}
        <div className="p-4 sm:p-6">
          {id && <ProductActivityLog productId={id} />}
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;