import React, { useState, useEffect } from 'react';
import { Calendar, Filter, ArrowDown, Download, Loader2, BarChart2, PieChart, AlertTriangle, CheckCircle } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product, ProductCategory, Location, ProductType, Provider } from '../../types';
import { exportProducts } from '../../utils/reportUtils';
import { useAuth } from '../auth/AuthProvider';
import ReportTooltip from './ReportTooltip';
import FilterTag from './FilterTag';

/**
 * Inventory Reports component to generate and display various inventory-related reports
 */
const InventoryReports: React.FC = () => {
  const { currentUser } = useAuth();
  
  // State for date range
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // State for filters
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedProductType, setSelectedProductType] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [minQuantity, setMinQuantity] = useState<string>('');
  const [maxQuantity, setMaxQuantity] = useState<string>('');
  const [selectedReportType, setSelectedReportType] = useState<string>('stock-value');
  const [selectedExportFormat, setSelectedExportFormat] = useState<'csv' | 'xlsx' | 'pdf' | 'json'>('csv');
  
  // State for data loading
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // State for inventory data
  const [inventoryData, setInventoryData] = useState<Product[]>([]);
  
  // Fetch filter options on component mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        // Fetch categories
        const categoriesSnapshot = await getDocs(collection(db, 'categories'));
        const categoriesData = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProductCategory[];
        setCategories(categoriesData);
        
        // Fetch locations
        const locationsSnapshot = await getDocs(collection(db, 'locations'));
        const locationsData = locationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Location[];
        setLocations(locationsData);
        
        // Fetch product types
        const typesSnapshot = await getDocs(collection(db, 'productTypes'));
        const typesData = typesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ProductType[];
        setProductTypes(typesData);
        
        // Fetch providers
        const providersSnapshot = await getDocs(collection(db, 'providers'));
        const providersData = providersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Provider[];
        setProviders(providersData);
      } catch (error) {
        console.error('Error fetching filter options:', error);
        setError('Failed to load filter options');
      }
    };
    
    fetchFilterOptions();
  }, []);
  
  // Fetch inventory data based on filters
  const generateReport = () => {
    setLoading(true);
    setError(null);
    
    // Create the query
    const fetchInventoryData = async () => {
      try {
        const productsRef = collection(db, 'products');
        let q = query(productsRef);
        
        // Apply filters
        if (selectedCategory) {
          q = query(q, where('categoryId', '==', selectedCategory));
        }
        
        if (selectedLocation) {
          q = query(q, where('locationId', '==', selectedLocation));
        }
        
        if (selectedProductType) {
          q = query(q, where('typeId', '==', selectedProductType));
        }
        
        if (selectedProvider) {
          q = query(q, where('providerId', '==', selectedProvider));
        }
        
        const querySnapshot = await getDocs(q);
        let productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        
        // Apply quantity filters if provided
        if (minQuantity !== '') {
          const min = parseInt(minQuantity);
          if (!isNaN(min)) {
            productsData = productsData.filter(product => product.quantity >= min);
          }
        }
        
        if (maxQuantity !== '') {
          const max = parseInt(maxQuantity);
          if (!isNaN(max)) {
            productsData = productsData.filter(product => product.quantity <= max);
          }
        }
        
        // Sort data based on report type
        if (selectedReportType === 'stock-value') {
          productsData.sort((a, b) => {
            const aValue = (a.cost || 0) * a.quantity;
            const bValue = (b.cost || 0) * b.quantity;
            return bValue - aValue; // Sort by descending value
          });
        } else if (selectedReportType === 'low-stock') {
          productsData.sort((a, b) => {
            const aRatio = a.quantity / a.minQuantity;
            const bRatio = b.quantity / b.minQuantity;
            return aRatio - bRatio; // Sort by ascending ratio
          });
        }
        
        setInventoryData(productsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching inventory data:', error);
        setError('Failed to load inventory data');
        setLoading(false);
      }
    };
    
    fetchInventoryData();
  };
  
  const handleExport = async () => {
    if (!currentUser) {
      setError('You must be logged in to export data');
      return;
    }
    
    setExporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Pass the selectedReportType to exportProducts
      await exportProducts(
        selectedExportFormat,
        true, // includeHeaders
        {
          categoryId: selectedCategory || undefined,
          locationId: selectedLocation || undefined,
          providerId: selectedProvider || undefined,
          typeId: selectedProductType || undefined,
          minQuantity: minQuantity ? parseInt(minQuantity) : undefined,
          maxQuantity: maxQuantity ? parseInt(maxQuantity) : undefined,
          startDate,
          endDate
        },
        currentUser,
        selectedReportType // Pass the selected report type
      );
      
      setSuccess(`${selectedReportType.replace('-', ' ')} report exported successfully as ${selectedExportFormat.toUpperCase()}.`);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  
  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedLocation('');
    setSelectedProductType('');
    setSelectedProvider('');
    setMinQuantity('');
    setMaxQuantity('');
  };
  
  // Report type options
  const reportTypes = [
    { id: 'stock-value', name: 'Stock Value Report', description: 'Total value of inventory by product, category, or location' },
    { id: 'stock-movement', name: 'Stock Movement Report', description: 'Tracks changes in inventory quantities over time' },
    { id: 'low-stock', name: 'Low Stock Report', description: 'Products below their minimum quantity threshold' },
    { id: 'valuation', name: 'Inventory Valuation Report', description: 'Current value of inventory using different valuation methods' },
  ];
  
  // Export format options
  const exportFormats = [
    { id: 'csv', name: 'CSV', description: 'Comma-separated values, opens with Excel or Numbers' },
    { id: 'xlsx', name: 'Excel', description: 'Native Microsoft Excel format with formatting' },
    { id: 'pdf', name: 'PDF', description: 'Portable Document Format for viewing and printing' },
    { id: 'json', name: 'JSON', description: 'Structured data format for developers' }
  ];
  
  // Get category name by ID
  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'Unknown';
  };
  
  // Get location name by ID
  const getLocationName = (locationId: string) => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : 'Unknown';
  };
  
  // Get product type name by ID
  const getProductTypeName = (typeId: string) => {
    const type = productTypes.find(t => t.id === typeId);
    return type ? type.name : 'Unknown';
  };
  
  // Get provider name by ID
  const getProviderName = (providerId: string) => {
    if (!providerId) return 'None';
    const provider = providers.find(p => p.id === providerId);
    return provider ? provider.name : 'Unknown';
  };
  
  // Check if any filter is active
  const hasActiveFilters = () => {
    return selectedCategory !== '' || 
           selectedLocation !== '' || 
           selectedProductType !== '' || 
           selectedProvider !== '' || 
           minQuantity !== '' || 
           maxQuantity !== '';
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Inventory Reports</h1>
        <p className="text-sm sm:text-base text-gray-600">Generate detailed reports about your inventory status and value</p>
      </div>
      
      {/* Error and Success Messages */}
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
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}
      
      {/* Report Type Selection */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Select Report Type</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reportTypes.map((report) => (
            <div 
              key={report.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                selectedReportType === report.id
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => setSelectedReportType(report.id)}
            >
              <div className="flex items-start">
                <div className={`p-2 rounded-full ${
                  selectedReportType === report.id
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-500'
                } mr-3`}>
                  {report.id === 'stock-value' && <BarChart2 className="h-5 w-5" />}
                  {report.id === 'stock-movement' && <ArrowDown className="h-5 w-5" />}
                  {report.id === 'low-stock' && <Filter className="h-5 w-5" />}
                  {report.id === 'valuation' && <PieChart className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-sm font-medium">{report.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Report Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold">Report Filters</h2>
          
          {hasActiveFilters() && (
            <button
              onClick={clearFilters}
              className="text-sm text-indigo-600 hover:text-indigo-900"
            >
              Clear All Filters
            </button>
          )}
        </div>
        
        {/* Active Filters */}
        {hasActiveFilters() && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedCategory && (
              <FilterTag
                label="Category"
                value={getCategoryName(selectedCategory)}
                onRemove={() => setSelectedCategory('')}
                color="blue"
              />
            )}
            
            {selectedLocation && (
              <FilterTag
                label="Location"
                value={getLocationName(selectedLocation)}
                onRemove={() => setSelectedLocation('')}
                color="green"
              />
            )}
            
            {selectedProductType && (
              <FilterTag
                label="Product Type"
                value={getProductTypeName(selectedProductType)}
                onRemove={() => setSelectedProductType('')}
                color="purple"
              />
            )}
            
            {selectedProvider && (
              <FilterTag
                label="Provider"
                value={getProviderName(selectedProvider)}
                onRemove={() => setSelectedProvider('')}
                color="amber"
              />
            )}
            
            {minQuantity && (
              <FilterTag
                label="Min Quantity"
                value={minQuantity}
                onRemove={() => setMinQuantity('')}
                color="indigo"
              />
            )}
            
            {maxQuantity && (
              <FilterTag
                label="Max Quantity"
                value={maxQuantity}
                onRemove={() => setMaxQuantity('')}
                color="red"
              />
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline h-4 w-4 mr-1 text-gray-500" />
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline h-4 w-4 mr-1 text-gray-500" />
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Category
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Filter products by their assigned category"
                  position="top"
                />
              </div>
            </div>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Location
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Filter products by their storage location"
                  position="top"
                />
              </div>
            </div>
            <select
              id="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Locations</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="productType" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Product Type
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Filter products by their type classification"
                  position="top"
                />
              </div>
            </div>
            <select
              id="productType"
              value={selectedProductType}
              onChange={(e) => setSelectedProductType(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Product Types</option>
              {productTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Provider
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Filter products by their supplier or vendor"
                  position="top"
                />
              </div>
            </div>
            <select
              id="provider"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Providers</option>
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>{provider.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="minQuantity" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Min Quantity
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Show only products with quantity at or above this value"
                  position="top"
                />
              </div>
            </div>
            <input
              type="number"
              id="minQuantity"
              value={minQuantity}
              onChange={(e) => setMinQuantity(e.target.value)}
              min="0"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="maxQuantity" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Max Quantity
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Show only products with quantity at or below this value"
                  position="top"
                />
              </div>
            </div>
            <input
              type="number"
              id="maxQuantity"
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(e.target.value)}
              min="0"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-4 mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Export Format</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {exportFormats.map(format => (
              <div 
                key={format.id}
                className={`border rounded-lg p-2 text-center cursor-pointer ${
                  selectedExportFormat === format.id 
                    ? 'bg-indigo-50 border-indigo-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedExportFormat(format.id as any)}
              >
                <div className="text-xs font-medium">{format.name}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleExport}
            disabled={exporting || inventoryData.length === 0}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </>
            )}
          </button>
          
          <button
            onClick={generateReport}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Generating...
              </>
            ) : (
              <>
                <BarChart2 className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Report Results */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold">Report Results</h2>
          <div className="text-sm text-gray-500">
            {inventoryData.length > 0 ? `${inventoryData.length} items found` : 'No data to display'}
          </div>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" />
            <span className="text-gray-500">Generating report...</span>
          </div>
        ) : inventoryData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <BarChart2 className="h-12 w-12 text-gray-300 mb-3" />
            <p>No data to display. Please generate a report.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Selling Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Retail Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inventoryData.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getCategoryName(product.categoryId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getLocationName(product.locationId)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {getProviderName(product.providerId || '')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={product.quantity <= product.minQuantity ? 'text-amber-500 font-semibold' : ''}>
                        {product.quantity}
                      </span>
                      {product.quantity <= product.minQuantity && (
                        <span className="ml-1 text-xs text-amber-500">
                          (Low Stock)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.cost ? `${product.cost.toFixed(2)} RON` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.cost ? `${(product.cost * product.quantity).toFixed(2)} RON` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.price.toFixed(2)} RON
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(product.price * product.quantity).toFixed(2)} RON
                    </td>
                  </tr>
                ))}
              </tbody>
              {inventoryData.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      Totals
                    </td>
                    <td colSpan={3} className="px-6 py-3"></td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 font-medium">
                      {inventoryData.reduce((sum, product) => sum + product.quantity, 0)}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                      -
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {inventoryData.reduce((sum, product) => sum + (product.cost || 0) * product.quantity, 0).toFixed(2)} RON
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                      -
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {inventoryData.reduce((sum, product) => sum + product.price * product.quantity, 0).toFixed(2)} RON
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">About Inventory Reports</h3>
        <p className="text-sm text-blue-700">
          Inventory reports provide insights about your stock levels, value, and movements. Use these reports to make informed decisions about purchasing, pricing, and inventory management.
        </p>
      </div>
    </div>
  );
};

export default InventoryReports;
