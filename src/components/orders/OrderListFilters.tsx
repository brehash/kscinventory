import React from 'react';
import { OrderStatus } from '../../types';
import { Search, Filter } from 'lucide-react';

interface OrderListFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedStatus: OrderStatus | '';
  setSelectedStatus: (status: OrderStatus | '') => void;
  clearFilters: () => void;
}

const OrderListFilters: React.FC<OrderListFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  selectedStatus,
  setSelectedStatus,
  clearFilters
}) => {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4 mb-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | '')}
            className="block px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
            <option value="preluata">Preluata</option>
            <option value="pregatita">Pregatita</option>
            <option value="impachetata">Impachetata</option>
            <option value="expediata">Expediata</option>
            <option value="returnata">Returnata</option>
            <option value="refuzata">Refuzata</option>
            <option value="neonorata">Neonorata</option>
          </select>
          
          {(searchQuery || selectedStatus) && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Clear Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderListFilters;