import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { updateProfile, updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useAuth } from '../auth/AuthProvider';
import { User } from '../../types';
import { logActivity } from '../../utils/activityLogger';
import { ArrowLeft, AlertTriangle, CheckCircle, Loader2, Shield, Key, Mail } from 'lucide-react';

const UserProfile: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Profile data state
  const [displayName, setDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [changeEmail, setChangeEmail] = useState(false);
  const [changePassword, setChangePassword] = useState(false);
  
  // Fetch user data
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!currentUser) {
        navigate('/login');
        return;
      }
      
      try {
        setLoading(true);
        
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as Omit<User, 'uid'>;
          setDisplayName(userData.displayName || '');
          setNewEmail(currentUser.email || '');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user profile:', error);
        setError('Failed to load profile data');
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [currentUser, navigate]);
  
  // Update profile information
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to update your profile');
      return;
    }
    
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    
    setUpdating(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Update display name in Firebase Auth
      if (auth.currentUser && displayName !== currentUser.displayName) {
        await updateProfile(auth.currentUser, {
          displayName: displayName
        });
      }
      
      // Update user document in Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), {
        displayName: displayName,
        updatedAt: new Date()
      });
      
      // Log the activity
      await logActivity(
        'updated',
        'user',
        currentUser.uid,
        displayName,
        currentUser
      );
      
      setSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update profile information');
    } finally {
      setUpdating(false);
    }
  };
  
  // Re-authenticate the user (required for email/password changes)
  const reauthenticate = async (password: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('User not authenticated');
    }
    
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
      await reauthenticateWithCredential(auth.currentUser, credential);
      return true;
    } catch (error) {
      console.error('Reauthentication failed:', error);
      return false;
    }
  };
  
  // Update email
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth.currentUser || !currentUser) {
      setError('You must be logged in to update your email');
      return;
    }
    
    if (!newEmail) {
      setError('Email is required');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(newEmail)) {
      setError('Please enter a valid email');
      return;
    }
    
    if (!currentPassword) {
      setError('Current password is required to change your email');
      return;
    }
    
    setUpdating(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Re-authenticate the user first
      const reauthed = await reauthenticate(currentPassword);
      if (!reauthed) {
        setError('Current password is incorrect');
        setUpdating(false);
        return;
      }
      
      // Update email in Firebase Auth
      await updateEmail(auth.currentUser, newEmail);
      
      // Update email in Firestore document
      await updateDoc(doc(db, 'users', currentUser.uid), {
        email: newEmail,
        updatedAt: new Date()
      });
      
      // Log the activity
      await logActivity(
        'updated',
        'user',
        currentUser.uid,
        currentUser.displayName || 'User',
        currentUser
      );
      
      setSuccess(true);
      setChangeEmail(false);
      setCurrentPassword('');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Error updating email:', err);
      setError('Failed to update email. Make sure you entered your password correctly.');
    } finally {
      setUpdating(false);
    }
  };
  
  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth.currentUser || !currentUser) {
      setError('You must be logged in to update your password');
      return;
    }
    
    if (!currentPassword) {
      setError('Current password is required to set a new password');
      return;
    }
    
    if (!newPassword || !confirmPassword) {
      setError('New password and confirmation are required');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    setUpdating(true);
    setError(null);
    setSuccess(false);
    
    try {
      // Re-authenticate the user first
      const reauthed = await reauthenticate(currentPassword);
      if (!reauthed) {
        setError('Current password is incorrect');
        setUpdating(false);
        return;
      }
      
      // Update password in Firebase Auth
      await updatePassword(auth.currentUser, newPassword);
      
      // Log the activity (don't include the password!)
      await logActivity(
        'updated',
        'user',
        currentUser.uid,
        currentUser.displayName || 'User',
        currentUser
      );
      
      setSuccess(true);
      setChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
      
    } catch (err) {
      console.error('Error updating password:', err);
      setError('Failed to update password. Make sure you entered your current password correctly.');
    } finally {
      setUpdating(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm sm:text-base text-gray-600">Loading profile...</span>
      </div>
    );
  }
  
  if (!currentUser) {
    navigate('/login');
    return null;
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center mb-3 sm:mb-4">
        <button
          onClick={() => navigate('/')}
          className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Your Profile</h1>
          <p className="text-xs sm:text-base text-gray-600">
            {currentUser.email}
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
            <p className="text-sm text-green-700">Profile updated successfully</p>
          </div>
        </div>
      )}
      
      {/* Profile Information */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h2>
        
        <form onSubmit={handleUpdateProfile} className="space-y-4">
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
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              <div className="flex items-center">
                <Shield className="h-4 w-4 mr-1 text-indigo-500" />
                User Role
              </div>
            </label>
            <div className="mt-1 p-2 bg-gray-50 rounded-md border border-gray-200">
              <div className="flex items-center">
                {currentUser.role === 'admin' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mr-2">
                    Administrator
                  </span>
                )}
                {currentUser.role === 'manager' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                    Manager
                  </span>
                )}
                {currentUser.role === 'staff' && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mr-2">
                    Staff
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  {currentUser.role === 'admin' && 'Full system access, including user management'}
                  {currentUser.role === 'manager' && 'Access to inventory, orders, and settings'}
                  {currentUser.role === 'staff' && 'Basic inventory operations access'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end">
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
                'Update Profile'
              )}
            </button>
          </div>
        </form>
      </div>
      
      {/* Email Address Section */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Email Address</h2>
          <button
            type="button"
            onClick={() => setChangeEmail(!changeEmail)}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            {changeEmail ? 'Cancel' : 'Change'}
          </button>
        </div>
        
        {!changeEmail ? (
          <div className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-200">
            <Mail className="h-4 w-4 mr-2 text-gray-500" />
            <span className="text-sm text-gray-700">{currentUser.email}</span>
          </div>
        ) : (
          <form onSubmit={handleUpdateEmail} className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200">
            <div>
              <label htmlFor="newEmail" className="block text-sm font-medium text-gray-700 mb-1">
                New Email Address
              </label>
              <input
                id="newEmail"
                name="newEmail"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="currentPasswordForEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password (for verification)
              </label>
              <input
                id="currentPasswordForEmail"
                name="currentPasswordForEmail"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updating}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update Email'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
      
      {/* Password Section */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Password</h2>
          <button
            type="button"
            onClick={() => setChangePassword(!changePassword)}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            {changePassword ? 'Cancel' : 'Change Password'}
          </button>
        </div>
        
        {!changePassword ? (
          <div className="flex items-center p-2 bg-gray-50 rounded-md border border-gray-200">
            <Key className="h-4 w-4 mr-2 text-gray-500" />
            <span className="text-sm text-gray-700">••••••••</span>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4 bg-gray-50 p-4 rounded-md border border-gray-200">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 6 characters long
              </p>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updating}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {updating ? (
                  <>
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
      
      {/* Account Information */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Account Information</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500">User ID</h3>
            <p className="mt-1 text-sm text-gray-900">{currentUser.uid}</p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-500">Account Type</h3>
            <p className="mt-1 text-sm text-gray-900 capitalize">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;