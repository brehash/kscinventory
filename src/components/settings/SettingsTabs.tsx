import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { MapPin, Tag, BoxesIcon, ShoppingBag, Settings, Store } from 'lucide-react';

const SettingsTabs: React.FC = () => {
  const location = useLocation();
  
  // Define the tabs for the settings page
  const tabs = [
    {
      name: 'Locations',
      path: '/settings/locations',
      icon: <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
    },
    {
      name: 'Categories',
      path: '/settings/categories',
      icon: <Tag className="h-4 w-4 sm:h-5 sm:w-5" />
    },
    {
      name: 'Product Types',
      path: '/settings/product-types',
      icon: <BoxesIcon className="h-4 w-4 sm:h-5 sm:w-5" />
    },
    {
      name: 'Providers',
      path: '/settings/providers',
      icon: <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
    },
    {
      name: 'WooCommerce',
      path: '/settings/woocommerce',
      icon: <Store className="h-4 w-4 sm:h-5 sm:w-5" />
    }
  ];
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-sm sm:text-base text-gray-600">Manage your inventory system settings</p>
      </div>
      
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8">
          {tabs.map((tab) => {
            const isActive = location.pathname === tab.path;
            return (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={`${
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                } flex items-center whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm`}
              >
                <span className={`${isActive ? 'text-indigo-500' : 'text-gray-400'} mr-1 sm:mr-2`}>
                  {tab.icon}
                </span>
                {tab.name}
              </NavLink>
            );
          })}
        </nav>
      </div>
      
      <div className="mt-4 sm:mt-6">
        <Outlet />
      </div>
    </div>
  );
};

export default SettingsTabs;