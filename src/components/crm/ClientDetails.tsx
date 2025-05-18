import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  User, 
  Building, 
  Phone, 
  Mail, 
  Globe, 
  MapPin, 
  ShoppingBag, 
  DollarSign,
  Calendar,
  AlertTriangle,
  Loader2,
  PlusCircle,
  Trash,
  Pin,
  Eye,
  EyeOff,
  Star,
  MessageSquare
} from 'lucide-react';
import { collection, doc, getDoc, getDocs, query, where, updateDoc, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Client, ClientNote, Order } from '../../types';
import { format } from 'date-fns';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import Modal from '../ui/Modal';

const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Notes state
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [showNoteDeleteModal, setShowNoteDeleteModal] = useState(false);
  
  useEffect(() => {
    const fetchClientData = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        setError(null);
        
        // Fetch client
        const clientDoc = await getDoc(doc(db, 'clients', id));
        if (!clientDoc.exists()) {
          setError('Client not found');
          setLoading(false);
          return;
        }
        
        const clientData = { 
          id: clientDoc.id, 
          ...clientDoc.data() 
        } as Client;
        
        // Convert timestamps to Date objects
        if (clientData.createdAt) {
          clientData.createdAt = clientData.createdAt.toDate();
        }
        if (clientData.updatedAt) {
          clientData.updatedAt = clientData.updatedAt.toDate();
        }
        if (clientData.lastOrderDate) {
          clientData.lastOrderDate = clientData.lastOrderDate.toDate();
        }
        
        setClient(clientData);
        
        // Fetch client notes
        const notesRef = collection(db, 'clients', id, 'notes');
        const notesQuery = query(notesRef, orderBy('createdAt', 'desc'));
        const notesSnapshot = await getDocs(notesQuery);
        
        if (!notesSnapshot.empty) {
          const notesData = notesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt.toDate()
          } as ClientNote));
          
          setNotes(notesData);
        }
        
        // Fetch client orders
        const ordersRef = collection(db, 'orders');
        const ordersQuery = query(
          ordersRef, 
          where('clientId', '==', id),
          orderBy('orderDate', 'desc')
        );
        const ordersSnapshot = await getDocs(ordersQuery);
        
        if (!ordersSnapshot.empty) {
          const ordersData = ordersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            orderDate: doc.data().orderDate.toDate(),
            createdAt: doc.data().createdAt.toDate(),
            updatedAt: doc.data().updatedAt.toDate(),
            ...(doc.data().fulfilledAt ? { fulfilledAt: doc.data().fulfilledAt.toDate() } : {})
          } as Order));
          
          setOrders(ordersData);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching client details:', err);
        setError('Failed to load client details');
        setLoading(false);
      }
    };
    
    fetchClientData();
  }, [id]);
  
  const handleDeleteClient = async () => {
    if (!id || !currentUser || !client) return;
    
    try {
      // Delete client from Firestore
      await deleteDoc(doc(db, 'clients', id));
      
      // Log activity
      await logActivity(
        'deleted',
        'client',
        id,
        client.name,
        currentUser
      );
      
      // Navigate back to clients list
      navigate('/crm/clients');
    } catch (err) {
      console.error('Error deleting client:', err);
      setError('Failed to delete client');
      setShowDeleteModal(false);
    }
  };
  
  const handleAddNote = async () => {
    if (!id || !currentUser || !newNote.trim()) return;
    
    setAddingNote(true);
    
    try {
      // Create new note
      const noteData: Omit<ClientNote, 'id'> = {
        clientId: id,
        content: newNote.trim(),
        createdAt: new Date(),
        createdBy: currentUser.uid,
        createdByName: currentUser.displayName || currentUser.email || 'Unknown User',
        isPinned: false,
        isPrivate
      };
      
      // Add to Firestore
      const noteRef = await addDoc(
        collection(db, 'clients', id, 'notes'), 
        noteData
      );
      
      // Log activity
      await logActivity(
        'added',
        'note',
        noteRef.id,
        `Note for ${client?.name}`,
        currentUser
      );
      
      // Add to local state
      const newNoteWithId: ClientNote = {
        id: noteRef.id,
        ...noteData
      };
      
      setNotes([newNoteWithId, ...notes]);
      
      // Reset form
      setNewNote('');
      setIsPrivate(false);
      setAddingNote(false);
    } catch (err) {
      console.error('Error adding note:', err);
      setAddingNote(false);
    }
  };
  
  const handleDeleteNote = async () => {
    if (!id || !currentUser || !deletingNoteId) return;
    
    try {
      // Delete note from Firestore
      await deleteDoc(doc(db, 'clients', id, 'notes', deletingNoteId));
      
      // Log activity
      await logActivity(
        'deleted',
        'note',
        deletingNoteId,
        `Note for ${client?.name}`,
        currentUser
      );
      
      // Remove from local state
      setNotes(notes.filter(note => note.id !== deletingNoteId));
      
      // Reset state
      setDeletingNoteId(null);
      setShowNoteDeleteModal(false);
    } catch (err) {
      console.error('Error deleting note:', err);
      setShowNoteDeleteModal(false);
    }
  };
  
  const handleToggleNotePin = async (noteId: string, currentPinned: boolean) => {
    if (!id || !currentUser) return;
    
    try {
      // Update note in Firestore
      await updateDoc(
        doc(db, 'clients', id, 'notes', noteId), 
        { 
          isPinned: !currentPinned 
        }
      );
      
      // Update in local state
      setNotes(notes.map(note => 
        note.id === noteId 
          ? { ...note, isPinned: !currentPinned } 
          : note
      ));
    } catch (err) {
      console.error('Error updating note:', err);
    }
  };
  
  const handleToggleNotePrivacy = async (noteId: string, currentPrivacy: boolean) => {
    if (!id || !currentUser) return;
    
    try {
      // Update note in Firestore
      await updateDoc(
        doc(db, 'clients', id, 'notes', noteId), 
        { 
          isPrivate: !currentPrivacy 
        }
      );
      
      // Update in local state
      setNotes(notes.map(note => 
        note.id === noteId 
          ? { ...note, isPrivate: !currentPrivacy } 
          : note
      ));
    } catch (err) {
      console.error('Error updating note privacy:', err);
    }
  };
  
  const confirmDeleteNote = (noteId: string) => {
    setDeletingNoteId(noteId);
    setShowNoteDeleteModal(true);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm sm:text-base text-gray-600">Loading client details...</span>
      </div>
    );
  }
  
  if (error || !client) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 sm:p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mr-2" />
          <p className="text-sm sm:text-base text-red-700">{error || 'Client not found'}</p>
        </div>
        <button 
          onClick={() => navigate('/crm/clients')}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </button>
      </div>
    );
  }
  
  // Sort notes so pinned ones are at the top
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 sm:mb-4 gap-2 sm:gap-0">
        <div className="flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-800">{client.name}</h1>
              {client.companyName && (
                <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  {client.companyName}
                </span>
              )}
              {!client.isActive && (
                <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-xs sm:text-base text-gray-600">
              Client since {format(client.createdAt, 'MMMM d, yyyy')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Link
            to={`/crm/clients/${id}/edit`}
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Edit className="h-4 w-4 mr-1.5" />
            Edit Client
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
          >
            <Trash className="h-4 w-4 mr-1.5" />
            Delete
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* Client Information Card */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Client Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Contact Information</h3>
                <ul className="space-y-2">
                  {client.email && (
                    <li className="flex items-center text-sm text-gray-800">
                      <Mail className="h-4 w-4 mr-2 text-indigo-500" />
                      <a href={`mailto:${client.email}`} className="hover:text-indigo-600">
                        {client.email}
                      </a>
                    </li>
                  )}
                  {client.phone && (
                    <li className="flex items-center text-sm text-gray-800">
                      <Phone className="h-4 w-4 mr-2 text-indigo-500" />
                      <a href={`tel:${client.phone}`} className="hover:text-indigo-600">
                        {client.phone}
                      </a>
                    </li>
                  )}
                  {client.website && (
                    <li className="flex items-center text-sm text-gray-800">
                      <Globe className="h-4 w-4 mr-2 text-indigo-500" />
                      <a 
                        href={client.website.startsWith('http') ? client.website : `https://${client.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-indigo-600"
                      >
                        {client.website}
                      </a>
                    </li>
                  )}
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Company Details</h3>
                <ul className="space-y-2">
                  {client.companyName && (
                    <li className="flex items-center text-sm text-gray-800">
                      <Building className="h-4 w-4 mr-2 text-indigo-500" />
                      {client.companyName}
                    </li>
                  )}
                  {client.contactPerson && (
                    <li className="flex items-center text-sm text-gray-800">
                      <User className="h-4 w-4 mr-2 text-indigo-500" />
                      {client.contactPerson}
                      {client.contactRole && (
                        <span className="ml-1 text-gray-500">({client.contactRole})</span>
                      )}
                    </li>
                  )}
                  {client.taxId && (
                    <li className="flex items-center text-sm text-gray-800">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2 text-indigo-500">
                        <rect width="20" height="14" x="2" y="5" rx="2" />
                        <line x1="2" x2="22" y1="10" y2="10" />
                      </svg>
                      VAT: {client.taxId}
                    </li>
                  )}
                </ul>
              </div>
              
              {client.address && Object.values(client.address).some(val => val) && (
                <div className="sm:col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Address</h3>
                  <div className="flex items-start text-sm text-gray-800">
                    <MapPin className="h-4 w-4 mr-2 text-indigo-500 mt-1" />
                    <div>
                      {client.address.address1 && <div>{client.address.address1}</div>}
                      {client.address.address2 && <div>{client.address.address2}</div>}
                      {(client.address.city || client.address.state || client.address.postcode) && (
                        <div>
                          {client.address.city && `${client.address.city}, `}
                          {client.address.state && `${client.address.state} `}
                          {client.address.postcode && client.address.postcode}
                        </div>
                      )}
                      {client.address.country && <div>{client.address.country}</div>}
                    </div>
                  </div>
                </div>
              )}
              
              {client.tags && client.tags.length > 0 && (
                <div className="sm:col-span-2">
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Tags</h3>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {client.tags.map(tag => (
                      <span 
                        key={tag} 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Order History */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Order History</h2>
              <Link
                to={`/orders?clientId=${id}`}
                className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-900"
              >
                View all orders
              </Link>
            </div>
            
            {orders.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No orders yet</h3>
                <p className="mt-1 text-sm text-gray-500">This client hasn't placed any orders yet.</p>
                <div className="mt-6">
                  <Link
                    to="/orders/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create Order
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Order Number
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orders.slice(0, 5).map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-indigo-600">
                              {order.orderNumber}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {format(order.orderDate, 'MMM d, yyyy')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              order.status === 'completed' ? 'bg-green-100 text-green-800' :
                              order.status === 'processing' || order.status === 'pregatita' ? 'bg-blue-100 text-blue-800' :
                              order.status === 'cancelled' || order.status === 'failed' || order.status === 'refuzata' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {order.total.toLocaleString()} RON
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link 
                              to={`/orders/${order.id}`} 
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {orders.length > 5 && (
                  <div className="mt-4 text-center">
                    <Link 
                      to={`/orders?clientId=${id}`}
                      className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-900"
                    >
                      View all {orders.length} orders
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Notes Section */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Notes</h2>
            
            {/* Add new note */}
            <div className="mb-6 border border-gray-200 rounded-lg p-3">
              <label htmlFor="newNote" className="block text-sm font-medium text-gray-700 mb-1.5">
                <MessageSquare className="h-4 w-4 inline-block mr-1" /> 
                Add a New Note
              </label>
              <textarea
                id="newNote"
                rows={3}
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm mb-3"
                placeholder="Enter a new note..."
              ></textarea>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPrivate"
                    checked={isPrivate}
                    onChange={() => setIsPrivate(!isPrivate)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isPrivate" className="ml-2 text-xs text-gray-700 flex items-center">
                    <EyeOff className="h-3.5 w-3.5 mr-1 text-gray-500" />
                    Private Note
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {addingNote ? (
                    <>
                      <Loader2 className="animate-spin h-3 w-3 mr-1" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Add Note
                    </>
                  )}
                </button>
              </div>
            </div>
            
            {/* Notes list */}
            {notes.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No notes yet</h3>
                <p className="mt-1 text-sm text-gray-500">Add a note to keep track of important client information.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedNotes.map((note) => (
                  <div 
                    key={note.id}
                    className={`border rounded-lg p-3 ${
                      note.isPrivate ? 'bg-gray-50 border-gray-200' : 
                      note.isPinned ? 'bg-yellow-50 border-yellow-200' : 
                      'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <span className="text-xs font-medium text-gray-700">
                          {note.createdByName}
                        </span>
                        <span className="mx-1 text-gray-400">&bull;</span>
                        <span className="text-xs text-gray-500">
                          {format(note.createdAt, 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <div className="flex space-x-1">
                        {note.isPrivate && (
                          <div className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded flex items-center">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Private
                          </div>
                        )}
                        
                        {note.isPinned && (
                          <div className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded flex items-center">
                            <Pin className="h-3 w-3 mr-1" />
                            Pinned
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-800 whitespace-pre-wrap">
                      {note.content}
                    </div>
                    
                    <div className="flex justify-end mt-2 space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleNotePin(note.id, !!note.isPinned)}
                        className={`text-xs flex items-center ${
                          note.isPinned ? 'text-yellow-600 hover:text-yellow-800' : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title={note.isPinned ? "Unpin note" : "Pin note"}
                      >
                        <Pin className="h-3 w-3 mr-1" />
                        {note.isPinned ? "Unpin" : "Pin"}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => handleToggleNotePrivacy(note.id, !!note.isPrivate)}
                        className="text-xs flex items-center text-gray-500 hover:text-gray-700"
                        title={note.isPrivate ? "Make public" : "Make private"}
                      >
                        {note.isPrivate ? (
                          <>
                            <Eye className="h-3 w-3 mr-1" />
                            Make Public
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-3 w-3 mr-1" />
                            Make Private
                          </>
                        )}
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => confirmDeleteNote(note.id)}
                        className="text-xs flex items-center text-red-500 hover:text-red-700"
                        title="Delete note"
                      >
                        <Trash className="h-3 w-3 mr-1" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-4 sm:space-y-6">
          {/* Client Overview Card */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Client Overview</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50 p-3 rounded-lg">
                <p className="text-xs text-indigo-700 mb-1">Total Orders</p>
                <div className="flex items-center">
                  <ShoppingBag className="h-4 w-4 text-indigo-600 mr-1" />
                  <span className="text-lg font-bold text-indigo-900">{client.totalOrders}</span>
                </div>
              </div>
              
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-xs text-green-700 mb-1">Total Spent</p>
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-lg font-bold text-green-900">{client.totalSpent.toLocaleString()} RON</span>
                </div>
              </div>
              
              <div className="col-span-2 bg-blue-50 p-3 rounded-lg">
                <p className="text-xs text-blue-700 mb-1">Average Order Value</p>
                <div className="flex items-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-600 mr-1">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM8.5 8.5h7M10 7V5M14 7V5M8.5 12.5h7M10 11V9M14 11V9M8.5 16.5h7M10 15v-2M14 15v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-lg font-bold text-blue-900">
                    {client.totalOrders > 0 
                      ? (client.totalSpent / client.totalOrders).toLocaleString() 
                      : 0} RON
                  </span>
                </div>
              </div>
            </div>
            
            {client.lastOrderDate && (
              <div className="mt-4">
                <p className="text-xs text-gray-500 mb-1">Last Order</p>
                <div className="flex items-center text-sm">
                  <Calendar className="h-4 w-4 text-indigo-500 mr-1.5" />
                  {format(client.lastOrderDate, 'MMMM d, yyyy')}
                </div>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-1">Client Status</p>
              <div className={`flex items-center ${client.isActive ? 'text-green-700' : 'text-red-700'}`}>
                <span className={`inline-block h-2.5 w-2.5 rounded-full mr-2 ${client.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-sm font-medium">
                  {client.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Quick Actions Card */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link
                to={`/orders/new?clientId=${client.id}`}
                className="inline-flex w-full items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <ShoppingBag className="h-4 w-4 mr-2" />
                Create New Order
              </Link>
              
              <Link
                to={`/crm/clients/${client.id}/edit`}
                className="inline-flex w-full items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Client
              </Link>
              
              <button
                type="button"
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex w-full items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50 hover:border-red-300"
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete Client
              </button>
            </div>
          </div>
          
          {/* Related Information */}
          {/* You can add more sidebar components here as needed */}
        </div>
      </div>
      
      {/* Delete Client Confirmation Modal */}
      <Modal 
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Client"
      >
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Client</h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete {client.name}? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleDeleteClient}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setShowDeleteModal(false)}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </Modal>
      
      {/* Delete Note Confirmation Modal */}
      <Modal
        isOpen={showNoteDeleteModal}
        onClose={() => {
          setDeletingNoteId(null); 
          setShowNoteDeleteModal(false);
        }}
        title="Delete Note"
      >
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Note</h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete this note? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            onClick={handleDeleteNote}
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              setDeletingNoteId(null); 
              setShowNoteDeleteModal(false);
            }}
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default ClientDetails;