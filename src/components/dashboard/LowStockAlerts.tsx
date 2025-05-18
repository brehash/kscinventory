import React from 'react';
import { LowStockAlert } from '../../types';
import { AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LowStockAlertsProps {
  alerts: LowStockAlert[];
}

const LowStockAlerts: React.FC<LowStockAlertsProps> = ({ alerts }) => {
  // Show only the top 5 alerts on the dashboard
  const displayAlerts = alerts.slice(0, 5);
  
  if (alerts.length === 0) {
    return (
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Low Stock Alerts</h2>
        <div className="text-center py-6 sm:py-8 text-gray-500">
          <div className="mb-2">
            <AlertCircle className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-400" />
          </div>
          <p>No low stock alerts at the moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h2 className="text-base sm:text-lg font-semibold">Low Stock Alerts</h2>
        {alerts.length > 0 && (
          <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {alerts.length} alerts
          </span>
        )}
      </div>
      
      <div className="divide-y divide-gray-200">
        {displayAlerts.map(alert => (
          <div key={alert.id} className="py-3 flex items-center justify-between">
            <div className="flex items-start">
              <div className="p-1.5 bg-amber-100 rounded-full mr-3">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-sm sm:text-base text-gray-800">{alert.productName}</p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {alert.currentQuantity} / {alert.minQuantity} minimum 
                  <span className="mx-1">•</span>
                  {alert.locationName}
                </p>
              </div>
            </div>
            <Link 
              to={`/products/${alert.productId}`} 
              className="text-indigo-600 hover:text-indigo-800"
            >
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </Link>
          </div>
        ))}
      </div>
      
      {alerts.length > 5 && (
        <div className="mt-4 pt-3 border-t border-gray-200 text-center">
          <Link 
            to="/alerts"
            className="inline-flex items-center text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            View all {alerts.length} alerts <ExternalLink className="ml-1 h-3 w-3 sm:h-4 sm:w-4" />
          </Link>
        </div>
      )}
    </div>
  );
};

export default LowStockAlerts;