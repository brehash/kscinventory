import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { User } from '../../types';
import { Plus, Edit, Trash, AlertTriangle, Loader2, Shield } from 'lucide-react';
import Modal from '../ui/Modal';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { deleteUser, getAuth } from 'firebase/auth';
import { httpsCallable, getFunctions } from 'firebase/functions';

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const auth = getAuth();
  const functions = getFunctions();

  // Fetch users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        
        const usersRef = collection(db, 'users');
        const q = query(usersRef, orderBy('displayName'));
        const querySnapshot = await getDocs(q);
        
        const fetchedUsers = querySnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        } as User));
        
        setUsers(fetchedUsers);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load users');
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);
  
  // Handle user delete confirmation
  const confirmDelete = (user: User) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };
  
  // Handle user deletion
  const handleDelete = async () => {
    if (!userToDelete || !currentUser) return;
    
    try {
      setDeletingUser(true);
      setError(null);

      // You cannot delete yourself
      if (userToDelete.uid === currentUser.uid) {
        setError('You cannot delete your own account');
        setShowDeleteModal(false);
        setDeletingUser(false);
        return;
      }
      
      // Delete user from Firestore first, since this has a higher chance of success
      await deleteDoc(doc(db, 'users', userToDelete.uid));
      
      // Try to delete user from Firebase Authentication using a Cloud Function
      let authDeletionSuccessful = false;
      
      try {
        // Only proceed if the functions object exists and is properly initialized
        if (functions) {
          const deleteUserAuth = httpsCallable(functions, 'deleteUser');
          
          try {
            const result = await deleteUserAuth({ uid: userToDelete.uid });
            
            // Check if the function returned a success result
            if (result && result.data && (result.data as any).success) {
              authDeletionSuccessful = true;
            } else {
              console.warn('Cloud function did not return success status:', result);
              throw new Error((result.data as any).error || 'Cloud function did not return success status');
            }
          } catch (callError: any) {
            console.error('Error calling Cloud Function:', callError);
            throw new Error(`Error deleting auth user: ${callError.message || callError.details || 'Unknown Cloud Function error'}`);
          }
        } else {
          console.warn('Firebase Functions not available. Auth user not deleted.');
        }
      } catch (authError: any) {
        // Log detailed error info for debugging
        console.error('Error deleting user from Firebase Auth:', authError);
        
        // Don't stop the process - we've already deleted the user from Firestore
        // Just show a warning that the auth account might still exist
        setError(
          `User document deleted, but there was an issue removing their authentication account: ${authError.message || 'Internal error'}. An administrator may need to remove their auth account manually.`
        );
      }
      
      // Log the activity
      await logActivity(
        'deleted',
        'user',
        userToDelete.uid,
        userToDelete.displayName || 'Unknown User',
        currentUser
      );
      
      // Update the local state to remove the deleted user
      setUsers(users.filter(user => user.uid !== userToDelete.uid));
      
      // If auth deletion wasn't successful, but we didn't totally fail (i.e., we still deleted the Firestore doc)
      if (!authDeletionSuccessful && !error) {
        setError(
          `User document deleted, but there may be an issue with removing their authentication account. An administrator may need to check this manually.`
        );
      }
      
      setShowDeleteModal(false);
      setUserToDelete(null);
      setDeletingUser(false);
    } catch (error: any) {
      console.error('Error in delete process:', error);
      setError(`Failed to delete user: ${error.message || 'Unknown error'}`);
      setShowDeleteModal(false);
      setDeletingUser(false);
    }
  };
  
  // Render the role badge with appropriate color
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
            Admin
          </span>
        );
      case 'manager':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
            Manager
          </span>
        );
      case 'staff':
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            Staff
          </span>
        );
      default:
        return (
          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            {role}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm sm:text-base text-gray-600">Loading users...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 sm:p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mr-2" />
          <p className="text-sm sm:text-base text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Users</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage user accounts and permissions</p>
        </div>
        <button
          onClick={() => navigate('/users/new')}
          className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-sm rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-1 sm:mr-2" />
          Add User
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                          {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.displayName || 'No Name'}
                          </div>
                          {user.uid === currentUser?.uid && (
                            <div className="text-xs text-indigo-600">
                              (You)
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/users/${user.uid}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit User"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => confirmDelete(user)}
                          className={`text-red-600 hover:text-red-900 ${user.uid === currentUser?.uid ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={user.uid === currentUser?.uid}
                          title={user.uid === currentUser?.uid ? "You can't delete your own account" : "Delete User"}
                        >
                          <Trash className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete User"
      >
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <p className="text-sm text-gray-500">
              Are you sure you want to delete the user <span className="font-medium">{userToDelete?.displayName || userToDelete?.email}</span>? This action cannot be undone.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This will remove their account completely, including their authentication credentials and user document.
            </p>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deletingUser}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
          >
            {deletingUser ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(false)}
            disabled={deletingUser}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default UserList;