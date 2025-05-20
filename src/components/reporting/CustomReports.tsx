import React, { useState } from 'react';
import { 
  Calendar, 
  Filter, 
  Download, 
  Loader2, 
  FileText, 
  PlusCircle,
  Table,
  Columns,
  Save,
  X,
  Settings,
  AlertTriangle, 
  CheckCircle
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { exportCustom } from '../../utils/reportUtils';

/**
 * Custom Reports component allows users to create and save custom report configurations
 */
const CustomReports: React.FC = () => {
  const { currentUser } = useAuth();
  
  // State for date range
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // State for report builder
  const [reportName, setReportName] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedExportFormat, setSelectedExportFormat] = useState<'csv' | 'xlsx' | 'pdf' | 'json'>('csv');
  const [availableFields, setAvailableFields] = useState<Array<{ id: string, name: string, category: string }>>([
    // Product fields
    { id: 'product_name', name: 'Product Name', category: 'Product' },
    { id: 'product_barcode', name: 'Barcode', category: 'Product' },
    { id: 'product_category', name: 'Category', category: 'Product' },
    { id: 'product_location', name: 'Location', category: 'Product' },
    { id: 'product_quantity', name: 'Quantity', category: 'Product' },
    { id: 'product_cost', name: 'Cost Price', category: 'Product' },
    { id: 'product_price', name: 'Selling Price', category: 'Product' },
    
    // Order fields
    { id: 'order_number', name: 'Order Number', category: 'Order' },
    { id: 'order_date', name: 'Order Date', category: 'Order' },
    { id: 'order_customer', name: 'Customer', category: 'Order' },
    { id: 'order_status', name: 'Status', category: 'Order' },
    { id: 'order_total', name: 'Total', category: 'Order' },
    
    // Client fields
    { id: 'client_name', name: 'Client Name', category: 'Client' },
    { id: 'client_email', name: 'Email', category: 'Client' },
    { id: 'client_orders', name: 'Number of Orders', category: 'Client' },
    { id: 'client_total_spent', name: 'Total Spent', category: 'Client' }
  ]);
  
  // State for saved reports
  const [savedReports, setSavedReports] = useState<Array<{ id: string, name: string, fields: string[] }>>([
    { id: '1', name: 'Inventory Valuation', fields: ['product_name', 'product_quantity', 'product_cost', 'product_price'] },
    { id: '2', name: 'Sales by Customer', fields: ['order_customer', 'order_number', 'order_date', 'order_total'] },
    { id: '3', name: 'Client Spending Analysis', fields: ['client_name', 'client_email', 'client_orders', 'client_total_spent'] }
  ]);
  
  // State for UI
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [showReportBuilder, setShowReportBuilder] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Export format options
  const exportFormats = [
    { id: 'csv', name: 'CSV', description: 'Comma-separated values, opens with Excel or Numbers' },
    { id: 'xlsx', name: 'Excel', description: 'Native Microsoft Excel format with formatting' },
    { id: 'pdf', name: 'PDF', description: 'Portable Document Format for viewing and printing' },
    { id: 'json', name: 'JSON', description: 'Structured data format for developers' }
  ];
  
  const toggleFieldSelection = (fieldId: string) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(id => id !== fieldId));
    } else {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };
  
  const saveCustomReport = () => {
    if (!reportName || selectedFields.length === 0) {
      setError('Please provide a report name and select at least one field');
      return;
    }
    
    const newReport = {
      id: Date.now().toString(),
      name: reportName,
      fields: selectedFields
    };
    
    setSavedReports([...savedReports, newReport]);
    setReportName('');
    setSelectedFields([]);
    setShowReportBuilder(false);
    setSuccess('Report template saved successfully');
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
  };
  
  const loadSavedReport = (reportId: string) => {
    const report = savedReports.find(r => r.id === reportId);
    if (report) {
      setSelectedFields(report.fields);
      setActiveReport(reportId);
      setSuccess(`Loaded report template: ${report.name}`);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    }
  };
  
  const handleExport = async () => {
    if (!currentUser) {
      setError('You must be logged in to export data');
      return;
    }
    
    if (!activeReport || selectedFields.length === 0) {
      setError('Please select a report template first');
      return;
    }
    
    setExporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      await exportCustom(
        selectedFields,
        selectedExportFormat,
        true, // includeHeaders
        {
          startDate,
          endDate
        },
        currentUser
      );
      
      setSuccess(`Export completed successfully. Your ${selectedExportFormat.toUpperCase()} file has been downloaded.`);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  
  const generateReport = () => {
    // This would be implemented to generate the report based on selected fields
    if (!activeReport || selectedFields.length === 0) {
      setError('Please select a report template first');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Simulate loading time
    setTimeout(() => {
      setLoading(false);
      setSuccess('Report generated successfully. Ready to export.');
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    }, 1500);
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Custom Reports</h1>
        <p className="text-sm sm:text-base text-gray-600">Create and customize your own reports</p>
      </div>
      
      {/* Error and Success Messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}
      
      {/* Saved Reports */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold">My Reports</h2>
          <button
            onClick={() => setShowReportBuilder(!showReportBuilder)}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-offset-2 focus:ring-indigo-500"
          >
            {showReportBuilder ? (
              <>
                <X className="h-4 w-4 mr-1.5" /> 
                Cancel
              </>
            ) : (
              <>
                <PlusCircle className="h-4 w-4 mr-1.5" /> 
                Create New Report
              </>
            )}
          </button>
        </div>
        
        {showReportBuilder ? (
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <h3 className="text-base font-medium text-gray-800 mb-3">Report Builder</h3>
            
            <div className="mb-4">
              <label htmlFor="reportName" className="block text-sm font-medium text-gray-700 mb-1">
                Report Name
              </label>
              <input
                type="text"
                id="reportName"
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="My Custom Report"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Fields
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {['Product', 'Order', 'Client'].map(category => (
                  <div key={category} className="mb-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">{category} Fields</h4>
                    <div className="space-y-1 border border-gray-200 rounded-md p-2 bg-gray-50">
                      {availableFields
                        .filter(field => field.category === category)
                        .map(field => (
                          <div key={field.id} className="flex items-center">
                            <input
                              type="checkbox"
                              id={field.id}
                              checked={selectedFields.includes(field.id)}
                              onChange={() => toggleFieldSelection(field.id)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <label htmlFor={field.id} className="ml-2 block text-sm text-gray-700">
                              {field.name}
                            </label>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={saveCustomReport}
                disabled={!reportName || selectedFields.length === 0}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-1.5" />
                Save Report Template
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            {savedReports.length === 0 ? (
              <div className="col-span-3 text-center py-8 bg-gray-50 rounded-lg">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 mb-4">No saved reports</p>
                <button
                  onClick={() => setShowReportBuilder(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <PlusCircle className="h-4 w-4 mr-1.5" /> 
                  Create New Report
                </button>
              </div>
            ) : (
              savedReports.map(report => (
                <div
                  key={report.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    activeReport === report.id
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => loadSavedReport(report.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">{report.name}</h3>
                    <Settings className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </div>
                  <div className="text-xs text-gray-500">
                    {report.fields.length} fields selected
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    {/* Show first few field names */}
                    {report.fields.slice(0, 3).map(fieldId => {
                      const field = availableFields.find(f => f.id === fieldId);
                      return field ? <span key={fieldId} className="mr-1 bg-gray-100 px-1 py-0.5 rounded">{field.name}</span> : null;
                    })}
                    {report.fields.length > 3 && (
                      <span className="text-gray-500 ml-1">+{report.fields.length - 3} more</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      {/* Report Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Report Filters</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
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
        
        <div className="border-t border-gray-200 pt-4 mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Export Format</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {exportFormats.map(format => (
              <div 
                key={format.id}
                className={`border rounded-lg p-2 text-center cursor-pointer ${
                  selectedExportFormat === format.id 
                    ? 'bg-indigo-50 border-indigo-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedExportFormat(format.id as any)}
              >
                <div className="text-xs font-medium">{format.name}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleExport}
            disabled={exporting || selectedFields.length === 0 || !activeReport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </>
            )}
          </button>
          
          <button
            onClick={generateReport}
            disabled={loading || selectedFields.length === 0 || !activeReport}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Report Preview */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold">Report Preview</h2>
          {activeReport && (
            <div className="text-sm text-gray-500">
              {savedReports.find(r => r.id === activeReport)?.name}
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" />
            <span className="text-gray-500">Generating report...</span>
          </div>
        ) : !activeReport || selectedFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Table className="h-12 w-12 text-gray-300 mb-3" />
            {!activeReport ? (
              <p>Please select a report from "My Reports" section.</p>
            ) : (
              <p>No fields selected. Please configure your report.</p>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Columns className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Generate</h3>
            <p className="text-sm text-gray-500 mb-4">
              The following fields will be included in your report:
            </p>
            <div className="max-w-md mx-auto mb-6 flex flex-wrap justify-center">
              {selectedFields.map(fieldId => {
                const field = availableFields.find(f => f.id === fieldId);
                return field ? (
                  <span key={fieldId} className="m-1 bg-indigo-50 text-indigo-700 px-2 py-1 text-xs rounded-md">
                    {field.name}
                  </span>
                ) : null;
              })}
            </div>
            <button
              onClick={generateReport}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </button>
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">About Custom Reports</h3>
        <p className="text-sm text-blue-700">
          Custom reports allow you to create and save report configurations tailored to your specific needs. Select the fields you want to include, set filters, and save the report for quick access in the future.
        </p>
      </div>
    </div>
  );
};

export default CustomReports;