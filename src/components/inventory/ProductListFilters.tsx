import React, { useState, useEffect } from 'react';
import { ProductCategory, Location, Provider } from '../../types';
import { Search, Filter, X } from 'lucide-react';

interface ProductListFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (categoryId: string) => void;
  selectedLocation: string;
  setSelectedLocation: (locationId: string) => void;
  selectedProvider: string;
  setSelectedProvider: (providerId: string) => void;
  categories: ProductCategory[];
  locations: Location[];
  providers: Provider[];
}

const ProductListFilters: React.FC<ProductListFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  selectedLocation,
  setSelectedLocation,
  selectedProvider,
  setSelectedProvider,
  categories,
  locations,
  providers
}) => {
  const [tempSearchQuery, setTempSearchQuery] = useState(searchQuery);

  // Initialize tempSearchQuery with searchQuery
  useEffect(() => {
    setTempSearchQuery(searchQuery);
  }, [searchQuery]);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTempSearchQuery(value);
    
    // Only update the actual search query if it's at least 3 chars or empty
    if (value.trim().length >= 3 || value.trim() === '') {
      setSearchQuery(value);
    }
  };

  // Clear search input
  const handleClearSearch = () => {
    setTempSearchQuery('');
    setSearchQuery('');
  };

  return (
    <div className="p-3 sm:p-4 border-b border-gray-200">
      <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search products (min. 3 chars)..."
            value={tempSearchQuery}
            onChange={handleSearchChange}
            className="block w-full pl-9 sm:pl-10 pr-9 sm:pr-10 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          {tempSearchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
          {tempSearchQuery && tempSearchQuery.length < 3 && tempSearchQuery.length > 0 && (
            <div className="mt-1 text-xs text-amber-600">
              Please enter at least 3 characters to search
            </div>
          )}
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
  );
};

export default ProductListFilters;