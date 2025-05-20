import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  FileSpreadsheet, 
  FileText, 
  TrendingUp, 
  FileBarChart, 
  Share2,
  ArrowRight
} from 'lucide-react';

/**
 * Home page for the reporting section
 * Displays cards for all available reporting features
 */
const ReportingHome: React.FC = () => {
  const navigate = useNavigate();
  
  const reportTypes = [
    {
      icon: <FileSpreadsheet className="h-8 w-8 text-indigo-600" />,
      title: 'SAGA Export',
      description: 'Generate inventory data export compatible with SAGA accounting software',
      path: '/reporting/saga-export',
      color: 'bg-indigo-50 border-indigo-200 hover:border-indigo-300',
      iconColor: 'text-indigo-600'
    },
    {
      icon: <FileBarChart className="h-8 w-8 text-green-600" />,
      title: 'Inventory Reports',
      description: 'Generate detailed reports about inventory levels, values and movements',
      path: '/reporting/inventory',
      color: 'bg-green-50 border-green-200 hover:border-green-300',
      iconColor: 'text-green-600'
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-blue-600" />,
      title: 'Sales Reports',
      description: 'Analyze sales performance, trends, and customer behavior',
      path: '/reporting/sales',
      color: 'bg-blue-50 border-blue-200 hover:border-blue-300',
      iconColor: 'text-blue-600'
    },
    {
      icon: <FileText className="h-8 w-8 text-amber-600" />,
      title: 'Custom Reports',
      description: 'Create customized reports based on specific requirements',
      path: '/reporting/custom',
      color: 'bg-amber-50 border-amber-200 hover:border-amber-300',
      iconColor: 'text-amber-600'
    },
    {
      icon: <Share2 className="h-8 w-8 text-purple-600" />,
      title: 'Export Center',
      description: 'Export data in various formats including CSV, Excel, and PDF',
      path: '/reporting/export',
      color: 'bg-purple-50 border-purple-200 hover:border-purple-300',
      iconColor: 'text-purple-600'
    },
    {
      icon: <BarChart2 className="h-8 w-8 text-teal-600" />,
      title: 'Reports Dashboard',
      description: 'Visual overview of key metrics and performance indicators',
      path: '/reporting/dashboard',
      color: 'bg-teal-50 border-teal-200 hover:border-teal-300',
      iconColor: 'text-teal-600'
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Reporting & Exports</h1>
        <p className="text-sm sm:text-base text-gray-600">Generate reports and export data from your inventory system</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {reportTypes.map((report) => (
          <div 
            key={report.path}
            className={`${report.color} p-4 sm:p-6 rounded-lg border cursor-pointer transition-all duration-200`}
            onClick={() => navigate(report.path)}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center mb-3">
                {report.icon}
              </div>
              <h3 className="text-base font-semibold text-gray-800 mb-2">{report.title}</h3>
              <p className="text-sm text-gray-600 mb-4 flex-grow">{report.description}</p>
              <div className="flex justify-end mt-auto">
                <div className={`text-sm ${report.iconColor} flex items-center font-medium`}>
                  View <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">About Reporting</h2>
        <p className="text-sm text-gray-600 mb-4">
          The Reporting section provides tools to help you analyze your inventory and sales data, generate reports, and export data for accounting purposes.
        </p>
        <p className="text-sm text-gray-600">
          Use the SAGA Export feature to generate inventory data in a format compatible with SAGA accounting software, making it easy to import your inventory data into your accounting system.
        </p>
      </div>
    </div>
  );
};

export default ReportingHome;