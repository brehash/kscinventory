import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart2, FileSpreadsheet, FileText, TrendingUp, FileBarChart, Share2 } from 'lucide-react';

/**
 * Menu component for the reporting section
 * Provides navigation to all reporting features
 */
const ReportingMenu: React.FC = () => {
  const menuItems = [
    {
      icon: <BarChart2 className="h-4 w-4 mr-2" />,
      label: 'Dashboard',
      path: '/reporting/dashboard',
    },
    {
      icon: <FileSpreadsheet className="h-4 w-4 mr-2" />,
      label: 'SAGA Export',
      path: '/reporting/saga-export',
    },
    {
      icon: <FileBarChart className="h-4 w-4 mr-2" />,
      label: 'Inventory Reports',
      path: '/reporting/inventory',
    },
    {
      icon: <TrendingUp className="h-4 w-4 mr-2" />,
      label: 'Sales Reports',
      path: '/reporting/sales',
    },
    {
      icon: <FileText className="h-4 w-4 mr-2" />,
      label: 'Custom Reports',
      path: '/reporting/custom',
    },
    {
      icon: <Share2 className="h-4 w-4 mr-2" />,
      label: 'Export Center',
      path: '/reporting/export',
    },
  ];

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
      <h2 className="text-base sm:text-lg font-semibold mb-4">Reports & Exports</h2>
      <ul className="space-y-2">
        {menuItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex items-center p-2 rounded-md text-sm ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Help & Resources
        </h3>
        <ul className="space-y-2">
          <li>
            <a
              href="https://www.sagasoft.ro/helpcenter/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-2 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-4 w-4 mr-2 text-gray-500" />
              <span>SAGA Documentation</span>
            </a>
          </li>
          <li>
            <a
              href="https://static.anaf.ro/static/10/Anaf/Declaratii_R/AplicatiiDec/SAF_T_RO_Financial_Declaration_Technical_Guide_for_Taxpayers_V_1.0.0.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-2 rounded-md text-sm text-gray-700 hover:bg-gray-50"
            >
              <FileText className="h-4 w-4 mr-2 text-gray-500" />
              <span>SAF-T Documentation</span>
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ReportingMenu;