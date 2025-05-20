import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2, Shield, CheckCircle } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { logActivity } from '../../utils/activityLogger';

const UserCreate: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'staff'>('staff');
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Password strength validation
  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return false;
    }
    return true;
  };
  
  // Form validation
  const validateForm = () => {
    // Reset error
    setError(null);
    
    if (!email || !password || !confirmPassword || !displayName) {
      setError('All fields are required');
      return false;
    }
    
    if (!validatePassword(password)) {
      setError('Password must be at least 6 characters long');
      return false;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return false;
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You need to be logged in to create users');
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update display name
      await updateProfile(user, {
        displayName: displayName
      });
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email: email,
        displayName: displayName,
        role: role,
        createdBy: currentUser.uid,
        createdAt: new Date()
      });
      
      // Log the activity
      await logActivity(
        'added',
        'user', // This might not be in your ActivityEntityType - update types as needed
        user.uid,
        displayName,
        currentUser
      );
      
      // Show success message
      setSuccess(true);
      
      // Reset form
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setDisplayName('');
      setRole('staff');
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 5000);
      
    } catch (err: any) {
      console.error('Error creating user:', err);
      
      // Handle specific Firebase errors
      if (err.code === 'auth/email-already-in-use') {
        setError('Email is already in use');
      } else if (err.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else {
        setError('Failed to create user: ' + (err.message || 'Unknown error'));
      }
      
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center mb-3 sm:mb-4">
        <button
          onClick={() => navigate('/users')}
          className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">Create User</h1>
          <p className="text-xs sm:text-base text-gray-600">Add a new user to the system</p>
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
            <p className="text-sm text-green-700">User created successfully!</p>
          </div>
        </div>
      )}
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Password must be at least 6 characters long
              </p>
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>
            
            <div className="sm:col-span-2">
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
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="staff">Staff - Basic inventory operations</option>
                <option value="manager">Manager - Inventory and settings management</option>
                <option value="admin">Admin - Full system access</option>
              </select>
              
              <div className="mt-2 bg-blue-50 p-3 rounded-md">
                <h3 className="text-sm font-medium text-blue-800 mb-1">Role Permissions:</h3>
                <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                  <li><span className="font-medium">Staff:</span> Can view and update inventory, process orders</li>
                  <li><span className="font-medium">Manager:</span> Can manage inventory, orders, and system settings</li>
                  <li><span className="font-medium">Admin:</span> Full access, including user management and system configuration</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/users')}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Creating User...
                </>
              ) : (
                'Create User'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserCreate;