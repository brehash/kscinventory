import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { LowStockAlert, Product } from '../../types';
import { format } from 'date-fns';
import { ArrowLeft, AlertTriangle, Search, Filter, Loader2, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';

const LowStockAlertList: React.FC = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<LowStockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [locations, setLocations] = useState<{id: string, name: string}[]>([]);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<LowStockAlert[]>([]);

  // Fetch low stock alerts
  useEffect(() => {
    const fetchLowStockAlerts = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all products
        const productsRef = collection(db, 'products');
        const productsSnapshot = await getDocs(productsRef);
        const products = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];

        // Filter low stock products
        const lowStockProducts = products.filter(product => 
          product.quantity <= product.minQuantity
        );

        // Fetch locations for these products
        const locationIds = [...new Set(lowStockProducts.map(product => product.locationId))];
        const locationMap = new Map<string, string>();
        
        for (const locationId of locationIds) {
          const locationRef = collection(db, 'locations');
          const q = query(locationRef, where('id', '==', locationId));
          const locationSnapshot = await getDocs(q);
          if (!locationSnapshot.empty) {
            locationMap.set(locationId, locationSnapshot.docs[0].data().name);
          }
        }

        // Fetch all locations and categories for filters
        const locationsSnapshot = await getDocs(collection(db, 'locations'));
        const locationsData = locationsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        setLocations(locationsData);

        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categoriesData = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        setCategories(categoriesData);

        // Create alerts array
        const alertsData: LowStockAlert[] = lowStockProducts.map(product => ({
          id: product.id,
          productId: product.id,
          productName: product.name,
          currentQuantity: product.quantity,
          minQuantity: product.minQuantity,
          locationName: locationMap.get(product.locationId) || 'Unknown',
          locationId: product.locationId,
          categoryId: product.categoryId
        }));

        setAlerts(alertsData);
        setFilteredAlerts(alertsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching low stock alerts:', err);
        setError('Failed to load low stock alerts');
        setLoading(false);
      }
    };

    fetchLowStockAlerts();
  }, []);

  // Apply filters when filter states change
  useEffect(() => {
    if (!loading) {
      let filtered = [...alerts];
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(alert => 
          alert.productName.toLowerCase().includes(query)
        );
      }
      
      // Apply location filter
      if (selectedLocation) {
        filtered = filtered.filter(alert => 
          alert.locationId === selectedLocation
        );
      }
      
      // Apply category filter
      if (selectedCategory) {
        filtered = filtered.filter(alert => 
          alert.categoryId === selectedCategory
        );
      }
      
      setFilteredAlerts(filtered);
    }
  }, [searchQuery, selectedLocation, selectedCategory, alerts, loading]);

  // Calculate severity level for visual indicators
  const getSeverityLevel = (current: number, min: number): 'critical' | 'warning' | 'low' => {
    if (current === 0) return 'critical';
    if (current / min < 0.5) return 'warning';
    return 'low';
  };

  // Get background color based on severity
  const getSeverityColor = (severity: 'critical' | 'warning' | 'low'): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'warning': return 'bg-amber-100 text-amber-800';
      case 'low': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-36 sm:h-48">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-xs sm:text-sm text-gray-600">Loading low stock alerts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mr-2" />
          <p className="text-xs sm:text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center mb-3 sm:mb-4">
        <button
          onClick={() => navigate(-1)}
          className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Low Stock Alerts</h1>
          <p className="text-sm text-gray-600">Products that need to be restocked</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-lg mb-4">
          <h2 className="text-base font-semibold text-gray-800 flex items-center">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-indigo-600" />
            Filter Alerts
          </h2>
          
          <div className="flex space-x-2">
            {(!!selectedLocation || !!selectedCategory || !!searchQuery) && (
              <button
                onClick={() => {
                  setSelectedLocation('');
                  setSelectedCategory('');
                  setSearchQuery('');
                }}
                className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-50 border border-indigo-200 rounded-md text-xs sm:text-sm text-indigo-600 hover:bg-indigo-100"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Locations</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-indigo-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-indigo-800 font-medium">Total Low Stock Items</p>
            <p className="text-lg sm:text-xl font-bold text-indigo-900 mt-1">{alerts.length}</p>
          </div>
          
          <div className="bg-red-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-red-800 font-medium">Out of Stock Items</p>
            <p className="text-lg sm:text-xl font-bold text-red-900 mt-1">
              {alerts.filter(alert => alert.currentQuantity === 0).length}
            </p>
          </div>
          
          <div className="bg-amber-50 p-3 sm:p-4 rounded-lg">
            <p className="text-xs sm:text-sm text-amber-800 font-medium">Critical Low Stock</p>
            <p className="text-lg sm:text-xl font-bold text-amber-900 mt-1">
              {alerts.filter(alert => 
                alert.currentQuantity > 0 && 
                alert.currentQuantity / alert.minQuantity < 0.5
              ).length}
            </p>
          </div>
        </div>

        {/* Alerts list */}
        <div className="divide-y divide-gray-200">
          {filteredAlerts.length > 0 ? (
            filteredAlerts.map(alert => {
              const severity = getSeverityLevel(alert.currentQuantity, alert.minQuantity);
              return (
                <div key={alert.id} className="py-3 sm:py-4 flex items-center justify-between">
                  <div className="flex items-start">
                    <div className={`p-1.5 rounded-full mr-3 ${getSeverityColor(severity)}`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm sm:text-base text-gray-800">{alert.productName}</p>
                      <div className="flex flex-wrap items-center text-xs sm:text-sm text-gray-500 mt-1">
                        <div className={`font-medium ${
                          severity === 'critical' ? 'text-red-700' : 
                          severity === 'warning' ? 'text-amber-700' : 
                          'text-yellow-700'
                        }`}>
                          {alert.currentQuantity} / {alert.minQuantity} minimum
                        </div>
                        <span className="mx-1.5">•</span>
                        <div>{alert.locationName}</div>
                        
                        {severity === 'critical' && (
                          <>
                            <span className="mx-1.5">•</span>
                            <div className="text-red-700 font-medium">
                              {alert.currentQuantity === 0 ? 'OUT OF STOCK' : 'CRITICAL'}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link 
                    to={`/products/${alert.productId}`} 
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Link>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 sm:py-10">
              <AlertTriangle className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No low stock alerts found with the selected filters.</p>
              {(!!selectedLocation || !!selectedCategory || !!searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedLocation('');
                    setSelectedCategory('');
                    setSearchQuery('');
                  }}
                  className="mt-3 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LowStockAlertList;