import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Location } from '../../types';
import { Plus, Edit, Trash, AlertTriangle, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { useNavigate } from 'react-router-dom';

const LocationSettings: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const locationsRef = collection(db, 'locations');
        const snapshot = await getDocs(locationsRef);
        const locationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Location[];
        
        setLocations(locationsData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching locations:', error);
        setLoading(false);
      }
    };
    
    fetchLocations();
  }, []);

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setEditingLocation(null);
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    try {
      if (editingLocation) {
        // Update existing location
        await updateDoc(doc(db, 'locations', editingLocation.id), {
          name: formData.name,
          description: formData.description,
          // Keep the default status when editing
          ...(editingLocation.default !== undefined && { default: editingLocation.default })
        });
        
        // Log the activity
        await logActivity(
          'updated',
          'location',
          editingLocation.id,
          formData.name,
          currentUser
        );
        
        setLocations(locations.map(loc => 
          loc.id === editingLocation.id 
            ? { 
                ...loc, 
                name: formData.name, 
                description: formData.description 
              } 
            : loc
        ));
        setShowEditModal(false);
      } else {
        // Add new location
        const newLocation = {
          name: formData.name,
          description: formData.description,
          createdAt: new Date(),
          default: false // New locations are not default by default
        };
        
        const docRef = await addDoc(collection(db, 'locations'), newLocation);
        
        // Log the activity
        await logActivity(
          'added',
          'location',
          docRef.id,
          formData.name,
          currentUser
        );
        
        setLocations([...locations, { id: docRef.id, ...newLocation }]);
        setShowAddModal(false);
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving location:', error);
    }
  };

  const handleEdit = (location: Location) => {
    setFormData({
      name: location.name,
      description: location.description
    });
    setEditingLocation(location);
    setShowEditModal(true);
  };

  const confirmDelete = (location: Location) => {
    setLocationToDelete(location);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!locationToDelete || !currentUser) return;
    
    try {
      await deleteDoc(doc(db, 'locations', locationToDelete.id));
      
      // Log the activity
      await logActivity(
        'deleted',
        'location',
        locationToDelete.id,
        locationToDelete.name,
        currentUser
      );
      
      setLocations(locations.filter(loc => loc.id !== locationToDelete.id));
      setShowDeleteModal(false);
      setLocationToDelete(null);
    } catch (error) {
      console.error('Error deleting location:', error);
    }
  };

  // New function to handle setting a default location
  const handleSetDefault = async (locationId: string) => {
    if (!currentUser) return;
    
    try {
      // Find the location in the state
      const location = locations.find(loc => loc.id === locationId);
      if (!location) return;
      
      // If the location is already the default, do nothing
      if (location.default) return;
      
      // First, remove default flag from any existing default location
      const defaultLocation = locations.find(loc => loc.default === true);
      if (defaultLocation) {
        await updateDoc(doc(db, 'locations', defaultLocation.id), {
          default: false
        });
      }
      
      // Set this location as the new default
      await updateDoc(doc(db, 'locations', locationId), {
        default: true
      });
      
      // Log the activity
      await logActivity(
        'updated',
        'location',
        locationId,
        location.name,
        currentUser
      );
      
      // Update local state to reflect the changes
      setLocations(locations.map(loc => ({
        ...loc,
        default: loc.id === locationId
      })));
    } catch (error) {
      console.error('Error setting default location:', error);
    }
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    resetForm();
    setShowAddModal(false);
  };

  const handleCloseEditModal = () => {
    resetForm();
    setShowEditModal(false);
  };

  // Form content - reused in both add and edit modals
  const renderForm = (isEdit: boolean) => (
    <form onSubmit={handleAddLocation}>
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Location Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            required
          />
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          ></textarea>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={isEdit ? handleCloseEditModal : handleCloseAddModal}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isEdit ? 'Update Location' : 'Add Location'}
          </button>
        </div>
      </div>
    </form>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Locations</h1>
          <p className="text-gray-600">Manage your inventory locations</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Default
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {locations.length > 0 ? (
                locations.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{location.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 line-clamp-2">{location.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={location.default || false}
                          onChange={() => handleSetDefault(location.id)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mr-2"
                        />
                        {location.default && (
                          <span className="text-xs inline-flex items-center font-medium text-green-800 bg-green-100 px-2.5 py-0.5 rounded-full">
                            <Check className="w-3 h-3 mr-1" />
                            Default
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(location)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => confirmDelete(location)}
                          className="text-red-600 hover:text-red-900"
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
                    No locations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add Location Modal */}
      <Modal 
        isOpen={showAddModal} 
        onClose={handleCloseAddModal}
        title="Add New Location"
      >
        {renderForm(false)}
      </Modal>

      {/* Edit Location Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={handleCloseEditModal}
        title="Edit Location"
      >
        {renderForm(true)}
      </Modal>
      
      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Location"
      >
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <p className="text-sm text-gray-500">
              Are you sure you want to delete {locationToDelete?.name}? This may affect products assigned to this location.
            </p>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleDelete}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(false)}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default LocationSettings;