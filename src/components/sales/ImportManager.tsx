import React, { useState, useEffect } from 'react';
import { BulkSaleEntry, ExcelImportConfig, ImportPreview } from '../../types/sales';
import { parseCSV, extractTextFromPDF, parsePDFText, generateId } from '../../utils/fileUtils';
import { formatDate, parseDateWithFormat } from '../../utils/dateUtils';
import { X } from 'lucide-react';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error);
}

interface ImportManagerProps {
  onClose: () => void;
  onImportComplete: (entries: BulkSaleEntry[]) => Promise<void>;
}

const normalizeDate = (dateString: string, format: string): string => {
  try {
    // Handle different input formats
    let date: Date | null = null;
    
    // First try parseDateWithFormat if the format is specified
    if (format !== 'auto') {
      try {
        date = parseDateWithFormat(dateString, format as "DD-MMM-YYYY" | "DD/MM/YY" | "DD/MM/YYYY" | "MM/DD/YY" | "MM/DD/YYYY" | "YYYY-MM-DD");
      } catch (e) {
        console.warn('Could not parse with specified format', e);
      }
    } 
    
    // If still no valid date, try auto-detection
    if (!date || isNaN(date.getTime())) {
      // Try to automatically detect the format
      const formats = ['DD-MMM-YYYY', 'DD/MM/YY', 'DD/MM/YYYY', 'MM/DD/YY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const;
      
      for (const fmt of formats) {
        try {
          const parsedDate = parseDateWithFormat(dateString, fmt);
          if (parsedDate && !isNaN(parsedDate.getTime())) {
            date = parsedDate;
            break;
          }
        } catch (e) {
          // Continue trying other formats
        }
      }
    }
    
    // If still no valid date, try built-in Date parsing
    if (!date || isNaN(date.getTime())) {
      date = new Date(dateString);
    }
    
    // Check if we got a valid date
    if (!date || isNaN(date.getTime())) {
      console.error('Could not parse date:', dateString);
      return dateString; // Return original if couldn't parse
    }
    
    // Convert to YYYY-MM-DD format for database consistency
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('Error normalizing date:', error);
    return dateString; // Return original if couldn't parse
  }
};

const ImportManager: React.FC<ImportManagerProps> = ({ onClose, onImportComplete }) => {
  // Import process state
  const [importStep, setImportStep] = useState<1 | 2 | 3>(1);
  const [importConfig, setImportConfig] = useState<ExcelImportConfig>({
    dateColumn: '',
    amountColumn: '',
    paymentModeColumn: null,
    partyNameColumn: null,
    defaultPaymentMode: 'cash',
    defaultPartyName: '',
    useDefaultsWhenMissing: true,
    dateFormat: 'auto',
    dateFilter: {
      enabled: false,
      startDate: '',
      endDate: ''
    }
  });
  const [importPreview, setImportPreview] = useState<ImportPreview>({
    valid: [],
    invalid: [],
    dateSummary: [],
    duplicates: {
      groupCount: 0,
      entryCount: 0,
      mergedGroupCount: 0
    },
    processedCount: 0
  });
  const [datesToExclude, setDatesToExclude] = useState<Set<string>>(new Set());
  
  // Upload file state
  const [fileType, setFileType] = useState<'csv' | 'pdf'>('csv');
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [importInProgress, setImportInProgress] = useState(false);
  const [dateStatistics, setDateStatistics] = useState<Record<string, any>>({});

  // Grouping options state
  const [groupingOptions, setGroupingOptions] = useState({
    enableGrouping: false,
    groupingMode: 'dateAndAmount', // 'dateAndAmount', 'dateAndPaymentMode', 'dateOnly'
    combineGroupedEntries: false
  });
  
  // Add importError state near the other state declarations
  const [importError, setImportError] = useState<string | null>(null);
  
  // Clear the import state when step changes
  useEffect(() => {
    if (importStep === 1) {
      setCsvData([]);
      setCsvColumns([]);
      setImportPreview({
        valid: [],
        invalid: [],
        dateSummary: [],
        duplicates: {
          groupCount: 0,
          entryCount: 0,
          mergedGroupCount: 0
        },
        processedCount: 0
      });
      setDateStatistics({});
      setDatesToExclude(new Set());
    }
  }, [importStep]);
  
  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset import state
    setImportStep(1);
    setCsvData([]);
    setCsvColumns([]);
    setImportPreview({
      valid: [],
      invalid: [],
      dateSummary: [],
      duplicates: {
        groupCount: 0,
        entryCount: 0,
        mergedGroupCount: 0
      },
      processedCount: 0
    });
    
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          setFileType('pdf');
          
          // For PDF files
          try {
            const pdfText = await extractTextFromPDF(file);
            const { data, columns } = parsePDFText(pdfText);
            setCsvData(data);
            setCsvColumns(columns);
            setImportStep(2);
          } catch (error: unknown) {
            console.error('Error processing PDF:', error);
            alert('Error processing PDF: ' + getErrorMessage(error));
          }
        } else {
          setFileType('csv');
          
          // For CSV files
          const { data, columns } = parseCSV(content);
          setCsvData(data);
          setCsvColumns(columns);
          setImportStep(2);
        }
      } catch (error: unknown) {
        console.error('Error reading file:', error);
        alert('Error reading file: ' + getErrorMessage(error));
      }
    };
    
    reader.onerror = () => {
      alert('Error reading file');
    };
    
    reader.readAsText(file);
  };
  
  // Preview import data with the current configuration
  const previewImport = () => {
    const { dateColumn, amountColumn, paymentModeColumn, partyNameColumn, defaultPaymentMode, defaultPartyName, useDefaultsWhenMissing, dateFormat, dateFilter } = importConfig;
    
    if (!dateColumn || !amountColumn) {
      alert('Date and amount columns are required.');
      return;
    }
    
    const validEntries: BulkSaleEntry[] = [];
    const invalidEntries: Array<{row: any, reason: string}> = [];
    const dateStats: Record<string, { count: number, total: number, entries: BulkSaleEntry[] }> = {};
    
    // For duplicate detection
    const entryGroups: Record<string, BulkSaleEntry[]> = {};
    
    // Process each row
    for (const row of csvData) {
      let valid = true;
      let reason = '';
      
      // Check required fields
      if (!row[dateColumn] || !row[amountColumn]) {
        valid = false;
        reason = `Missing required data: ${!row[dateColumn] ? 'date' : 'amount'}`;
      }
      
      // Try to parse amount as number
      const amount = parseFloat(row[amountColumn]?.toString().replace(/[^0-9.-]+/g, '') || '');
      if (isNaN(amount)) {
        valid = false;
        reason = `Invalid amount: ${row[amountColumn]}`;
      }
      
      // Try to parse date using the selected format
      let date = '';
      let parsedDate: Date | null = null;
      try {
        const rawDate = row[dateColumn];
        
        if (typeof rawDate === 'string') {
          parsedDate = parseDateWithFormat(rawDate, dateFormat);
          
          if (parsedDate) {
            date = formatDate(parsedDate, 'yyyy-MM-dd');
            
            // Apply date filtering if enabled
            if (dateFilter.enabled) {
              const isAfterStartDate = !dateFilter.startDate || date >= dateFilter.startDate;
              const isBeforeEndDate = !dateFilter.endDate || date <= dateFilter.endDate;
              
              if (!isAfterStartDate || !isBeforeEndDate) {
                valid = false;
                reason = `Date ${date} is outside the selected date range (${dateFilter.startDate || 'any'} to ${dateFilter.endDate || 'any'})`;
              }
            }
          } else {
            valid = false;
            reason = `Invalid date format: ${rawDate}. Try selecting a different date format.`;
          }
        } else if (rawDate && typeof rawDate === 'object' && 'getTime' in rawDate) {
          date = formatDate(rawDate, 'yyyy-MM-dd');
          parsedDate = rawDate;
          
          // Apply date filtering if enabled
          if (dateFilter.enabled) {
            const isAfterStartDate = !dateFilter.startDate || date >= dateFilter.startDate;
            const isBeforeEndDate = !dateFilter.endDate || date <= dateFilter.endDate;
            
            if (!isAfterStartDate || !isBeforeEndDate) {
              valid = false;
              reason = `Date ${date} is outside the selected date range (${dateFilter.startDate || 'any'} to ${dateFilter.endDate || 'any'})`;
            }
          }
        } else {
          valid = false;
          reason = `Invalid date: ${rawDate}`;
        }
      } catch (error: unknown) {
        valid = false;
        reason = `Invalid date: ${row[dateColumn]}`;
      }
      
      // Determine payment mode
      let paymentMode: 'cash' | 'digital' | 'credit' = defaultPaymentMode;
      if (paymentModeColumn && row[paymentModeColumn]) {
        const mode = row[paymentModeColumn].toString().toLowerCase();
        if (mode.includes('cash')) {
          paymentMode = 'cash';
        } else if (mode.includes('digital') || mode.includes('online') || mode.includes('upi') || mode.includes('card')) {
          paymentMode = 'digital';
        } else if (mode.includes('credit') || mode.includes('loan') || mode.includes('due')) {
          paymentMode = 'credit';
        }
      }
      
      // Check party name for credit payments
      let partyName = partyNameColumn ? row[partyNameColumn]?.toString() || '' : '';
      if (paymentMode === 'credit' && !partyName && defaultPartyName && useDefaultsWhenMissing) {
        partyName = defaultPartyName;
      } else if (paymentMode === 'credit' && !partyName) {
        valid = false;
        reason = 'Credit payment requires a party name';
      }
      
      // Create entry
      if (valid) {
        const entry = {
          id: generateId(),
          date: normalizeDate(date, dateFormat),
          amount: amount.toString(),
          payment_mode: paymentMode,
          party_name: partyName
        };
        
        // Update date statistics
        if (!dateStats[entry.date]) {
          dateStats[entry.date] = { count: 0, total: 0, entries: [] };
        }
        dateStats[entry.date].count += 1;
        dateStats[entry.date].total += amount;
        dateStats[entry.date].entries.push(entry);
        
        // Group by date and amount for duplicate detection
        if (groupingOptions.enableGrouping) {
          const groupKey = getGroupKey(entry.date, entry.amount, entry.payment_mode);
          
          if (!entryGroups[groupKey]) {
            entryGroups[groupKey] = [];
          }
          entryGroups[groupKey].push(entry);
        }
        
        validEntries.push(entry);
      } else {
        invalidEntries.push({ row, reason });
      }
    }
    
    // Process grouped entries if enabled
    let finalEntries: BulkSaleEntry[] = [];
    let mergedGroupCount = 0;
    let totalEntriesBeforeGrouping = 0;
    
    if (groupingOptions.enableGrouping) {
      // Identify duplicates and optionally combine them
      const duplicateGroups = Object.values(entryGroups).filter(group => group.length > 1);
      totalEntriesBeforeGrouping = validEntries.length;
      
      if (groupingOptions.combineGroupedEntries) {
        // Combine grouped entries
        Object.values(entryGroups).forEach(group => {
          if (group.length > 1) {
            mergedGroupCount += (group.length - 1);
            
            // Create a combined entry
            const firstEntry = group[0];
            const combinedEntry: BulkSaleEntry = {
              ...firstEntry,
              amount: group.reduce((sum, entry) => sum + parseFloat(entry.amount), 0).toString(),
              isCombined: true,
              originalCount: group.length
            };
            
            finalEntries.push(combinedEntry);
          } else if (group.length === 1) {
            finalEntries.push(group[0]);
          }
        });
      } else {
        // Just flag potential duplicates without combining
        finalEntries = validEntries.map(entry => {
          const groupKey = getGroupKey(entry.date, entry.amount, entry.payment_mode);
          const group = entryGroups[groupKey];
          return {
            ...entry,
            hasDuplicates: group && group.length > 1
          };
        });
      }
    } else {
      finalEntries = validEntries;
    }
    
    setDateStatistics(dateStats);
    setDatesToExclude(new Set());
    
    // Add information about duplicates
    setImportPreview({ 
      valid: finalEntries, 
      invalid: invalidEntries,
      dateSummary: Object.entries(dateStats).map(([date, stats]) => ({
        date,
        totalAmount: stats.total,
        entriesCount: stats.count,
        paymentModes: {
          cash: stats.entries.filter(e => e.payment_mode === 'cash').length,
          digital: stats.entries.filter(e => e.payment_mode === 'digital').length,
          credit: stats.entries.filter(e => e.payment_mode === 'credit').length
        }
      })),
      duplicates: {
        groupCount: Object.values(entryGroups).filter(group => group.length > 1).length,
        entryCount: totalEntriesBeforeGrouping - finalEntries.length,
        mergedGroupCount: mergedGroupCount
      },
      processedCount: finalEntries.length
    });
    setImportStep(3);
  };
  
  // Fix the processImport function to include validation, confirmation and error handling
  const processImport = async () => {
    if (importPreview.valid.length === 0) {
      alert('No valid entries to import.');
      return;
    }
    
    // Filter out entries with excluded dates
    const filteredEntries = importPreview.valid.filter((entry: any) => !datesToExclude.has(entry.date));
    
    if (filteredEntries.length === 0) {
      alert('All entries have been excluded. Nothing to import.');
      return;
    }
    
    // Show confirmation
    if (!window.confirm(`Are you sure you want to import ${filteredEntries.length} entries? This cannot be undone.`)) {
      return;
    }
    
    setImportInProgress(true);
    
    try {
      // Normalize dates for all entries before importing
      const normalizedEntries = filteredEntries.map(entry => ({
        ...entry,
        // Ensure date is in YYYY-MM-DD format for database consistency
        date: normalizeDate(entry.date, importConfig.dateFormat)
      }));
      
      // Call the provided onImportComplete function
      await onImportComplete(normalizedEntries);
      
      // Reset import state
      onClose();
      setImportStep(1);
      setCsvData([]);
      setCsvColumns([]);
      setImportPreview({ 
        valid: [], 
        invalid: [], 
        dateSummary: [],
        duplicates: {
          groupCount: 0,
          entryCount: 0,
          mergedGroupCount: 0
        },
        processedCount: 0
      });
      setDateStatistics({});
      setDatesToExclude(new Set());
      
      // Show success message
      alert(`Successfully imported ${normalizedEntries.length} sales.`);
    } catch (error: unknown) {
      console.error('Error importing sales:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setImportError(`Import failed: ${errorMessage}`);
      alert('Error importing sales. Please try again.');
    } finally {
      setImportInProgress(false);
    }
  };
  
  // Toggle date exclusion
  const toggleDateExclusion = (date: string) => {
    const newExclusions = new Set(datesToExclude);
    if (newExclusions.has(date)) {
      newExclusions.delete(date);
    } else {
      newExclusions.add(date);
    }
    setDatesToExclude(newExclusions);
  };

  // Define the getGroupKey function to avoid duplication
  function getGroupKey(date: string, amount: string | number, paymentMode: string) {
    const amountValue = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (groupingOptions.groupingMode === 'dateAndAmount') {
      return `${date}_${amountValue}_${paymentMode}`;
    } else if (groupingOptions.groupingMode === 'dateAndPaymentMode') {
      return `${date}_${paymentMode}`;
    } else if (groupingOptions.groupingMode === 'dateOnly') {
      return `${date}`;
    }
    return '';
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between bg-indigo-600 text-white p-4 rounded-t-lg">
          <h3 className="text-lg font-medium">Import Sales Data</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload file */}
          {importStep === 1 && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium">Step 1: Upload File</h4>
              <p className="text-gray-600">Upload a CSV or PDF file containing sales data.</p>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  onClick={(e) => {
                    // Ensure the click reaches the input
                    const fileInput = document.getElementById('file-upload');
                    if (fileInput) {
                      (fileInput as HTMLInputElement).click();
                    }
                    e.preventDefault(); // Prevent double triggers
                  }}
                >
                  Choose File
                </label>
                <p className="mt-2 text-sm text-gray-500">
                  Supported formats: CSV, PDF
                </p>
              </div>
            </div>
          )}
          
          {/* Step 2: Configure import */}
          {importStep === 2 && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium">Step 2: Configure Import</h4>
              <p className="text-gray-600">Map columns and set import options.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Column *
                  </label>
                  <select
                    value={importConfig.dateColumn}
                    onChange={(e) => setImportConfig({ ...importConfig, dateColumn: e.target.value })}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Select Column</option>
                    {csvColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount Column *
                  </label>
                  <select
                    value={importConfig.amountColumn}
                    onChange={(e) => setImportConfig({ ...importConfig, amountColumn: e.target.value })}
                    className="w-full p-2 border rounded-md"
                    required
                  >
                    <option value="">Select Column</option>
                    {csvColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Mode Column
                  </label>
                  <select
                    value={importConfig.paymentModeColumn || ''}
                    onChange={(e) => setImportConfig({ ...importConfig, paymentModeColumn: e.target.value || null })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Not Available</option>
                    {csvColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Party Name Column
                  </label>
                  <select
                    value={importConfig.partyNameColumn || ''}
                    onChange={(e) => setImportConfig({ ...importConfig, partyNameColumn: e.target.value || null })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">Not Available</option>
                    {csvColumns.map((column) => (
                      <option key={column} value={column}>
                        {column}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Payment Mode
                  </label>
                  <select
                    value={importConfig.defaultPaymentMode}
                    onChange={(e) => setImportConfig({ 
                      ...importConfig, 
                      defaultPaymentMode: e.target.value as 'cash' | 'digital' | 'credit' 
                    })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="cash">Cash</option>
                    <option value="digital">Digital</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Party Name (for credit entries)
                  </label>
                  <input
                    type="text"
                    value={importConfig.defaultPartyName}
                    onChange={(e) => setImportConfig({ ...importConfig, defaultPartyName: e.target.value })}
                    className="w-full p-2 border rounded-md"
                    placeholder="Enter default party name"
                  />
                </div>
                
                <div className="col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={importConfig.useDefaultsWhenMissing}
                      onChange={(e) => setImportConfig({ ...importConfig, useDefaultsWhenMissing: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Use defaults when values are missing
                    </span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Format
                  </label>
                  <select
                    value={importConfig.dateFormat}
                    onChange={(e) => setImportConfig({ 
                      ...importConfig, 
                      dateFormat: e.target.value as ExcelImportConfig['dateFormat'] 
                    })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="DD/MM/YY">DD/MM/YY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="MM/DD/YY">MM/DD/YY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD-MMM-YYYY">DD-MMM-YYYY (01-Feb-2023)</option>
                  </select>
                </div>
                
                <div>
                  <div className="flex items-center mb-2">
                    <input
                      type="checkbox"
                      id="enable-date-filter"
                      checked={importConfig.dateFilter.enabled}
                      onChange={(e) => setImportConfig({
                        ...importConfig,
                        dateFilter: {
                          ...importConfig.dateFilter,
                          enabled: e.target.checked
                        }
                      })}
                      className="rounded mr-2"
                    />
                    <label htmlFor="enable-date-filter" className="text-sm font-medium text-gray-700">
                      Enable Date Filtering
                    </label>
                  </div>
                  
                  {importConfig.dateFilter.enabled && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={importConfig.dateFilter.startDate}
                          onChange={(e) => setImportConfig({
                            ...importConfig,
                            dateFilter: {
                              ...importConfig.dateFilter,
                              startDate: e.target.value
                            }
                          })}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={importConfig.dateFilter.endDate}
                          onChange={(e) => setImportConfig({
                            ...importConfig,
                            dateFilter: {
                              ...importConfig.dateFilter,
                              endDate: e.target.value
                            }
                          })}
                          className="w-full p-2 border rounded-md"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-6 border-t pt-4">
                <h5 className="font-medium mb-3">Advanced Import Options</h5>
                
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={groupingOptions.enableGrouping}
                        onChange={(e) => setGroupingOptions({
                          ...groupingOptions,
                          enableGrouping: e.target.checked
                        })}
                        className="rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Club sales entries (group by date)
                      </span>
                    </label>
                  </div>
                  
                  {groupingOptions.enableGrouping && (
                    <div className="ml-6 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Grouping Method:
                        </p>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="groupingMode"
                              checked={groupingOptions.groupingMode === 'dateOnly'}
                              onChange={() => setGroupingOptions({
                                ...groupingOptions,
                                groupingMode: 'dateOnly'
                              })}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-700">
                              Group by date only (all entries for a day combined)
                            </span>
                          </label>
                          
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="groupingMode"
                              checked={groupingOptions.groupingMode === 'dateAndPaymentMode'}
                              onChange={() => setGroupingOptions({
                                ...groupingOptions,
                                groupingMode: 'dateAndPaymentMode'
                              })}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-700">
                              Group by date and payment mode (separate cash/digital/credit)
                            </span>
                          </label>
                          
                          <label className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name="groupingMode"
                              checked={groupingOptions.groupingMode === 'dateAndAmount'}
                              onChange={() => setGroupingOptions({
                                ...groupingOptions,
                                groupingMode: 'dateAndAmount'
                              })}
                              className="rounded"
                            />
                            <span className="text-sm text-gray-700">
                              Only group identical entries (same date, amount, payment mode)
                            </span>
                          </label>
                        </div>
                      </div>
                      
                      <div>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={groupingOptions.combineGroupedEntries}
                            onChange={(e) => setGroupingOptions({
                              ...groupingOptions,
                              combineGroupedEntries: e.target.checked
                            })}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">
                            Automatically combine grouped entries
                          </span>
                        </label>
                        <p className="text-xs text-gray-500 ml-6 mt-1">
                          {groupingOptions.groupingMode === 'dateOnly' 
                            ? "This will merge all entries from the same date into a single entry."
                            : groupingOptions.groupingMode === 'dateAndPaymentMode'
                              ? "This will merge entries from the same date and payment mode."
                              : "This will merge duplicate entries with the same date, amount, and payment mode."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="border p-4 rounded-md bg-gray-50">
                <h5 className="font-medium mb-2">Data Preview</h5>
                <div className="overflow-x-auto max-h-40">
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        {csvColumns.map((column) => (
                          <th key={column} className="p-2 text-left text-xs font-medium text-gray-500 border">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.slice(0, 5).map((row, index) => (
                        <tr key={index} className="border-t">
                          {csvColumns.map((column) => (
                            <td key={column} className="p-2 text-xs border">
                              {row[column] || ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Showing first 5 rows of {csvData.length} total rows.
                </p>
              </div>
            </div>
          )}
          
          {/* Step 3: Review and import */}
          {importStep === 3 && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium">Step 3: Review and Import</h4>
              
              {/* Show date filter info if enabled */}
              {importConfig.dateFilter.enabled && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-800 font-medium">
                        Date filtering is enabled
                      </p>
                      <p className="text-sm text-blue-600">
                        Filtering dates from {importConfig.dateFilter.startDate || 'any'} to {importConfig.dateFilter.endDate || 'any'}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setImportConfig({
                          ...importConfig,
                          dateFilter: {
                            ...importConfig.dateFilter,
                            enabled: false
                          }
                        });
                        setTimeout(() => previewImport(), 0); // Use setTimeout to ensure state is updated
                      }}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm"
                      type="button"
                    >
                      Disable Filter
                    </button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <p className="text-green-800 font-medium">Valid Entries</p>
                  <p className="text-2xl font-bold text-green-700">
                    {importPreview.valid.length}
                  </p>
                </div>
                
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-red-800 font-medium">Invalid Entries</p>
                  <p className="text-2xl font-bold text-red-700">
                    {importPreview.invalid.length}
                  </p>
                </div>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <p className="text-yellow-800 font-medium">Excluded Dates</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {datesToExclude.size}
                  </p>
                </div>
              </div>
              
              {groupingOptions.enableGrouping && importPreview.duplicates && importPreview.duplicates.groupCount > 0 && (
                <div className={`my-4 p-4 border rounded-md ${groupingOptions.combineGroupedEntries ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-start">
                    <div className={`p-2 rounded-full mr-3 ${groupingOptions.combineGroupedEntries ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className={`font-medium ${groupingOptions.combineGroupedEntries ? 'text-green-800' : 'text-yellow-800'}`}>
                        {groupingOptions.combineGroupedEntries 
                          ? `Combined ${importPreview.duplicates.entryCount} duplicate entries into ${importPreview.duplicates.mergedGroupCount} entries` 
                          : `Found ${importPreview.duplicates.entryCount} potential duplicate entries in ${importPreview.duplicates.groupCount} groups`}
                      </p>
                      <p className="text-sm mt-1 mb-2 text-gray-600">
                        {groupingOptions.combineGroupedEntries
                          ? groupingOptions.groupingMode === 'dateOnly'
                            ? "All entries from the same date have been combined into single entries."
                            : groupingOptions.groupingMode === 'dateAndPaymentMode'
                              ? "Entries with the same date and payment mode have been combined."
                              : "Entries with the same date, amount, and payment mode have been combined to prevent duplicates."
                          : groupingOptions.groupingMode === 'dateOnly'
                            ? "The import contains multiple entries for the same date that could be combined."
                            : groupingOptions.groupingMode === 'dateAndPaymentMode'
                              ? "The import contains multiple entries with the same date and payment mode."
                              : "The import contains entries with the same date, amount, and payment mode that might be duplicates."}
                      </p>
                      {!groupingOptions.combineGroupedEntries && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setGroupingOptions({
                              ...groupingOptions,
                              combineGroupedEntries: true
                            });
                            setTimeout(() => previewImport(), 0); // Use setTimeout to ensure state is updated
                          }}
                          className="px-3 py-1 text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md border border-yellow-300"
                          type="button"
                        >
                          Combine Duplicate Entries
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date summary */}
                <div className="border rounded-md">
                  <div className="bg-gray-50 p-3 border-b">
                    <h5 className="font-medium">Date Summary</h5>
                  </div>
                  <div className="p-3 max-h-60 overflow-y-auto">
                    {importPreview.dateSummary.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No valid entries found.</p>
                    ) : (
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left text-xs font-medium text-gray-500">Date</th>
                            <th className="p-2 text-right text-xs font-medium text-gray-500">Count</th>
                            <th className="p-2 text-right text-xs font-medium text-gray-500">Total Amount</th>
                            <th className="p-2 text-center text-xs font-medium text-gray-500">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.dateSummary
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map((dateSummary) => (
                              <tr key={dateSummary.date} className="border-b">
                                <td className="p-2 text-sm">
                                  {new Date(dateSummary.date).toLocaleDateString()}
                                </td>
                                <td className="p-2 text-right text-sm">
                                  {dateSummary.entriesCount}
                                </td>
                                <td className="p-2 text-right text-sm">
                                  ₹{dateSummary.totalAmount.toFixed(2)}
                                </td>
                                <td className="p-2 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault(); // Prevent any default behaviors
                                      toggleDateExclusion(dateSummary.date);
                                    }}
                                    className={`px-2 py-1 text-xs rounded ${
                                      datesToExclude.has(dateSummary.date)
                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                                    }`}
                                    type="button"
                                  >
                                    {datesToExclude.has(dateSummary.date) ? 'Include' : 'Exclude'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                
                {/* Invalid entries */}
                <div className="border rounded-md">
                  <div className="bg-gray-50 p-3 border-b">
                    <h5 className="font-medium">Invalid Entries</h5>
                  </div>
                  <div className="p-3 max-h-60 overflow-y-auto">
                    {importPreview.invalid.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No invalid entries found.</p>
                    ) : (
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="p-2 text-left text-xs font-medium text-gray-500">Row</th>
                            <th className="p-2 text-left text-xs font-medium text-gray-500">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.invalid.map((invalid, index) => (
                            <tr key={index} className="border-b">
                              <td className="p-2 text-sm">
                                {index + 1}
                              </td>
                              <td className="p-2 text-sm text-red-600">
                                {invalid.reason}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t flex justify-between">
          {importStep > 1 ? (
            <button
              onClick={() => setImportStep(importStep === 3 ? 2 : 1)}
              className="px-4 py-2 border rounded-md hover:bg-gray-50"
              disabled={importInProgress}
              type="button"
            >
              Back
            </button>
          ) : (
            <div></div>
          )}
          
          {importStep < 3 ? (
            <button
              onClick={() => importStep === 1 ? null : previewImport()}
              className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 ${
                importStep === 1 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={importStep === 1 || !importConfig.dateColumn || !importConfig.amountColumn || importInProgress}
              type="button"
            >
              {importStep === 1 ? 'Upload a file to continue' : 'Preview Import'}
            </button>
          ) : (
            <div className="mt-6 flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600 mb-1">
                  {groupingOptions.enableGrouping && groupingOptions.combineGroupedEntries ? 
                    `${importPreview.valid.length} entries combined into ${importPreview.processedCount} entries based on your grouping preferences.` :
                    `${importPreview.valid.length} entries ready to import.`}
                </p>
                {datesToExclude.size > 0 && (
                  <p className="text-sm text-gray-500">
                    {datesToExclude.size} {datesToExclude.size === 1 ? 'date' : 'dates'} excluded from import.
                  </p>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => processImport()}
                disabled={importInProgress || importPreview.valid.length === 0}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {importInProgress ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </span>
                ) : (
                  `Import ${importPreview.valid.length - Array.from(datesToExclude).length} ${(importPreview.valid.length - Array.from(datesToExclude).length) === 1 ? 'Sale' : 'Sales'}`
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportManager;
