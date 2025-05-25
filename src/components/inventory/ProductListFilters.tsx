import React, { useRef, useState, useEffect } from 'react';
import { ProductCategory, Location, Provider } from '../../types';
import { Search, Filter } from 'lucide-react';

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(searchQuery);

  // Keep focus on input after search triggers
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Only search if empty or at least 3 characters
    if (inputValue === '' || inputValue.length >= 3) {
      setSearchQuery(inputValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // Only search if empty or at least 3 characters
      if (inputValue === '' || inputValue.length >= 3) {
        setSearchQuery(inputValue);
      } else if (inputValue.length > 0 && inputValue.length < 3) {
        // Show a visual cue that the search needs more characters
        e.currentTarget.classList.add('border-red-500');
        setTimeout(() => {
          e.currentTarget.classList.remove('border-red-500');
        }, 500);
      }
    }
  };

  return (
    <div className="p-3 sm:p-4 border-b border-gray-200">
      <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <form onSubmit={handleSearch}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name or barcode (min 3 chars). Press Enter to search."
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              ref={searchInputRef}
              className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </form>
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