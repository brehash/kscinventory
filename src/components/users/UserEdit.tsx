import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User } from '../../types';
import { logActivity } from '../../utils/activityLogger';

const UserEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // User data state
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'staff'>('staff');
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        
        const userDoc = await getDoc(doc(db, 'users', id));
        
        if (!userDoc.exists()) {
          setError('User not found');
          setLoading(false);
          return;
        }
        
        const userData = {
          uid: userDoc.id,
          ...userDoc.data()
        } as User;
        
        setUser(userData);
        setDisplayName(userData.displayName || '');
        setRole(userData.role || 'staff');
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user:', error);
        setError('Failed to load user data');
        setLoading(false);
      }
    };
    
    fetchUser();
  }, [id]);
  
  // Form validation
  const validateForm = () => {
    setError(null);
    
    if (!displayName) {
      setError('Display name is required');
      return false;
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !currentUser || !id) {
      setError('Missing required data');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    // Check if this is the current user trying to downgrade their own admin role
    if (user.uid === currentUser.uid && 
        currentUser.role === 'admin' && 
        role !== 'admin') {
      setError("You cannot downgrade your own admin role");
      return;
    }
    
    setUpdating(true);
    setSuccess(false);
    
    try {
      // Update user document in Firestore
      await updateDoc(doc(db, 'users', id), {
        displayName,
        role,
        updatedBy: currentUser.uid,
        updatedAt: new Date()
      });
      
      // Log the activity
      await logActivity(
        'updated',
        'user', // You might need to update ActivityEntityType in types.ts
        id,
        displayName,
        currentUser
      );
      
      setSuccess(true);
      
      // Update local state
      setUser({
        ...user,
        displayName,
        role
      });
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Error updating user:', err);
      setError('Failed to update user');
    } finally {
      setUpdating(false);
    }
  };
  
  // Handle user permissions logic
  const canEditRole = () => {
    if (!currentUser || !user) return false;
    
    // Only admins can change roles
    if (currentUser.role !== 'admin') return false;
    
    return true;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm sm:text-base text-gray-600">Loading user data...</span>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 sm:p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mr-2" />
          <p className="text-sm sm:text-base text-red-700">{error}</p>
        </div>
        <button 
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center mb-3 sm:mb-4">
        <button
          onClick={() => navigate(-1)}
          className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Edit User</h1>
          <p className="text-xs sm:text-base text-gray-600">
            {user?.email}
          </p>
        </div>
      </div>
      
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
            <p className="text-sm text-green-700">User updated successfully</p>
          </div>
        </div>
      )}
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-sm cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">
              Email addresses cannot be changed
            </p>
          </div>
          
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center">
                <Shield className="h-4 w-4 mr-1 text-indigo-500" />
                User Role
              </div>
            </label>
            <select
              id="role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'manager' | 'staff')}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${
                !canEditRole() ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
              disabled={!canEditRole()}
            >
              <option value="staff">Staff - Basic inventory operations</option>
              <option value="manager">Manager - Inventory and settings management</option>
              <option value="admin">Admin - Full system access</option>
            </select>
            
            {!canEditRole() && (
              <p className="mt-1 text-xs text-amber-500">
                Only administrators can change user roles
              </p>
            )}
            
            {user?.uid === currentUser?.uid && currentUser?.role === 'admin' && (
              <p className="mt-1 text-xs text-amber-500">
                Note: If you change your own role from admin, you may lose access to this section
              </p>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updating}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {updating ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">User ID</h3>
            <p className="mt-1 text-sm text-gray-900">{user?.uid}</p>
          </div>
          
          {user && user.createdAt && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Created At</h3>
              <p className="mt-1 text-sm text-gray-900">
                {user.createdAt instanceof Date ? user.createdAt.toLocaleString() : 'Unknown'}
              </p>
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Security Options</h3>
          
          <p className="text-sm text-gray-500 mb-4">
            For security reasons, password resets must be handled through the login page's "Forgot Password" option.
          </p>
          
          {currentUser?.uid === id && (
            <div className="flex items-center p-3 bg-yellow-50 rounded-md border border-yellow-100">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
              <p className="text-sm text-yellow-700">
                This is your own account. Some changes may affect your current session.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserEdit;