import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, orderBy, where, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Client, ClientFilterOptions } from '../../types';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Loader2, UserPlus, SlidersHorizontal, RefreshCw, Check, UserMinus, Users, Building, User, ShoppingBag, DollarSign } from 'lucide-react';
import ClientCard from './ClientCard';
import ReactPaginate from 'react-paginate';

const ClientList: React.FC = () => {
  const navigate = useNavigate();
  
  // State for clients
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [minOrdersFilter, setMinOrdersFilter] = useState<number | ''>('');
  const [minSpentFilter, setMinSpentFilter] = useState<number | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(12); // Show more per page for cards
  const [totalClients, setTotalClients] = useState(0);
  const [lastVisibleClient, setLastVisibleClient] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  
  // Stats
  const [stats, setStats] = useState({
    totalClients: 0,
    activeClients: 0,
    inactiveClients: 0,
    totalOrders: 0,
    totalRevenue: 0
  });
  
  useEffect(() => {
    const fetchClients = async (page = 0) => {
      try {
        setLoading(true);
        setError(null);
        
        // Create the base query collection
        const clientsRef = collection(db, 'clients');
        let baseQuery = clientsRef;
        
        // Apply active filter if selected
        const filters = [];
        
        if (showOnlyActive) {
          filters.push(where('isActive', '==', true));
        }
        
        // Apply filters to the base query
        if (filters.length > 0) {
          baseQuery = query(clientsRef, ...filters);
        }
        
        // Get total count for pagination
        const countSnapshot = await getCountFromServer(baseQuery);
        const totalCount = countSnapshot.data().count;
        setTotalClients(totalCount);
        setPageCount(Math.ceil(totalCount / itemsPerPage));
        
        // Create the paged query
        let clientsQuery;
        
        // Set up pagination query
        if (page === 0) {
          // First page
          clientsQuery = query(
            baseQuery,
            orderBy('name'),
            limit(itemsPerPage)
          );
        } else if (lastVisibleClient) {
          // Subsequent pages
          clientsQuery = query(
            baseQuery,
            orderBy('name'),
            startAfter(lastVisibleClient),
            limit(itemsPerPage)
          );
        } else {
          // If we lost our lastVisibleClient reference, start from beginning
          clientsQuery = query(
            baseQuery,
            orderBy('name'),
            limit(itemsPerPage)
          );
          setCurrentPage(0);
        }
        
        const snapshot = await getDocs(clientsQuery);
        
        if (snapshot.empty) {
          setClients([]);
          setFilteredClients([]);
          setLoading(false);
          return;
        }
        
        // Save the last document for pagination
        setLastVisibleClient(snapshot.docs[snapshot.docs.length - 1]);
        
        // Process client data
        const clientsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            lastOrderDate: data.lastOrderDate?.toDate(),
          } as Client;
        });
        
        setClients(clientsData);
        
        // Collect all unique tags
        const tagsSet = new Set<string>();
        clientsData.forEach(client => {
          if (client.tags) {
            client.tags.forEach(tag => tagsSet.add(tag));
          }
        });
        setAllTags(Array.from(tagsSet));
        
        // Calculate stats
        const statsData = {
          totalClients: totalCount,
          activeClients: clientsData.filter(c => c.isActive).length,
          inactiveClients: clientsData.filter(c => !c.isActive).length,
          totalOrders: clientsData.reduce((sum, c) => sum + c.totalOrders, 0),
          totalRevenue: clientsData.reduce((sum, c) => sum + c.totalSpent, 0)
        };
        
        setStats(statsData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching clients:', err);
        setError('Failed to load clients');
        setLoading(false);
      }
    };

    fetchClients(0);
  }, [showOnlyActive]);

  // Apply search and filter whenever they change
  useEffect(() => {
    applyFilters();
  }, [clients, searchQuery, selectedTags, minOrdersFilter, minSpentFilter]);
  
  // Handle page change
  const handlePageClick = (event: { selected: number }) => {
    const newPage = event.selected;
    setCurrentPage(newPage);
    fetchClients(newPage);
  };
  
  // Function to apply all filters to the client list
  const applyFilters = () => {
    let filtered = [...clients];
    
    // Apply search filter (case insensitive)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(client => 
        client.name.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query) ||
        client.companyName?.toLowerCase().includes(query) ||
        client.phone?.toLowerCase().includes(query)
      );
    }
    
    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(client => 
        client.tags && selectedTags.every(tag => client.tags?.includes(tag))
      );
    }
    
    // Apply minimum orders filter
    if (minOrdersFilter !== '') {
      filtered = filtered.filter(client => client.totalOrders >= minOrdersFilter);
    }
    
    // Apply minimum total spent filter
    if (minSpentFilter !== '') {
      filtered = filtered.filter(client => client.totalSpent >= minSpentFilter);
    }
    
    setFilteredClients(filtered);
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedTags([]);
    setMinOrdersFilter('');
    setMinSpentFilter('');
  };
  
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm sm:text-base text-gray-600">Loading clients...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4">
        <div className="flex items-center">
          <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">CRM Clients</h1>
          <p className="text-sm text-gray-600">Manage your client relationships</p>
        </div>
        <button
          onClick={() => navigate('/crm/clients/new')}
          className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors"
        >
          <UserPlus className="h-4 w-4 mr-1 sm:mr-2" />
          Add New Client
        </button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm text-gray-500">Total Clients</h3>
            <Users className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalClients}</p>
        </div>
        
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm text-gray-500">Active Clients</h3>
            <User className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.activeClients}</p>
        </div>
        
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm text-gray-500">Inactive Clients</h3>
            <UserMinus className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.inactiveClients}</p>
        </div>
        
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm text-gray-500">Total Orders</h3>
            <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalOrders}</p>
        </div>
        
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs sm:text-sm text-gray-500">Total Revenue</h3>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{stats.totalRevenue.toLocaleString()} RON</p>
        </div>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        {/* Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 sm:gap-4 mb-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <SlidersHorizontal className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>
              
              {(searchQuery || selectedTags.length > 0 || minOrdersFilter !== '' || minSpentFilter !== '' || !showOnlyActive) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 rounded-md text-xs sm:text-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Reset
                </button>
              )}
            </div>
          </div>
          
          {showFilters && (
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Status</label>
                  <div className="flex items-center">
                    <input
                      id="showOnlyActive"
                      name="showOnlyActive"
                      type="checkbox"
                      checked={showOnlyActive}
                      onChange={() => setShowOnlyActive(!showOnlyActive)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="showOnlyActive" className="ml-2 block text-sm text-gray-900">
                      Show only active clients
                    </label>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="minOrders" className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Orders
                  </label>
                  <input
                    type="number"
                    id="minOrders"
                    value={minOrdersFilter}
                    onChange={(e) => setMinOrdersFilter(e.target.value ? parseInt(e.target.value) : '')}
                    min="0"
                    placeholder="e.g., 5"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="minSpent" className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Spent (RON)
                  </label>
                  <input
                    type="number"
                    id="minSpent"
                    value={minSpentFilter}
                    onChange={(e) => setMinSpentFilter(e.target.value ? parseInt(e.target.value) : '')}
                    min="0"
                    placeholder="e.g., 1000"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              
              {allTags.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          selectedTags.includes(tag)
                            ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                            : 'bg-gray-100 text-gray-800 border-gray-300'
                        } border hover:bg-indigo-50`}
                      >
                        {selectedTags.includes(tag) && (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Applied filters summary */}
          {(searchQuery || selectedTags.length > 0 || minOrdersFilter !== '' || minSpentFilter !== '' || !showOnlyActive) && (
            <div className="flex flex-wrap gap-2 mb-4">
              {searchQuery && (
                <div className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-md flex items-center">
                  <span>Search: {searchQuery}</span>
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="ml-1.5 text-gray-500 hover:text-gray-700"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              
              {!showOnlyActive && (
                <div className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-md flex items-center">
                  <span>Showing inactive clients</span>
                  <button 
                    onClick={() => setShowOnlyActive(true)}
                    className="ml-1.5 text-gray-500 hover:text-gray-700"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              
              {selectedTags.map(tag => (
                <div key={tag} className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-md flex items-center">
                  <span>Tag: {tag}</span>
                  <button 
                    onClick={() => toggleTag(tag)}
                    className="ml-1.5 text-indigo-500 hover:text-indigo-700"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              
              {minOrdersFilter !== '' && (
                <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md flex items-center">
                  <span>Min Orders: {minOrdersFilter}</span>
                  <button 
                    onClick={() => setMinOrdersFilter('')}
                    className="ml-1.5 text-blue-500 hover:text-blue-700"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              
              {minSpentFilter !== '' && (
                <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-md flex items-center">
                  <span>Min Spent: {minSpentFilter} RON</span>
                  <button 
                    onClick={() => setMinSpentFilter('')}
                    className="ml-1.5 text-green-500 hover:text-green-700"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Clients Grid */}
        {filteredClients.length === 0 ? (
          <div className="text-center py-12">
            {searchQuery || selectedTags.length > 0 || minOrdersFilter !== '' || minSpentFilter !== '' ? (
              <>
                <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No clients found</h3>
                <p className="mt-1 text-sm text-gray-500">Try adjusting your search or filter criteria.</p>
                <button
                  onClick={clearFilters}
                  className="mt-4 inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset Filters
                </button>
              </>
            ) : (
              <>
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No clients yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by adding a new client.</p>
                <div className="mt-6">
                  <button
                    onClick={() => navigate('/crm/clients/new')}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add New Client
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredClients.map(client => (
                <ClientCard 
                  key={client.id}
                  client={client}
                  onClick={() => navigate(`/crm/clients/${client.id}`)}
                />
              ))}
            </div>
            
            {/* Pagination */}
            {pageCount > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 mt-6 sm:px-6">
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
                      Showing <span className="font-medium">{totalClients > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{' '}
                      <span className="font-medium">
                        {Math.min((currentPage + 1) * itemsPerPage, totalClients)}
                      </span>{' '}
                      of <span className="font-medium">{totalClients}</span> clients
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
          </>
        )}
      </div>
    </div>
  );
};

export default ClientList;