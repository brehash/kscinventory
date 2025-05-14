import React from 'react';
import { OrderStatus } from '../../types';
import { 
  Clock, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Package, 
  Truck 
} from 'lucide-react';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  const statusConfig = {
    'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="h-4 w-4 mr-2" /> },
    'processing': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <RefreshCw className="h-4 w-4 mr-2" /> },
    'on-hold': { bg: 'bg-purple-100', text: 'text-purple-800', icon: <AlertTriangle className="h-4 w-4 mr-2" /> },
    'completed': { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="h-4 w-4 mr-2" /> },
    'cancelled': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-2" /> },
    'refunded': { bg: 'bg-gray-100', text: 'text-gray-800', icon: <RefreshCw className="h-4 w-4 mr-2" /> },
    'failed': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-2" /> },
    'preluata': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <CheckCircle className="h-4 w-4 mr-2" /> },
    'impachetata': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: <Package className="h-4 w-4 mr-2" /> },
    'expediata': { bg: 'bg-teal-100', text: 'text-teal-800', icon: <Truck className="h-4 w-4 mr-2" /> },
    'returnata': { bg: 'bg-amber-100', text: 'text-amber-800', icon: <RefreshCw className="h-4 w-4 mr-2" /> },
    'refuzata': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-2" /> },
    'pregatita': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: <Package className="h-4 w-4 mr-2" /> },
    'neonorata': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-2" /> }
  };
  
  const config = statusConfig[status];
  
  if (!config) {
    // Default style for unknown statuses
    return (
      <span className="bg-gray-100 text-gray-800 px-2.5 py-1.5 rounded-full flex items-center text-sm">
        <Clock className="h-4 w-4 mr-2" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }
  
  return (
    <span className={`${config.bg} ${config.text} px-2.5 py-1.5 rounded-full flex items-center text-sm`}>
      {config.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default OrderStatusBadge;