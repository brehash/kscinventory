import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Package, ArrowDown, ArrowUp, Edit, Trash } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ActivityLog } from '../../types';

const RecentActivity: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentActivities = async () => {
      try {
        const activitiesRef = collection(db, 'activities');
        const q = query(activitiesRef, orderBy('date', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        
        const activitiesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() || new Date() // Convert Firestore timestamp to Date
        })) as ActivityLog[];
        
        setActivities(activitiesData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching activities:', error);
        setLoading(false);
      }
    };

    fetchRecentActivities();
    
    // Set up real-time listener for new activities
    const activitiesRef = collection(db, 'activities');
    const q = query(activitiesRef, orderBy('date', 'desc'), limit(5));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date?.toDate() || new Date()
      })) as ActivityLog[];
      
      setActivities(activitiesData);
    });
    
    return () => unsubscribe();
  }, []);

  const getActivityIcon = (activity: ActivityLog) => {
    switch (activity.type) {
      case 'added':
        return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'removed':
      case 'deleted':
        return <Trash className="h-4 w-4 text-red-500" />;
      case 'updated':
        return <Edit className="h-4 w-4 text-amber-500" />;
      default:
        return <Package className="h-4 w-4 text-indigo-500" />;
    }
  };

  const getActivityText = (activity: ActivityLog) => {
    const entityType = activity.entityType === 'productType' ? 'product type' : activity.entityType;
    
    switch (activity.type) {
      case 'added':
        if (activity.entityType === 'product' && activity.quantity) {
          return `added ${activity.quantity} units of ${activity.entityName}`;
        }
        return `added a new ${entityType} "${activity.entityName}"`;
      case 'removed':
        if (activity.entityType === 'product' && activity.quantity) {
          return `removed ${activity.quantity} units of ${activity.entityName}`;
        }
        return `removed some ${entityType} "${activity.entityName}"`;
      case 'updated':
        if (activity.entityType === 'product' && activity.quantity) {
          return `updated quantity of ${activity.entityName} to ${activity.quantity}`;
        }
        return `updated ${entityType} "${activity.entityName}"`;
      case 'deleted':
        return `deleted ${entityType} "${activity.entityName}"`;
      default:
        return `interacted with ${entityType} "${activity.entityName}"`;
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Recent Activity</h2>
        <div className="flex justify-center py-6 sm:py-8">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Recent Activity</h2>
      
      {activities.length === 0 ? (
        <div className="text-center py-6 sm:py-8 text-gray-500">
          <p>No recent activity to display</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {activities.map(activity => (
            <div key={activity.id} className="py-3">
              <div className="flex items-start">
                <div className="p-1.5 bg-gray-100 rounded-full mr-3">
                  {getActivityIcon(activity)}
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-gray-800">
                    <span className="font-medium">{activity.userName}</span>
                    {' '}{getActivityText(activity)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {format(activity.date, 'MMM d, yyyy • h:mm a')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 text-center">
        <Link to="/activities" className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          View all activity
        </Link>
      </div>
    </div>
  );
};

export default RecentActivity;