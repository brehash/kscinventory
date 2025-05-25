import React, { useRef, useState, useEffect } from 'react';
import { ProductCategory, Location, Provider } from '../../types';
import { Search, Filter, RefreshCw, X, SlidersHorizontal } from 'lucide-react';

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
  onResetFilters: () => void;
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
  providers,
  onResetFilters
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(searchQuery);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Keep focus on input after search triggers
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchQuery]);

  // Update input value when searchQuery prop changes
  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    // Clear error when input changes
    if (searchError) {
      setSearchError(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear existing error
    setSearchError(null);
    
    // If input is empty, clear the search
    if (inputValue === '') {
      setSearchQuery('');
      return;
    }
    
    // Require at least 3 characters for search
    if (inputValue.length < 3) {
      setSearchError('Please enter at least 3 characters to search');
      return;
    }
    
    setSearchQuery(inputValue);
  };

  const handleClearSearch = () => {
    setInputValue('');
    setSearchQuery('');
    setSearchError(null);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Check if any filter is active
  const hasActiveFilters = searchQuery || selectedCategory || selectedLocation || selectedProvider;

  return (
    <div className="p-3 sm:p-4 border-b border-gray-200">
      <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <form onSubmit={handleSearch} className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name or barcode (min 3 chars)"
              value={inputValue}
              onChange={handleInputChange}
              ref={searchInputRef}
              className={`block w-full pl-9 sm:pl-10 pr-12 py-1.5 sm:py-2 text-xs sm:text-sm border ${
                searchError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
              } rounded-md focus:outline-none focus:ring-2`}
            />
            {inputValue && (
              <button 
                type="button" 
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button type="submit" className="sr-only">Search</button>
          </form>
          {searchError && (
            <p className="mt-1 text-xs text-red-500">{searchError}</p>
          )}
        </div>
        
        <div className="flex flex-wrap md:flex-nowrap items-center gap-2">
          <button
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="md:hidden px-3 py-2 bg-gray-100 text-gray-700 rounded-md border border-gray-200 flex items-center"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            <span>Filters</span>
          </button>

          <div className={`${showMobileFilters ? 'flex' : 'hidden'} md:flex flex-col md:flex-row gap-2 w-full md:w-auto`}>
            <div className="relative inline-block w-full md:w-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            
            <div className="relative inline-block w-full md:w-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
              </div>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Filter by location"
              >
                <option value="">All Locations</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </div>
            
            <div className="relative inline-block w-full md:w-auto">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
              </div>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Filter by provider"
              >
                <option value="">All Providers</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
              </select>
            </div>
            
            {hasActiveFilters && (
              <button 
                onClick={onResetFilters}
                className="flex items-center justify-center px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-50 text-indigo-600 rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors"
                aria-label="Reset all filters"
              >
                <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="mt-3 text-xs text-gray-500">
          <p>
            {searchQuery && (
              <span className="inline-block mr-2 mb-1 px-2 py-1 bg-gray-100 rounded-md">
                Search: <span className="font-medium text-indigo-600">{searchQuery}</span>
                <button 
                  onClick={handleClearSearch} 
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X className="inline h-3 w-3" />
                </button>
              </span>
            )}
            {selectedCategory && (
              <span className="inline-block mr-2 mb-1 px-2 py-1 bg-blue-50 rounded-md">
                Category: <span className="font-medium text-blue-600">
                  {categories.find(c => c.id === selectedCategory)?.name || selectedCategory}
                </span>
                <button 
                  onClick={() => setSelectedCategory('')} 
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  aria-label="Clear category filter"
                >
                  <X className="inline h-3 w-3" />
                </button>
              </span>
            )}
            {selectedLocation && (
              <span className="inline-block mr-2 mb-1 px-2 py-1 bg-green-50 rounded-md">
                Location: <span className="font-medium text-green-600">
                  {locations.find(l => l.id === selectedLocation)?.name || selectedLocation}
                </span>
                <button 
                  onClick={() => setSelectedLocation('')} 
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  aria-label="Clear location filter"
                >
                  <X className="inline h-3 w-3" />
                </button>
              </span>
            )}
            {selectedProvider && (
              <span className="inline-block mr-2 mb-1 px-2 py-1 bg-purple-50 rounded-md">
                Provider: <span className="font-medium text-purple-600">
                  {providers.find(p => p.id === selectedProvider)?.name || selectedProvider}
                </span>
                <button 
                  onClick={() => setSelectedProvider('')} 
                  className="ml-1 text-gray-400 hover:text-gray-600"
                  aria-label="Clear provider filter"
                >
                  <X className="inline h-3 w-3" />
                </button>
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default ProductListFilters;