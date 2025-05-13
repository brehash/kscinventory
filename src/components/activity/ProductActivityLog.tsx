import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ActivityLog } from '../../types';
import { format, parseISO, isValid, isBefore, isAfter, isSameDay } from 'date-fns';
import { Calendar, Filter, ArrowUp, ArrowDown, User, Clock, Activity, AlertCircle, Loader2, Edit, Trash, Plus, Minus } from 'lucide-react';

interface ProductActivityLogProps {
  productId: string;
}

const ProductActivityLog: React.FC<ProductActivityLogProps> = ({ productId }) => {
  // State for activity logs
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedActivityType, setSelectedActivityType] = useState<string>('');
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);
  const [activityTypes, setActivityTypes] = useState<string[]>([]);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Function to fetch activity logs for the specific product
  useEffect(() => {
    const fetchActivities = async () => {
      if (!productId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const activitiesRef = collection(db, 'activities');
        const q = query(
          activitiesRef, 
          where('entityType', '==', 'product'),
          where('entityId', '==', productId),
          orderBy('date', sortDirection)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          setActivities([]);
          setFilteredActivities([]);
          setLoading(false);
          return;
        }
        
        const activitiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() || new Date()
        })) as ActivityLog[];
        
        setActivities(activitiesData);
        setFilteredActivities(activitiesData);
        
        // Extract unique users and activity types for filters
        const uniqueUsers = new Map<string, {id: string, name: string}>();
        const uniqueActivityTypes = new Set<string>();
        
        activitiesData.forEach(activity => {
          if (activity.userId && activity.userName) {
            uniqueUsers.set(activity.userId, {
              id: activity.userId,
              name: activity.userName
            });
          }
          if (activity.type) {
            uniqueActivityTypes.add(activity.type);
          }
        });
        
        // Format user data for the dropdown
        setUsers(Array.from(uniqueUsers.values()));
        setActivityTypes(Array.from(uniqueActivityTypes));
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching activity logs:', err);
        setError('Failed to load activity logs');
        setLoading(false);
      }
    };
    
    fetchActivities();
  }, [productId, sortDirection]);
  
  // Apply filters whenever filter values change
  useEffect(() => {
    if (!activities.length) return;
    
    let filtered = [...activities];
    
    // Filter by user
    if (selectedUser) {
      filtered = filtered.filter(activity => activity.userId === selectedUser);
    }
    
    // Filter by activity type
    if (selectedActivityType) {
      filtered = filtered.filter(activity => activity.type === selectedActivityType);
    }
    
    // Filter by date range
    if (startDate && isValid(parseISO(startDate))) {
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      filtered = filtered.filter(activity => 
        isAfter(activity.date, startDateObj) || isSameDay(activity.date, startDateObj)
      );
    }
    
    if (endDate && isValid(parseISO(endDate))) {
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(activity => 
        isBefore(activity.date, endDateObj) || isSameDay(activity.date, endDateObj)
      );
    }
    
    setFilteredActivities(filtered);
  }, [activities, selectedUser, selectedActivityType, startDate, endDate]);
  
  const handleToggleSortDirection = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };
  
  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedUser('');
    setSelectedActivityType('');
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
  
  const getQuantityText = (activity: ActivityLog) => {
    if (activity.quantity === undefined || activity.quantity === null) return null;
    
    switch (activity.type) {
      case 'added':
        return `+${activity.quantity} units`;
      case 'removed':
        return `-${activity.quantity} units`;
      case 'updated':
        return `Set to ${activity.quantity} units`;
      default:
        return `${activity.quantity} units`;
    }
  };
  
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
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 sm:gap-4 bg-gray-50 p-3 sm:p-4 rounded-lg">
        <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center">
          <Activity className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-indigo-600" />
          Activity Log
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
          
          {(!!selectedUser || !!selectedActivityType || !!startDate || !!endDate) && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 bg-indigo-50 border border-indigo-200 rounded-md text-xs sm:text-sm text-indigo-600 hover:bg-indigo-100"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
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
              onChange={(e) => setSelectedActivityType(e.target.value)}
              className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Activities</option>
              {activityTypes.map(type => (
                <option key={type} value={type}>{getActivityTypeLabel(type)}</option>
              ))}
            </select>
          </div>
        </div>
        
        {filteredActivities.length > 0 ? (
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
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredActivities.map((activity) => (
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
                    <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      {getQuantityText(activity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 sm:py-8">
            <Activity className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mb-3" />
            <p className="text-xs sm:text-sm text-gray-500">No activity records found for the selected filters.</p>
            {(!!selectedUser || !!selectedActivityType || !!startDate || !!endDate) && (
              <button
                onClick={clearFilters}
                className="mt-3 inline-flex items-center text-xs sm:text-sm text-indigo-600 hover:text-indigo-900"
              >
                <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                Clear filters to see all activity
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductActivityLog;