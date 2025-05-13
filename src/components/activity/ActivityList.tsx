import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ActivityLog, ActivityType, ActivityEntityType } from '../../types';
import { format, parseISO, isValid, isBefore, isAfter, isSameDay } from 'date-fns';
import { Calendar, Filter, ArrowUp, ArrowDown, User, Clock, Activity, AlertCircle, Loader2, Edit, Trash, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactPaginate from 'react-paginate';
import { useNavigate } from 'react-router-dom';

const ActivityList: React.FC = () => {
  const navigate = useNavigate();
  // State for activity logs
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | ''>('');
  const [selectedEntityType, setSelectedEntityType] = useState<ActivityEntityType | ''>('');
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [entityTypes, setEntityTypes] = useState<ActivityEntityType[]>([]);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalActivities, setTotalActivities] = useState(0);
  const [lastVisibleActivity, setLastVisibleActivity] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  
  // Function to fetch activity logs
  useEffect(() => {
    fetchActivities(0);
  }, [sortDirection]);
  
  const fetchActivities = async (page = 0) => {
    if (page === 0) {
      setLastVisibleActivity(null);
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Create the base query collection
      let activitiesRef = collection(db, 'activities');
      let baseQuery = activitiesRef;
      
      // Apply filters
      const filters = [];
      
      // Activity type filter
      if (selectedActivityType) {
        filters.push(where('type', '==', selectedActivityType));
      }
      
      // Entity type filter
      if (selectedEntityType) {
        filters.push(where('entityType', '==', selectedEntityType));
      }
      
      // User filter
      if (selectedUser) {
        filters.push(where('userId', '==', selectedUser));
      }
      
      // Date range filters
      if (startDate && isValid(parseISO(startDate))) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0); // Start of day
        filters.push(where('date', '>=', startDateObj));
      }
      
      if (endDate && isValid(parseISO(endDate))) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999); // End of day
        filters.push(where('date', '<=', endDateObj));
      }
      
      // Apply filters to the base query
      if (filters.length > 0) {
        baseQuery = query(activitiesRef, ...filters);
      }
      
      // Get total count for pagination
      const countSnapshot = await getCountFromServer(baseQuery);
      const totalCount = countSnapshot.data().count;
      setTotalActivities(totalCount);
      setPageCount(Math.ceil(totalCount / itemsPerPage));
      
      // Create the paged query
      let activitiesQuery;
      
      // Set up pagination query
      if (page === 0) {
        // First page
        activitiesQuery = query(
          baseQuery,
          orderBy('date', sortDirection),
          limit(itemsPerPage)
        );
      } else if (lastVisibleActivity) {
        // Subsequent pages
        activitiesQuery = query(
          baseQuery,
          orderBy('date', sortDirection),
          startAfter(lastVisibleActivity),
          limit(itemsPerPage)
        );
      } else {
        // If we lost our lastVisibleActivity reference, start from beginning
        activitiesQuery = query(
          baseQuery,
          orderBy('date', sortDirection),
          limit(itemsPerPage)
        );
        setCurrentPage(0);
      }
      
      const snapshot = await getDocs(activitiesQuery);
      
      if (snapshot.empty) {
        setActivities([]);
        setLoading(false);
        return;
      }
      
      // Save the last document for pagination
      setLastVisibleActivity(snapshot.docs[snapshot.docs.length - 1]);
      
      const activitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      })) as ActivityLog[];
      
      // Extract unique users and activity types for filters
      const uniqueUsers = new Map<string, {id: string, name: string}>();
      const uniqueActivityTypes = new Set<ActivityType>();
      const uniqueEntityTypes = new Set<ActivityEntityType>();
      
      activitiesData.forEach(activity => {
        if (activity.userId && activity.userName) {
          uniqueUsers.set(activity.userId, {
            id: activity.userId,
            name: activity.userName
          });
        }
        if (activity.type) {
          uniqueActivityTypes.add(activity.type as ActivityType);
        }
        if (activity.entityType) {
          uniqueEntityTypes.add(activity.entityType as ActivityEntityType);
        }
      });
      
      // Format user data for the dropdown
      setUsers(Array.from(uniqueUsers.values()));
      setActivityTypes(Array.from(uniqueActivityTypes));
      setEntityTypes(Array.from(uniqueEntityTypes));
      
      setActivities(activitiesData);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError('Failed to load activity logs');
      setLoading(false);
    }
  };
  
  // Handle page change
  const handlePageClick = (event: { selected: number }) => {
    const newPage = event.selected;
    setCurrentPage(newPage);
    fetchActivities(newPage);
  };
  
  const handleToggleSortDirection = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };
  
  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedUser('');
    setSelectedActivityType('');
    setSelectedEntityType('');
  };
  
  const getActivityTypeLabel = (type: string) => {
    switch (type) {
      case 'added':
        return 'Added';
      case 'removed':
        return 'Removed';
      case 'updated':
        return 'Updated';
      case 'deleted':
        return 'Deleted';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
  
  const getActivityTypeColor = (type: string) => {
    switch (type) {
      case 'added':
        return 'bg-green-100 text-green-800';
      case 'removed':
        return 'bg-amber-100 text-amber-800';
      case 'updated':
        return 'bg-blue-100 text-blue-800';
      case 'deleted':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'product':
        return 'Product';
      case 'category':
        return 'Category';
      case 'location':
        return 'Location';
      case 'productType':
        return 'Product Type';
      case 'provider':
        return 'Provider';
      case 'order':
        return 'Order';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  };
  
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="h-4 w-4 text-green-500" />;
      case 'removed':
        return <Minus className="h-4 w-4 text-amber-500" />;
      case 'updated':
        return <Edit className="h-4 w-4 text-blue-500" />;
      case 'deleted':
        return <Trash className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };
  
  // Load activities when filters change
  useEffect(() => {
    if (!loading) {
      setCurrentPage(0);
      setLastVisibleActivity(null);
      fetchActivities(0);
    }
  }, [selectedActivityType, selectedEntityType, selectedUser, startDate, endDate]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-36 sm:h-48">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-xs sm:text-sm text-gray-600">Loading activity log...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-3 sm:p-4">
        <div className="flex items-center">
          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mr-2" />
          <p className="text-xs sm:text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Activity Log</h1>
          <p className="text-sm text-gray-600">View all activity across your inventory system</p>
        </div>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-lg mb-4">
          <h2 className="text-base font-semibold text-gray-800 flex items-center">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-indigo-600" />
            Filter Activities
          </h2>
          
          <div className="flex space-x-2">
            <button
              onClick={handleToggleSortDirection}
              className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-gray-300 rounded-md text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
            >
              {sortDirection === 'desc' ? (
                <>
                  <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden xs:inline">Newest First</span>
                </>
              ) : (
                <>
                  <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden xs:inline">Oldest First</span>
                </>
              )}
            </button>
            
            {(!!selectedUser || !!selectedActivityType || !!selectedEntityType || !!startDate || !!endDate) && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-50 border border-indigo-200 rounded-md text-xs sm:text-sm text-indigo-600 hover:bg-indigo-100"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div>
            <label htmlFor="startDate" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="endDate" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              End Date
            </label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="user" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              <User className="inline h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              User
            </label>
            <select
              id="user"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="activityType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              <Activity className="inline h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              Activity Type
            </label>
            <select
              id="activityType"
              value={selectedActivityType}
              onChange={(e) => setSelectedActivityType(e.target.value as ActivityType)}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Activities</option>
              {activityTypes.map(type => (
                <option key={type} value={type}>{getActivityTypeLabel(type)}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="entityType" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              <Filter className="inline h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              Entity Type
            </label>
            <select
              id="entityType"
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value as EntityType)}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Entities</option>
              {entityTypes.map(type => (
                <option key={type} value={type}>{getEntityTypeLabel(type)}</option>
              ))}
            </select>
          </div>
        </div>
        
        {activities.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Activity
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entity
                    </th>
                    <th scope="col" className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activities.map((activity) => (
                    <tr key={activity.id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <div className="flex items-center text-xs sm:text-sm text-gray-900">
                          <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 text-gray-400" />
                          {format(activity.date, 'MMM d, yyyy • h:mm a')}
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm font-medium text-gray-900">{activity.userName}</div>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${getActivityTypeColor(activity.type)}`}>
                          {getActivityIcon(activity.type)}
                          <span className="ml-1">{getActivityTypeLabel(activity.type)}</span>
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                        <div className="text-xs sm:text-sm text-gray-900">
                          <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                            {getEntityTypeLabel(activity.entityType)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                        {activity.entityName}
                        {activity.quantity !== undefined && activity.quantity !== null && (
                          <span className="ml-2 text-gray-500">
                            ({activity.quantity} units)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {pageCount > 1 && (
              <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 mt-4 sm:px-6">
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
                      Showing <span className="font-medium">{activities.length > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{' '}
                      <span className="font-medium">
                        {Math.min((currentPage + 1) * itemsPerPage, totalActivities)}
                      </span>{' '}
                      of <span className="font-medium">{totalActivities}</span> activities
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
        ) : (
          <div className="text-center py-8 sm:py-10">
            <Activity className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No activity records found for the selected filters.</p>
            {(!!selectedUser || !!selectedActivityType || !!selectedEntityType || !!startDate || !!endDate) && (
              <button
                onClick={clearFilters}
                className="mt-3 inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
              >
                <Filter className="h-4 w-4 mr-1" />
                Clear filters to see all activity
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityList;