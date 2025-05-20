import React, { useState } from 'react';
import { Calendar, Download, Loader2, FileSpreadsheet, File as FileCsv, File as FilePdf, FileJson, FileText, Shield, Check } from 'lucide-react';

/**
 * Export Center component to export data in various formats
 */
const ExportCenter: React.FC = () => {
  // State for date range
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // State for export options
  const [selectedDataType, setSelectedDataType] = useState<string>('products');
  const [selectedFormat, setSelectedFormat] = useState<string>('csv');
  const [includeHeaders, setIncludeHeaders] = useState<boolean>(true);
  const [includeImages, setIncludeImages] = useState<boolean>(false);
  
  // State for UI
  const [loading, setLoading] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  
  // Data type options
  const dataTypes = [
    { id: 'products', name: 'Products', description: 'Export all product data including stock levels', icon: <FileSpreadsheet className="h-6 w-6 text-indigo-500" /> },
    { id: 'orders', name: 'Orders', description: 'Export order history and details', icon: <FileCsv className="h-6 w-6 text-green-500" /> },
    { id: 'clients', name: 'Clients', description: 'Export client information and purchase history', icon: <FilePdf className="h-6 w-6 text-red-500" /> },
    { id: 'activities', name: 'Activity Log', description: 'Export system activity records', icon: <FileJson className="h-6 w-6 text-amber-500" /> }
  ];
  
  // Format options
  const formatTypes = [
    { id: 'csv', name: 'CSV', description: 'Comma-separated values, opens with Excel or Numbers', icon: <FileCsv className="h-5 w-5 text-green-500" /> },
    { id: 'xlsx', name: 'Excel', description: 'Native Microsoft Excel format with formatting', icon: <FileSpreadsheet className="h-5 w-5 text-blue-500" /> },
    { id: 'pdf', name: 'PDF', description: 'Portable Document Format for viewing and printing', icon: <FilePdf className="h-5 w-5 text-red-500" /> },
    { id: 'json', name: 'JSON', description: 'Structured data format for developers', icon: <FileJson className="h-5 w-5 text-amber-500" /> }
  ];
  
  const handleExport = () => {
    // This would be implemented to export the data
    setLoading(true);
    setExportProgress(0);
    
    // Simulate progress
    const interval = setInterval(() => {
      setExportProgress(prev => {
        if (prev === null) return 0;
        if (prev >= 100) {
          clearInterval(interval);
          setLoading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Export Center</h1>
        <p className="text-sm sm:text-base text-gray-600">Export data in various formats for external use</p>
      </div>
      
      {/* Data Selection */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Select Data to Export</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {dataTypes.map((type) => (
            <div 
              key={type.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                selectedDataType === type.id
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => setSelectedDataType(type.id)}
            >
              <div className="flex flex-col items-center text-center">
                {type.icon}
                <h3 className="text-sm font-medium mt-2">{type.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{type.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Export Options */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Export Options</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Format Selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">File Format</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formatTypes.map((format) => (
                <div 
                  key={format.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedFormat === format.id
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setSelectedFormat(format.id)}
                >
                  <div className="flex items-start">
                    {format.icon}
                    <div className="ml-3">
                      <h4 className="text-sm font-medium">{format.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{format.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Date Range and Other Options */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Data Range & Options</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1 text-gray-500" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1 text-gray-500" />
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center">
                  <input
                    id="includeHeaders"
                    name="includeHeaders"
                    type="checkbox"
                    checked={includeHeaders}
                    onChange={(e) => setIncludeHeaders(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="includeHeaders" className="ml-2 block text-sm text-gray-700">
                    Include column headers
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="includeImages"
                    name="includeImages"
                    type="checkbox"
                    checked={includeImages}
                    onChange={(e) => setIncludeImages(e.target.checked)}
                    disabled={selectedFormat !== 'pdf' && selectedFormat !== 'xlsx'}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded disabled:opacity-50"
                  />
                  <label htmlFor="includeImages" className={`ml-2 block text-sm ${
                    selectedFormat !== 'pdf' && selectedFormat !== 'xlsx' 
                      ? 'text-gray-400' 
                      : 'text-gray-700'
                  }`}>
                    Include images (PDF and Excel only)
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Export Actions */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="mb-4 sm:mb-0">
            <h2 className="text-base sm:text-lg font-semibold">Ready to Export</h2>
            <p className="text-sm text-gray-500">
              Click the button to generate your {formatTypes.find(f => f.id === selectedFormat)?.name} export
            </p>
          </div>
          
          <button
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {dataTypes.find(d => d.id === selectedDataType)?.name}
              </>
            )}
          </button>
        </div>
        
        {/* Progress Bar */}
        {exportProgress !== null && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-500">Export Progress</span>
              <span className="text-xs font-medium text-gray-500">{exportProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full" 
                style={{ width: `${exportProgress}%` }}
              ></div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {exportProgress < 100 
                ? 'Processing your export request...'
                : 'Export complete! Your download should begin automatically.'
              }
            </p>
          </div>
        )}
      </div>
      
      {/* Data Compliance Notice */}
      <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
        <div className="flex">
          <div className="flex-shrink-0">
            <Shield className="h-5 w-5 text-amber-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-semibold text-amber-800">Data Compliance Notice</h3>
            <p className="mt-1 text-xs text-amber-700">
              When exporting data, please ensure you comply with relevant data protection regulations such as GDPR. Client personal information should be handled according to your privacy policy.
            </p>
          </div>
        </div>
      </div>
      
      {/* Export Types */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Available Export Types</h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-start">
                <FileSpreadsheet className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <h3 className="text-base font-medium text-gray-900 mb-1">SAGA Export</h3>
                  <p className="text-sm text-gray-500">
                    Export inventory data compatible with SAGA accounting software
                  </p>
                  <div className="flex mt-2">
                    <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center">
                      <Check className="h-3 w-3 mr-1" />
                      Available
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-start">
                <FileText className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <h3 className="text-base font-medium text-gray-900 mb-1">Standard Exports</h3>
                  <p className="text-sm text-gray-500">
                    Export in standard formats like CSV, Excel, JSON, and PDF
                  </p>
                  <div className="flex mt-2">
                    <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center">
                      <Check className="h-3 w-3 mr-1" />
                      Available
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Coming Soon</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
              <li>QuickBooks Export</li>
              <li>XML Format for SAF-T Reporting</li>
              <li>Scheduled Automatic Exports</li>
              <li>Advanced Filtering Options</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportCenter;