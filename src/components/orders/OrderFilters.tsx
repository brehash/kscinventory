import React from 'react';
import { Search, Filter, RefreshCw, AlertTriangle, Calendar } from 'lucide-react';
import { OrderStatus } from '../../types';

interface OrderFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedStatus: OrderStatus | '';
  setSelectedStatus: (status: OrderStatus | '') => void;
  selectedSource: 'manual' | 'woocommerce' | 'all';
  setSelectedSource: (source: 'manual' | 'woocommerce' | 'all') => void;
  showUnidentifiedOnly: boolean;
  setShowUnidentifiedOnly: (show: boolean) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

const OrderFilters: React.FC<OrderFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  selectedStatus,
  setSelectedStatus,
  selectedSource,
  setSelectedSource,
  showUnidentifiedOnly,
  setShowUnidentifiedOnly,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  clearFilters,
  hasActiveFilters
}) => {
  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm mb-4 sm:mb-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 sm:gap-4 mb-4">
        <h2 className="text-base font-semibold text-gray-800 flex items-center">
          <Filter className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-indigo-500" />
          Filter Orders
        </h2>
        
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-900 flex items-center"
          >
            <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            Clear All Filters
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Search Input */}
        <div className="col-span-1 sm:col-span-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
        </div>
        
        {/* Status Filter */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | '')}
            className="block w-full border border-gray-300 rounded-md py-2 pl-3 pr-10 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="preluata">Preluata</option>
            <option value="pregatita">Pregatita</option>
            <option value="impachetata">Impachetata</option>
            <option value="expediata">Expediata</option>
            <option value="completed">Completed</option>
            <option value="on-hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
            <option value="failed">Failed</option>
            <option value="returnata">Returnata</option>
            <option value="refuzata">Refuzata</option>
            <option value="neonorata">Neonorata</option>
          </select>
        </div>
        
        {/* Source Filter */}
        <div>
          <select
            value={selectedSource}
            onChange={(e) => setSelectedSource(e.target.value as 'manual' | 'woocommerce' | 'all')}
            className="block w-full border border-gray-300 rounded-md py-2 pl-3 pr-10 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual Only</option>
            <option value="woocommerce">WooCommerce Only</option>
          </select>
        </div>
        
        {/* Unidentified Items Checkbox */}
        <div className="col-span-1 sm:col-span-2 md:col-span-4 flex items-center">
          <input
            id="showUnidentifiedOnly"
            type="checkbox"
            checked={showUnidentifiedOnly}
            onChange={(e) => setShowUnidentifiedOnly(e.target.checked)}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
          />
          <label htmlFor="showUnidentifiedOnly" className="ml-2 block text-sm text-gray-700 flex items-center">
            <AlertTriangle className="h-4 w-4 text-amber-500 mr-1" />
            Show only orders with unidentified products
          </label>
        </div>
        
        {/* Date Range Filters */}
        <div className="col-span-1 sm:col-span-2 md:col-span-2">
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-gray-400" />
            From Date
          </label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        
        <div className="col-span-1 sm:col-span-2 md:col-span-2">
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            <Calendar className="h-4 w-4 mr-1 text-gray-400" />
            To Date
          </label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>
    </div>
  );
};

export default OrderFilters;