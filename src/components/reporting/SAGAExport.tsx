import React, { useState } from 'react';
import { ArrowLeft, Calendar, Download, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { generateSagaExport } from '../../utils/sagaExportUtils';

const SAGAExport: React.FC = () => {
  const navigate = useNavigate();
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
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Handle download button click
  const handleExport = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Validate date range
      if (!startDate || !endDate) {
        throw new Error('Please select both start and end dates');
      }
      
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        throw new Error('Invalid date format');
      }
      
      if (startDateObj > endDateObj) {
        throw new Error('Start date must be before end date');
      }
      
      // Generate the export data
      const exportData = await generateSagaExport(startDate, endDate, currentUser);
      
      if (!exportData || !exportData.data) {
        throw new Error('Failed to generate export data');
      }
      
      // Create a Blob from the data
      const blob = new Blob([exportData.data], { type: 'text/csv;charset=windows-1252' });
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Format file name with dates
      const startDateFormatted = startDate.replace(/-/g, '');
      const endDateFormatted = endDate.replace(/-/g, '');
      a.download = `SAGA_Export_${startDateFormatted}_${endDateFormatted}.csv`;
      
      // Trigger download
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setSuccess(`Export completed successfully. File: SAGA_Export_${startDateFormatted}_${endDateFormatted}.csv`);
    } catch (err) {
      console.error('Error exporting data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center mb-3 sm:mb-4">
        <button
          onClick={() => navigate(-1)}
          className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">SAGA Export</h1>
          <p className="text-xs sm:text-base text-gray-600">
            Generate inventory export compatible with SAGA accounting software
          </p>
        </div>
      </div>
      
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
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Export Settings</h2>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This tool generates a CSV file in the format required by SAGA accounting software. The file includes inventory stock values for the selected date range.
          </p>
          
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
                required
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
                required
              />
            </div>
          </div>
          
          <div className="bg-blue-50 p-3 sm:p-4 rounded-md border border-blue-100 text-sm">
            <h3 className="font-medium text-blue-800 flex items-center mb-2">
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Information
            </h3>
            <ul className="list-disc list-inside text-blue-700 space-y-1 text-xs sm:text-sm">
              <li>The exported file will be in CSV format with windows-1252 encoding (required by SAGA)</li>
              <li>All products in inventory during the selected period will be included</li>
              <li>The report includes opening and closing stock quantities and values</li>
              <li>File can be directly imported into SAGA accounting software</li>
              <li>Stock movements will be calculated based on activity logs</li>
            </ul>
          </div>
          
          <div className="flex justify-end">
            <button
              onClick={handleExport}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Generate SAGA Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Import Instructions</h2>
        
        <div className="space-y-4 text-sm">
          <p className="text-gray-600">
            To import this file into SAGA accounting software:
          </p>
          
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>Open SAGA accounting software</li>
            <li>Go to <span className="font-medium">Inventar (Inventory) &gt; Operatiuni (Operations) &gt; Import miscari Gestiune (Import Inventory Movements)</span></li>
            <li>Select the exported CSV file</li>
            <li>Follow the SAGA import wizard instructions</li>
            <li>Verify that the data has been imported correctly</li>
          </ol>
          
          <div className="bg-amber-50 p-3 rounded-md border border-amber-100">
            <h3 className="font-medium text-amber-800 flex items-center mb-1">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Important Note
            </h3>
            <p className="text-amber-700 text-xs sm:text-sm">
              Always verify the imported data in SAGA and consult with your accountant before finalizing the import process. Incorrect imports may affect your financial reporting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SAGAExport;