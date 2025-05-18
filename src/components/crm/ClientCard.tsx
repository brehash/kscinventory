import React from 'react';
import { Client } from '../../types';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { User, Calendar, DollarSign, ShoppingBag, ChevronRight, CheckCircle, XCircle } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  onClick?: () => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ client, onClick }) => {
  return (
    <div 
      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-800 truncate">{client.name}</h3>
        <div className={`flex items-center ${
          client.isActive ? 'text-green-600' : 'text-red-600'
        } text-sm`}>
          {client.isActive ? (
            <>
              <CheckCircle className="h-4 w-4 mr-1" />
              <span>Active</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 mr-1" />
              <span>Inactive</span>
            </>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {client.email && (
          <div className="flex items-center text-sm text-gray-600">
            <User className="h-4 w-4 text-indigo-500 mr-1" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        
        {client.phone && (
          <div className="flex items-center text-sm text-gray-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500 mr-1">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="truncate">{client.phone}</span>
          </div>
        )}
        
        {client.companyName && (
          <div className="flex items-center text-sm text-gray-600 sm:col-span-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500 mr-1">
              <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4m-4-8h.01M11 7h.01M15 7h.01M11 11h.01M15 11h.01M11 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="truncate">{client.companyName}</span>
          </div>
        )}
      </div>
      
      <div className="border-t border-gray-100 pt-3 grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">Orders</p>
          <p className="font-semibold text-indigo-700 flex items-center">
            <ShoppingBag className="h-3.5 w-3.5 mr-1" />
            {client.totalOrders}
          </p>
        </div>
        
        <div>
          <p className="text-xs text-gray-500 mb-1">Total Spent</p>
          <p className="font-semibold text-green-700 flex items-center">
            <DollarSign className="h-3.5 w-3.5 mr-1" />
            {client.totalSpent.toLocaleString()} RON
          </p>
        </div>
        
        <div>
          <p className="text-xs text-gray-500 mb-1">Last Order</p>
          <p className="font-semibold text-gray-700 flex items-center">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            {client.lastOrderDate ? format(client.lastOrderDate, 'MM/dd/yy') : 'Never'}
          </p>
        </div>
      </div>
      
      <div className="mt-4 flex justify-end">
        <Link 
          to={`/crm/clients/${client.id}`}
          className="text-indigo-600 hover:text-indigo-800"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
};

export default ClientCard;