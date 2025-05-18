import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Provider } from '../../types';
import { Plus, Edit, Trash, AlertTriangle, Globe, Phone } from 'lucide-react';
import Modal from '../ui/Modal';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { useNavigate } from 'react-router-dom';

const ProviderSettings: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '',
    website: '', 
    phoneNumber: '' 
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<Provider | null>(null);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const providersRef = collection(db, 'providers');
        const snapshot = await getDocs(providersRef);
        const providersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Provider[];
        
        setProviders(providersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching providers:', error);
        setLoading(false);
      }
    };
    
    fetchProviders();
  }, []);

  const resetForm = () => {
    setFormData({ 
      name: '', 
      description: '', 
      website: '', 
      phoneNumber: '' 
    });
    setEditingProvider(null);
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    try {
      if (editingProvider) {
        // Update existing provider
        await updateDoc(doc(db, 'providers', editingProvider.id), {
          name: formData.name,
          description: formData.description,
          website: formData.website || null,
          phoneNumber: formData.phoneNumber || null,
        });
        
        // Log the activity - removed undefined quantity parameter
        await logActivity(
          'updated',
          'provider',
          editingProvider.id,
          formData.name,
          currentUser
        );
        
        setProviders(providers.map(prov => 
          prov.id === editingProvider.id 
            ? { 
                ...prov, 
                name: formData.name, 
                description: formData.description,
                website: formData.website || undefined,
                phoneNumber: formData.phoneNumber || undefined
              } 
            : prov
        ));
        setShowEditModal(false);
      } else {
        // Add new provider
        const newProvider = {
          name: formData.name,
          description: formData.description,
          website: formData.website || null,
          phoneNumber: formData.phoneNumber || null,
          createdAt: new Date()
        };
        
        const docRef = await addDoc(collection(db, 'providers'), newProvider);
        
        // Log the activity - removed undefined quantity parameter
        await logActivity(
          'added',
          'provider',
          docRef.id,
          formData.name,
          currentUser
        );
        
        setProviders([...providers, { id: docRef.id, ...newProvider }]);
        setShowAddModal(false);
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving provider:', error);
    }
  };

  const handleEdit = (provider: Provider) => {
    setFormData({
      name: provider.name,
      description: provider.description,
      website: provider.website || '',
      phoneNumber: provider.phoneNumber || ''
    });
    setEditingProvider(provider);
    setShowEditModal(true);
  };

  const confirmDelete = (provider: Provider) => {
    setProviderToDelete(provider);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!providerToDelete || !currentUser) return;
    
    try {
      await deleteDoc(doc(db, 'providers', providerToDelete.id));
      
      // Log the activity
      await logActivity(
        'deleted',
        'provider',
        providerToDelete.id,
        providerToDelete.name,
        currentUser
      );
      
      setProviders(providers.filter(prov => prov.id !== providerToDelete.id));
      setShowDeleteModal(false);
      setProviderToDelete(null);
    } catch (error) {
      console.error('Error deleting provider:', error);
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
    <form onSubmit={handleAddProvider}>
      <div className="grid grid-cols-1 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Provider Name
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

        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
            Website (Optional)
          </label>
          <input
            type="url"
            id="website"
            value={formData.website}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="https://example.com"
          />
        </div>

        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number (Optional)
          </label>
          <input
            type="tel"
            id="phoneNumber"
            value={formData.phoneNumber}
            onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="+1 (123) 456-7890"
          />
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
            {isEdit ? 'Update Provider' : 'Add Provider'}
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
          <h1 className="text-2xl font-bold text-gray-800">Providers</h1>
          <p className="text-gray-600">Manage your product suppliers and vendors</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Provider
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
                  Contact Information
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {providers.length > 0 ? (
                providers.map((provider) => (
                  <tr key={provider.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{provider.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 line-clamp-2">{provider.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col space-y-1">
                        {provider.website && (
                          <a 
                            href={provider.website} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                          >
                            <Globe className="h-4 w-4 mr-1" />
                            <span className="truncate max-w-xs">Website</span>
                          </a>
                        )}
                        {provider.phoneNumber && (
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="h-4 w-4 mr-1" />
                            <span>{provider.phoneNumber}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(provider)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => confirmDelete(provider)}
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
                    No providers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add Provider Modal */}
      <Modal 
        isOpen={showAddModal} 
        onClose={handleCloseAddModal}
        title="Add New Provider"
      >
        {renderForm(false)}
      </Modal>

      {/* Edit Provider Modal */}
      <Modal 
        isOpen={showEditModal} 
        onClose={handleCloseEditModal}
        title="Edit Provider"
      >
        {renderForm(true)}
      </Modal>
      
      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Provider"
      >
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <p className="text-sm text-gray-500">
              Are you sure you want to delete {providerToDelete?.name}? This may affect products associated with this provider.
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

export default ProviderSettings;