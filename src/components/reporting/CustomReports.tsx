import React, { useState, useEffect } from 'react';
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
  CheckCircle,
  Search,
  Package,
  ShoppingBag,
  Users
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { exportCustom } from '../../utils/reportUtils';
import CustomReportsFieldSelector from './CustomReportsFieldSelector';
import ReportTooltip from './ReportTooltip';

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
  const [reportDescription, setReportDescription] = useState<string>('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [fieldSearchQuery, setFieldSearchQuery] = useState<string>('');
  const [selectedExportFormat, setSelectedExportFormat] = useState<'csv' | 'xlsx' | 'pdf' | 'json'>('csv');
  
  // Available field definitions
  const availableFieldsGroups = [
    {
      category: 'Product',
      icon: <Package className="h-4 w-4" />,
      fields: [
        { id: 'product_name', name: 'Product Name', description: 'Name of the product' },
        { id: 'product_barcode', name: 'Barcode', description: 'Product barcode or SKU' },
        { id: 'product_category', name: 'Category', description: 'Product category name' },
        { id: 'product_location', name: 'Location', description: 'Storage location name' },
        { id: 'product_type', name: 'Product Type', description: 'Type of product' },
        { id: 'product_provider', name: 'Provider', description: 'Supplier name' },
        { id: 'product_quantity', name: 'Quantity', description: 'Current stock level' },
        { id: 'product_min_quantity', name: 'Min Quantity', description: 'Minimum stock threshold' },
        { id: 'product_cost', name: 'Cost Price', description: 'Purchase cost per unit' },
        { id: 'product_price', name: 'Selling Price', description: 'Retail price per unit' },
        { id: 'product_vat', name: 'VAT Percentage', description: 'Value-added tax rate' },
        { id: 'product_total_value', name: 'Total Value', description: 'Total inventory value (cost × quantity)' },
        { id: 'product_total_selling', name: 'Total Selling Value', description: 'Total potential revenue (price × quantity)' },
        { id: 'product_created_at', name: 'Created Date', description: 'When the product was added' },
        { id: 'product_updated_at', name: 'Last Updated', description: 'When the product was last modified' }
      ]
    },
    {
      category: 'Order',
      icon: <ShoppingBag className="h-4 w-4" />,
      fields: [
        { id: 'order_number', name: 'Order Number', description: 'Unique order identifier' },
        { id: 'order_date', name: 'Order Date', description: 'When the order was created' },
        { id: 'order_customer', name: 'Customer Name', description: 'Name of the customer' },
        { id: 'order_email', name: 'Customer Email', description: 'Email address of the customer' },
        { id: 'order_status', name: 'Status', description: 'Current order status' },
        { id: 'order_subtotal', name: 'Subtotal', description: 'Order subtotal before shipping and tax' },
        { id: 'order_shipping', name: 'Shipping Cost', description: 'Shipping and handling fees' },
        { id: 'order_tax', name: 'Tax Amount', description: 'Total tax amount' },
        { id: 'order_total', name: 'Total', description: 'Final order total' },
        { id: 'order_payment_method', name: 'Payment Method', description: 'Method of payment' },
        { id: 'order_source', name: 'Order Source', description: 'Where the order originated (manual/WooCommerce)' },
        { id: 'order_shipping_address', name: 'Shipping Address', description: 'Delivery address' },
        { id: 'order_billing_address', name: 'Billing Address', description: 'Billing address' },
        { id: 'order_items_count', name: 'Number of Items', description: 'Total items in the order' },
        { id: 'order_fulfilled_at', name: 'Fulfillment Date', description: 'When the order was fulfilled' },
        { id: 'order_fulfilled_by', name: 'Fulfilled By', description: 'User who fulfilled the order' }
      ]
    },
    {
      category: 'Client',
      icon: <Users className="h-4 w-4" />,
      fields: [
        { id: 'client_name', name: 'Client Name', description: 'Name of the client' },
        { id: 'client_email', name: 'Email', description: 'Client email address' },
        { id: 'client_phone', name: 'Phone', description: 'Contact phone number' },
        { id: 'client_company', name: 'Company Name', description: 'Business name if applicable' },
        { id: 'client_tax_id', name: 'Tax ID/VAT', description: 'Tax identification number' },
        { id: 'client_contact_person', name: 'Contact Person', description: 'Primary contact name' },
        { id: 'client_contact_role', name: 'Contact Role', description: 'Role or position of primary contact' },
        { id: 'client_address', name: 'Address', description: 'Physical address' },
        { id: 'client_tags', name: 'Tags', description: 'Client categorization tags' },
        { id: 'client_status', name: 'Status', description: 'Active or inactive status' },
        { id: 'client_orders', name: 'Number of Orders', description: 'Total orders placed' },
        { id: 'client_total_spent', name: 'Total Spent', description: 'Lifetime spending amount' },
        { id: 'client_average_order', name: 'Average Order Value', description: 'Average spending per order' },
        { id: 'client_last_order', name: 'Last Order Date', description: 'Date of most recent order' },
        { id: 'client_created_at', name: 'Created Date', description: 'When the client was added' },
        { id: 'client_source', name: 'Client Source', description: 'Where the client originated from' }
      ]
    }
  ];
  
  // State for saved reports
  const [savedReports, setSavedReports] = useState<Array<{ id: string, name: string, description: string, fields: string[] }>>([
    { 
      id: '1', 
      name: 'Inventory Valuation', 
      description: 'Complete inventory list with cost and retail values',
      fields: ['product_name', 'product_quantity', 'product_cost', 'product_price', 'product_total_value'] 
    },
    { 
      id: '2', 
      name: 'Sales by Customer', 
      description: 'Order details grouped by customer',
      fields: ['order_customer', 'order_number', 'order_date', 'order_total'] 
    },
    { 
      id: '3', 
      name: 'Client Spending Analysis', 
      description: 'Client spending patterns and history',
      fields: ['client_name', 'client_email', 'client_orders', 'client_total_spent', 'client_average_order', 'client_last_order'] 
    },
    {
      id: '4',
      name: 'Comprehensive Product List',
      description: 'Detailed product information with all attributes',
      fields: ['product_name', 'product_barcode', 'product_category', 'product_location', 'product_provider', 'product_quantity', 'product_min_quantity', 'product_cost', 'product_price', 'product_vat', 'product_total_value']
    },
    {
      id: '5',
      name: 'Order Fulfillment Report',
      description: 'Track order processing and fulfillment',
      fields: ['order_number', 'order_date', 'order_customer', 'order_status', 'order_total', 'order_fulfilled_at', 'order_fulfilled_by']
    }
  ]);
  
  // State for UI
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [showReportBuilder, setShowReportBuilder] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Load saved reports from localStorage
  useEffect(() => {
    const savedReportsData = localStorage.getItem('customReports');
    if (savedReportsData) {
      try {
        const parsedReports = JSON.parse(savedReportsData);
        if (Array.isArray(parsedReports) && parsedReports.length > 0) {
          setSavedReports(parsedReports);
        }
      } catch (e) {
        console.error('Error loading saved reports:', e);
      }
    }
  }, []);
  
  // Save reports to localStorage when they change
  useEffect(() => {
    localStorage.setItem('customReports', JSON.stringify(savedReports));
  }, [savedReports]);
  
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
      description: reportDescription,
      fields: selectedFields
    };
    
    setSavedReports([...savedReports, newReport]);
    setReportName('');
    setReportDescription('');
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
  
  const deleteReport = (reportId: string) => {
    const updatedReports = savedReports.filter(r => r.id !== reportId);
    setSavedReports(updatedReports);
    
    if (activeReport === reportId) {
      setActiveReport(null);
      setSelectedFields([]);
    }
    
    setSuccess('Report template deleted');
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setSuccess(null);
    }, 3000);
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
            
            <div className="space-y-4">
              {/* Report metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reportName" className="block text-sm font-medium text-gray-700 mb-1">
                    Report Name
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      id="reportName"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="My Custom Report"
                    />
                    <div className="absolute right-2">
                      <ReportTooltip 
                        content="Give your report a descriptive name to easily identify it later"
                        position="top"
                      />
                    </div>
                  </div>
                </div>
                
                <div>
                  <label htmlFor="reportDescription" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      id="reportDescription"
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Report description (optional)"
                    />
                    <div className="absolute right-2">
                      <ReportTooltip 
                        content="Add details about what this report is used for"
                        position="top"
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Field search */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search available fields..."
                  value={fieldSearchQuery}
                  onChange={(e) => setFieldSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
              
              {/* Field selection */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Select Fields ({selectedFields.length} selected)
                  </label>
                  {selectedFields.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedFields([])}
                      className="text-xs text-indigo-600 hover:text-indigo-900"
                    >
                      Clear all
                    </button>
                  )}
                </div>
                
                <CustomReportsFieldSelector 
                  fieldsGroups={availableFieldsGroups}
                  selectedFields={selectedFields}
                  onToggleField={toggleFieldSelection}
                  searchQuery={fieldSearchQuery}
                />
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {savedReports.length === 0 ? (
              <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg">
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
                  className={`p-3 border rounded-lg transition-all ${
                    activeReport === report.id
                      ? 'bg-indigo-50 border-indigo-300'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">{report.name}</h3>
                      <div className="flex space-x-1">
                        <button 
                          onClick={() => loadSavedReport(report.id)}
                          className="p-1 rounded-full hover:bg-gray-200"
                          title="Load Report"
                        >
                          <FileText className="h-4 w-4 text-indigo-500" />
                        </button>
                        <button 
                          onClick={() => deleteReport(report.id)}
                          className="p-1 rounded-full hover:bg-gray-200"
                          title="Delete Report"
                        >
                          <Trash className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                    
                    {report.description && (
                      <p className="text-xs text-gray-500 mb-2">{report.description}</p>
                    )}
                    
                    <div 
                      className="text-xs text-gray-500 cursor-pointer"
                      onClick={() => loadSavedReport(report.id)}
                    >
                      {report.fields.length} fields selected
                    </div>
                    
                    <div className="mt-2 flex-grow">
                      <div className="flex flex-wrap gap-1 text-xs">
                        {/* Show first few field names */}
                        {report.fields.slice(0, 3).map(fieldId => {
                          // Find the field in availableFieldsGroups
                          let fieldName = '';
                          for (const group of availableFieldsGroups) {
                            const field = group.fields.find(f => f.id === fieldId);
                            if (field) {
                              fieldName = field.name;
                              break;
                            }
                          }
                          
                          return fieldName ? (
                            <span key={fieldId} className="bg-gray-100 px-1 py-0.5 rounded">
                              {fieldName}
                            </span>
                          ) : null;
                        })}
                        
                        {report.fields.length > 3 && (
                          <span className="text-gray-500">+{report.fields.length - 3} more</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-3 text-right">
                      <div className={`text-xs ${
                        activeReport === report.id
                          ? 'text-indigo-600 font-medium'
                          : 'text-gray-500'
                      }`}>
                        {activeReport === report.id ? 'Selected' : 'Click to select'}
                      </div>
                    </div>
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
                // Find the field in availableFieldsGroups
                let fieldName = '';
                for (const group of availableFieldsGroups) {
                  const field = group.fields.find(f => f.id === fieldId);
                  if (field) {
                    fieldName = field.name;
                    break;
                  }
                }
                
                return fieldName ? (
                  <span key={fieldId} className="m-1 bg-indigo-50 text-indigo-700 px-2 py-1 text-xs rounded-md">
                    {fieldName}
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