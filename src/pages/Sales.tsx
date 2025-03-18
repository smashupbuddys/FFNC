import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, X, ArrowUpRight, ArrowDownRight, IndianRupee, Trash2, ChevronLeft, ChevronRight, AlertTriangle, MessageSquare, Send, Minimize, Maximize, Bot, MoreVertical, Settings, Upload } from 'lucide-react';
import db, { generateId } from '../lib/db';
import CreditHistoryModal from '../components/CreditHistoryModal';
import BulkDeleteModal from '../components/sales/BulkDeleteModal';
import ImportManager from '../components/sales/ImportManager';
import { formatDate, formatDateWithOrdinal, parseDateWithFormat } from '../utils/dateUtils';
import { 
  Sale, 
  Creditor, 
  Transaction, 
  BulkSaleEntry, 
  AmountGroup, 
  ExcelImportConfig,
  ImportPreview
} from '../types/sales';

// Add JSX namespace declaration
declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
}

interface AICommand {
  name: string;
  description: string;
  execute: (params?: any) => Promise<string>;
}

interface DateRange {
  from: string | null;
  to: string | null;
}

interface PaymentModeStats {
  count: number;
  total: number;
}

interface SalesAnalysis {
  cash: PaymentModeStats;
  digital: PaymentModeStats;
  credit: PaymentModeStats;
}

const Sales: React.FC = () => {
  // Add a custom date formatting function at the beginning of the component
  const formatDate = (date: Date, formatString: string): string => {
    try {
      // Simple implementation to replace common format patterns
    if (formatString === 'yyyy-MM-dd') {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
      } else if (formatString === 'dd-MM-yyyy') {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${day}-${month}-${year}`;
      } else if (formatString === 'MM/dd/yyyy') {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}/${day}/${year}`;
    }
    // Default to ISO string if format not supported
    return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatting date:', error);
      // Return a safe fallback
      return new Date().toISOString().split('T')[0];
    }
  };

  // State declarations
  const [sales, setSales] = useState<Sale[]>([]);
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreditHistory, setShowCreditHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'sales' | 'creditors'>('sales');
  const [selectedCreditor, setSelectedCreditor] = useState<{
    name: string;
    transactions: Transaction[];
    totalCredit: number;
    totalPaid: number;
  } | null>(null);
  const [newSale, setNewSale] = useState<{
    amount: string;
    payment_mode: 'cash' | 'digital' | 'credit';
    party_name: string;
    date: string;
  }>({
    amount: '',
    payment_mode: 'cash',
    party_name: '',
    date: formatDate(new Date(), 'yyyy-MM-dd')
  });
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);

  // Add new state for displaying duplicate warning
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  // Add state to store all filtered sales data for proper duplicate detection
  const [fullFilteredData, setFullFilteredData] = useState<Sale[]>([]);

  // Add new state variables for bulk mode in the Sales component
  const [showBulkAddModal, setShowBulkAddModal] = useState(false);
  const [bulkEntries, setBulkEntries] = useState<BulkSaleEntry[]>([{
    id: generateId(),
    amount: '',
    payment_mode: 'cash',
    party_name: '',
    date: formatDate(new Date(), 'yyyy-MM-dd')
  }]);

  // Modify the duplicate groups structure to group by date and then by amount
  const [duplicateGroups, setDuplicateGroups] = useState<Map<string, AmountGroup[]>>(new Map());
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Add state to track ignored duplicate groups
  const [ignoredDuplicateGroups, setIgnoredDuplicateGroups] = useState<Set<string>>(new Set());

  // Add state for CSV import modal
  const [showImportModal, setShowImportModal] = useState(false);

  // Add AI assistant state within the Sales component
  const [showAIAssistant, setShowAIAssistant] = useState<boolean>(false);
  const [aiMessages, setAIMessages] = useState<AIMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your sales assistant powered by LMStudio. I can help you analyze sales data, filter results, find duplicates, or perform actions. What would you like to do?",
      timestamp: new Date()
    }
  ]);
  const [aiInput, setAIInput] = useState<string>('');
  const [aiLoading, setAILoading] = useState<boolean>(false);
  const [aiMinimized, setAIMinimized] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add LMStudio configuration
  interface LMStudioConfig {
    apiUrl: string;
    enabled: boolean;
    contextSize: number;  // Number of previous messages to include as context
  }

  // Add LMStudio configuration state
  const [lmStudioConfig, setLMStudioConfig] = useState<LMStudioConfig>({
    apiUrl: 'http://localhost:1234/v1/chat/completions', // Default LMStudio API URL
    enabled: true,
    contextSize: 10
  });

  // Add configuration modal state
  const [showAIConfigModal, setShowAIConfigModal] = useState<boolean>(false);

  // Add these state declarations with proper types
  const [dateRange, setDateRange] = useState<DateRange>({
    from: null,
    to: null
  });
  const [selectedPaymentModes, setSelectedPaymentModes] = useState<('cash' | 'digital' | 'credit')[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  // Replace the existing alert with a better notification UI
  const [notification, setNotification] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    show: false,
    message: '',
    type: 'info'
  });

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ show: true, message, type });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await loadSales();
        await loadCreditors();
      } catch (error) {
        console.error('Error loading data:', error);
        showNotification('Failed to load data. Please try again.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentPage, pageSize, dateRange.from, dateRange.to, selectedPaymentMode, searchTerm]);  // Include all filter dependencies

  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedPaymentMode, startDate, endDate]);

  const loadSales = async () => {
    try {
      const dbInstance = await db.init();

      // Build where clauses and parameters once to reuse in both queries
      const whereClauses = [`t.type = 'sale'`];
      const queryParams = [];
      
      // Add date filter conditions
      if (dateRange.from) {
        whereClauses.push('t.date >= ?');
        queryParams.push(dateRange.from);
      }
      
      if (dateRange.to) {
        whereClauses.push('t.date <= ?');
        queryParams.push(dateRange.to);
      }
      
      // Add payment mode filter
      if (selectedPaymentMode !== 'all') {
        whereClauses.push('t.payment_mode = ?');
        queryParams.push(selectedPaymentMode);
      }
      
      // Add search filter
      if (searchTerm) {
        whereClauses.push('(p.name LIKE ? OR t.amount LIKE ? OR t.date LIKE ? OR t.payment_mode LIKE ?)');
        const searchPattern = `%${searchTerm}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }
      
      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
      
      // First get total count for pagination
      const countResult = await dbInstance.exec(`
        SELECT COUNT(*) as total
        FROM transactions t
        LEFT JOIN parties p ON t.party_id = p.id
        ${whereClause}
      `, queryParams);
      
      if (countResult && countResult[0]?.values) {
        const total = countResult[0].values[0][0] as number;
        setTotalItems(total);
        setTotalPages(Math.ceil(total / pageSize));
      }

      // Performance optimization: Only fetch all data for duplicate detection if total count is reasonable
      // For large datasets, limit to a reasonable number to avoid performance issues
      const MAX_DUPLICATE_DETECTION_ITEMS = 5000;
      let fullDataParams = [...queryParams];
      let fullDataLimitClause = '';
      
      if (totalItems > MAX_DUPLICATE_DETECTION_ITEMS) {
        fullDataLimitClause = `LIMIT ${MAX_DUPLICATE_DETECTION_ITEMS}`;
      }

      // Get filtered data for duplicate detection
      const fullDataResult = await dbInstance.exec(`
        SELECT 
          t.id,
          t.date,
          t.amount,
          t.payment_mode,
          p.name as party_name,
          t.created_at
        FROM transactions t
        LEFT JOIN parties p ON t.party_id = p.id
        ${whereClause}
        ORDER BY t.date DESC, t.created_at DESC
        ${fullDataLimitClause}
      `, fullDataParams);

      if (fullDataResult && fullDataResult[0]?.values) {
        const allFilteredSales = fullDataResult[0].values.map((row: any[]) => ({
          id: row[0] as string,
          date: row[1] as string,
          amount: row[2] as number,
          payment_mode: row[3] as 'cash' | 'digital' | 'credit',
          party_name: row[4] as string | undefined,
          created_at: row[5] as string
        }));
        setFullFilteredData(allFilteredSales);
      }
      
      // Then get paginated data for display
      const paginatedParams = [...queryParams, pageSize, (currentPage - 1) * pageSize];
      const result = await dbInstance.exec(`
        SELECT 
          t.id,
          t.date,
          t.amount,
          t.payment_mode,
          p.name as party_name,
          t.created_at
        FROM transactions t
        LEFT JOIN parties p ON t.party_id = p.id
        ${whereClause}
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT ? OFFSET ?
      `, paginatedParams);

      if (result && result[0]?.values) {
        const salesData = result[0].values.map((row: any[]) => ({
          id: row[0] as string,
          date: row[1] as string,
          amount: row[2] as number,
          payment_mode: row[3] as 'cash' | 'digital' | 'credit',
          party_name: row[4] as string | undefined,
          created_at: row[5] as string
        }));
        setSales(salesData);
      } else {
        setSales([]);
      }
    } catch (error) {
      console.error('Error loading sales:', error);
      // Use a more user-friendly error notification
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showNotification(`Error loading sales data: ${errorMessage}`, 'error');
      setSales([]);
      throw error; // Rethrow to allow the caller to catch it
    }
  };

  const loadCreditors = async () => {
    try {
      const dbInstance = await db.init();
      const result = await dbInstance.exec(`
        SELECT 
          p.id,
          p.name,
          COALESCE(SUM(CASE WHEN t.type = 'sale' THEN t.amount ELSE 0 END), 0) as total_credit,
          COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount ELSE 0 END), 0) as total_paid,
          p.current_balance as remaining_balance,
          MAX(t.date) as last_transaction_date
        FROM parties p
        LEFT JOIN transactions t ON p.id = t.party_id
        GROUP BY p.id, p.name
        HAVING total_credit > 0 OR total_paid > 0
        ORDER BY remaining_balance DESC
      `);

      if (result && result[0]?.values) {
        const creditorsData = result[0].values.map((row: any[]) => ({
          id: row[0] as string,
          name: row[1] as string,
          total_credit: row[2] as number,
          total_paid: row[3] as number,
          remaining_balance: row[4] as number,
          last_transaction_date: row[5] as string
        }));
        setCreditors(creditorsData);
      }
    } catch (error) {
      console.error('Error loading creditors:', error);
      showNotification('Error loading creditors data. Please try again.', 'error');
      throw error; // Rethrow to allow the caller to catch it
    }
  };

  const handleAddSale = async () => {
    if (!newSale.amount || !newSale.date) {
      alert('Amount and date are required');
      return;
    }

    if (newSale.payment_mode === 'credit' && !newSale.party_name.trim()) {
      alert('Please enter a party name for credit sales');
      return;
    }

    setIsLoading(true);
    const dbInstance = await db.init();

    try {
      const saleId = generateId();
      
      await dbInstance.run('BEGIN TRANSACTION');

      try {
        let partyId = null;
        
        if (newSale.payment_mode === 'credit') {
          // Check if party exists
          const partyResult = await dbInstance.exec(`
            SELECT id FROM parties WHERE LOWER(name) = LOWER(?)
          `, [newSale.party_name.trim()]);

          if (partyResult.length > 0 && partyResult[0].values.length > 0) {
            partyId = partyResult[0].values[0][0];
          } else {
            // Create new party
            partyId = generateId();
            await dbInstance.run(`
              INSERT INTO parties (id, name, current_balance, created_at, updated_at)
              VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [partyId, newSale.party_name.trim()]);
          }
        }

        // Add the sale transaction
        await dbInstance.run(`
          INSERT INTO transactions (
            id, date, type, amount, payment_mode, party_id, created_at
          ) VALUES (?, ?, 'sale', ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          saleId,
          newSale.date,
          parseFloat(newSale.amount),
          newSale.payment_mode,
          partyId
        ]);

        // Update party balance for credit sales
        if (newSale.payment_mode === 'credit' && partyId) {
          await dbInstance.run(`
            UPDATE parties
            SET current_balance = current_balance + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [parseFloat(newSale.amount), partyId]);
        }

        await dbInstance.run('COMMIT');

        // Reset form and close modal
        setNewSale({
          amount: '',
          payment_mode: 'cash',
          party_name: '',
          date: formatDate(new Date(), 'yyyy-MM-dd')
        });
        setShowAddModal(false);

        // Reload data
        await loadSales();
        await loadCreditors();
      } catch (error) {
        await dbInstance.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error adding sale:', error);
      alert('Error adding sale. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowCreditHistory = async (creditor: Creditor) => {
    try {
      const dbInstance = await db.init();
      const result = await dbInstance.exec(`
        SELECT 
          id, date, type, amount, description, created_at
        FROM transactions
        WHERE party_id = ?
        ORDER BY date DESC, created_at DESC
      `, [creditor.id]);

      if (result && result[0]?.values) {
        const transactions = result[0].values.map((row: any[]) => ({
          id: row[0] as string,
          date: row[1] as string,
          type: row[2] as 'sale' | 'payment',
          amount: row[3] as number,
          description: row[4] as string | undefined,
          created_at: row[5] as string
        }));

        setSelectedCreditor({
          name: creditor.name,
          transactions,
          totalCredit: creditor.total_credit,
          totalPaid: creditor.total_paid
        });
        setShowCreditHistory(true);
      }
    } catch (error) {
      console.error('Error loading credit history:', error);
      alert('Error loading credit history. Please try again.');
    }
  };

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      // Ensure end date is not before start date
      if (value && endDate && value > endDate) {
        alert("Start date cannot be after end date");
        return;
    }
      setStartDate(value);
    } else {
      // Ensure start date is not after end date
      if (value && startDate && value < startDate) {
        alert("End date cannot be before start date");
        return;
      }
      setEndDate(value);
    }
  };

  const handleDeleteSale = async (saleId: string) => {
    if (!window.confirm('Are you sure you want to delete this sale?')) {
      return;
    }

    setIsLoading(true);
    try {
      const dbInstance = await db.init();
      
      // Get sale details before deletion
      const result = dbInstance.exec(`
        SELECT 
          amount, 
          payment_mode, 
          party_id 
        FROM transactions 
        WHERE id = ? AND type = 'sale'
      `, [saleId]);

      if (!result.length || !result[0].values.length) {
        throw new Error('Sale not found');
      }

      // Start transaction
      dbInstance.run('BEGIN TRANSACTION');

      try {
        const [amount, paymentMode, partyId] = result[0].values[0];

        // If it's a credit sale, update party balance
        if (paymentMode === 'credit' && partyId) {
          dbInstance.run(`
            UPDATE parties
            SET current_balance = current_balance - ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [amount, partyId]);
        }

        // Delete the sale
        dbInstance.run('DELETE FROM transactions WHERE id = ?', [saleId]);
        
        // Commit transaction
        dbInstance.run('COMMIT');
        
        // Save changes to localStorage
        db.save();
        
        // Reload data
        await loadSales();
        await loadCreditors();
        
      } catch (error) {
        dbInstance.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Error deleting sale. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Optimize the findDuplicates function for better performance
  const findDuplicates = (sales: Sale[]) => {
    const duplicateGroups = new Map<string, AmountGroup[]>();
    const duplicateSalesIds = new Set<string>();

    // Use more efficient data structures for grouping
    const salesByDate: Record<string, Sale[]> = {};
    
    // First pass: group by date
    for (const sale of sales) {
      // Normalize the date to handle both ISO and non-ISO formats
      const date = sale.date.split('T')[0];
      if (!salesByDate[date]) {
        salesByDate[date] = [];
      }
      salesByDate[date].push(sale);
    }

    // Second pass: check for duplicates within each date group
    for (const [date, dateSales] of Object.entries(salesByDate)) {
      // Skip already ignored dates
      if (ignoredDuplicateGroups.has(date)) continue;
      
      // Skip dates with only one entry (can't be duplicates)
      if (dateSales.length <= 1) continue;

      // Use Map for fast lookup by amount
      const amountGroups: Record<number, Sale[]> = {};

      // Group by amount
      for (const sale of dateSales) {
        if (!amountGroups[sale.amount]) {
          amountGroups[sale.amount] = [];
        }
        amountGroups[sale.amount].push(sale);
      }

      // Check for duplicates (same amount)
      const duplicateAmountGroups: AmountGroup[] = [];
      
      for (const [amount, entries] of Object.entries(amountGroups)) {
        if (entries.length > 1) {
          duplicateAmountGroups.push({ 
            amount: parseFloat(amount), 
            entries 
          });
          
          // Add each duplicate entry ID to the set
          for (const entry of entries) {
            duplicateSalesIds.add(entry.id);
          }
        }
      }

      if (duplicateAmountGroups.length > 0) {
        duplicateGroups.set(date, duplicateAmountGroups);
      }
    }

    return {
      duplicateGroups,
      duplicateSalesIds,
      ignoredDuplicateGroups
    };
  };

  // Add back the filteredIds declaration right after the findDuplicates function
  const filteredIds = useMemo(() => {
    const ids = findDuplicates(fullFilteredData);
    
    // Filter out IDs from ignored groups
    if (ids.ignoredDuplicateGroups.size > 0) {
      return new Set(
        Array.from(ids.duplicateSalesIds).filter((id: string) => {
          const sale = fullFilteredData.find((s: Sale) => s.id === id);
          if (!sale) return true;
          
          const normalizedDate = sale.date.split('T')[0];
          return !ids.ignoredDuplicateGroups.has(normalizedDate);
        })
      );
    }
    
    return ids.duplicateSalesIds;
  }, [fullFilteredData, ignoredDuplicateGroups]);
  
  // Improve the filter function with better date comparisons
  const filteredSales = useMemo(() => {
    let filtered = sales;
    
    // Apply search filter
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter((sale: Sale) => {
        const partyNameMatches = sale.party_name?.toLowerCase().includes(lowerSearchTerm) || false;
        const amountMatches = sale.amount.toString().includes(searchTerm);
        const dateMatches = sale.date.includes(searchTerm);
        const paymentModeMatches = sale.payment_mode.includes(lowerSearchTerm);
        
        return partyNameMatches || amountMatches || dateMatches || paymentModeMatches;
      });
    }
    
    // Apply payment mode filter
    if (selectedPaymentMode !== 'all') {
      filtered = filtered.filter((sale: Sale) => sale.payment_mode === selectedPaymentMode);
    }
    
    // Apply date range filter with proper date comparisons
    if (startDate) {
      // Normalize date format for comparison
      const startDateNormalized = startDate.split('T')[0];
      filtered = filtered.filter((sale: Sale) => {
        const saleDateNormalized = sale.date.split('T')[0];
        return saleDateNormalized >= startDateNormalized;
      });
    }
    
    if (endDate) {
      // Normalize date format for comparison
      const endDateNormalized = endDate.split('T')[0];
      filtered = filtered.filter((sale: Sale) => {
        const saleDateNormalized = sale.date.split('T')[0];
        return saleDateNormalized <= endDateNormalized;
      });
    }
    
    return filtered;
  }, [sales, searchTerm, selectedPaymentMode, startDate, endDate]);

  // Update displayedSales to use filteredSales (for UI) but check against duplicateIds 
  // (which is based on the complete dataset)
  const displayedSales = useMemo(() => {
    if (showDuplicatesOnly) {
      return filteredSales.filter((sale: Sale) => filteredIds.has(sale.id));
    }
    return filteredSales;
  }, [filteredSales, filteredIds, showDuplicatesOnly]);
  
  // Calculate duplicate metrics
  const duplicateCount = useMemo(() => filteredIds.size, [filteredIds]);
  const hasDuplicates = duplicateCount > 0;

  // Update the summary statistics to reflect all filtered data, not just the current page
  const totalSales = fullFilteredData.reduce((sum: number, sale: Sale) => sum + sale.amount, 0);
  const totalCash = fullFilteredData
    .filter((sale: Sale) => sale.payment_mode === 'cash')
    .reduce((sum: number, sale: Sale) => sum + sale.amount, 0);
  const totalDigital = fullFilteredData
    .filter((sale: Sale) => sale.payment_mode === 'digital')
    .reduce((sum: number, sale: Sale) => sum + sale.amount, 0);
  const totalCredit = fullFilteredData
    .filter((sale: Sale) => sale.payment_mode === 'credit')
    .reduce((sum: number, sale: Sale) => sum + sale.amount, 0);

  const handlePageChange = async (page: number) => {
    setIsLoading(true);
    try {
    setCurrentPage(page);
      // Data loading will be triggered by the useEffect that depends on currentPage
    } catch (error) {
      console.error('Error changing page:', error);
      showNotification('Failed to load data for page ' + page, 'error');
    }
  };
  
  const PaginationControls = () => (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1 || isLoading}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Previous'}
        </button>
        <button
          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages || isLoading}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Next'}
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-medium">{Math.min(currentPage * pageSize, totalItems)}</span> of{' '}
            <span className="font-medium">{totalItems}</span> results
            {isLoading && <span className="ml-2 italic text-gray-500">Updating...</span>}
          </p>
        </div>
        <div>
          <div className="isolate inline-flex -space-x-px rounded-md shadow-sm">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1 || isLoading}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">First</span>
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
              <ChevronLeft className="h-5 w-5 -ml-2" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
              className="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            
            {/* Page number buttons */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Show 2 pages before and after current page, adjust for edges
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={isLoading}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                    currentPage === pageNum
                      ? isLoading 
                        ? 'z-10 bg-blue-400 text-white'  // Lighter blue when loading
                        : 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                      : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            
            <button
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || isLoading}
              className="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages || isLoading}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Last</span>
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
              <ChevronRight className="h-5 w-5 -ml-2" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Fix the filteredCreditors that got accidentally removed
  const filteredCreditors = useMemo(() => {
    return creditors.filter((creditor: Creditor) =>
      creditor.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [creditors, searchTerm]);

  // Add a function to handle adding/removing bulk entries
  const addBulkEntry = () => {
    setBulkEntries([
      ...bulkEntries,
      {
        id: generateId(),
        amount: '',
        payment_mode: 'cash',
        party_name: '',
        date: formatDate(new Date(), 'yyyy-MM-dd')
      }
    ]);
  };

  const removeBulkEntry = (id: string) => {
    if (bulkEntries.length === 1) {
      return; // Keep at least one entry
    }
    
    setBulkEntries(bulkEntries.filter((entry: BulkSaleEntry) => entry.id !== id));
  };

  const updateBulkEntry = (id: string, field: keyof BulkSaleEntry, value: string) => {
    setBulkEntries(
      bulkEntries.map((entry: BulkSaleEntry) => 
        entry.id === id 
          ? { ...entry, [field]: field === 'payment_mode' ? value as 'cash' | 'digital' | 'credit' : value }
          : entry
      )
    );
  };

  // Add a function to handle the bulk submission
  const handleAddBulkSales = async () => {
    // Validate entries
    const invalidEntries = bulkEntries.filter((entry: BulkSaleEntry) => !entry.amount || !entry.date);
    
    if (invalidEntries.length > 0) {
      alert(`${invalidEntries.length} entries are missing required fields (amount or date).`);
      return;
    }

    const creditEntriesWithoutParty = bulkEntries.filter(
      (entry: BulkSaleEntry) => entry.payment_mode === 'credit' && !entry.party_name.trim()
    );
    
    if (creditEntriesWithoutParty.length > 0) {
      alert('Credit entries must have a party name.');
      return;
    }

    setIsLoading(true);
    const dbInstance = await db.init();

    try {
      await dbInstance.run('BEGIN TRANSACTION');

      try {
        // Process each entry
        for (const entry of bulkEntries) {
          let partyId = null;
          
          if (entry.payment_mode === 'credit') {
            // Check if party exists
            const partyResult = await dbInstance.exec(`
              SELECT id FROM parties WHERE LOWER(name) = LOWER(?)
            `, [entry.party_name.trim()]);

            if (partyResult.length > 0 && partyResult[0].values.length > 0) {
              partyId = partyResult[0].values[0][0];
            } else {
              // Create new party
              partyId = generateId();
              await dbInstance.run(`
                INSERT INTO parties (id, name, current_balance, created_at, updated_at)
                VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `, [partyId, entry.party_name.trim()]);
            }
          }

          // Add the sale transaction
          const saleId = entry.id;
          await dbInstance.run(`
            INSERT INTO transactions (
              id, date, type, amount, payment_mode, party_id, created_at
            ) VALUES (?, ?, 'sale', ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            saleId,
            entry.date,
            parseFloat(entry.amount),
            entry.payment_mode,
            partyId
          ]);

          // Update party balance for credit sales
          if (entry.payment_mode === 'credit' && partyId) {
            await dbInstance.run(`
              UPDATE parties
              SET current_balance = current_balance + ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [parseFloat(entry.amount), partyId]);
          }
        }

        await dbInstance.run('COMMIT');

        // Reset and close modal
        setBulkEntries([{
          id: generateId(),
          amount: '',
          payment_mode: 'cash',
          party_name: '',
          date: formatDate(new Date(), 'yyyy-MM-dd')
        }]);
        setShowBulkAddModal(false);

        // Reload data
        await loadSales();
        await loadCreditors();
        
        // Show success message
        alert(`Successfully added ${bulkEntries.length} sales.`);
        
      } catch (error) {
        await dbInstance.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error adding bulk sales:', error);
      alert('Error adding bulk sales. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to handle ignoring a group of duplicates
  const handleIgnoreDuplicates = (dateGroup: string) => {
    if (window.confirm('Are you sure you want to ignore these potential duplicates? They will no longer be highlighted as duplicates.')) {
      setIgnoredDuplicateGroups((prev: Set<string>) => {
        const updated = new Set(prev);
        updated.add(dateGroup);
        return updated;
      });
    }
  };

  // Add a new function to handle keeping a single entry from a specific amount group
  const handleKeepSelectedWithSameAmount = async (dateGroup: string, amount: number, keepSaleId: string) => {
    if (!window.confirm('Are you sure you want to delete all other entries with this date and amount except the selected one?')) {
      return;
    }

    const amountGroups = duplicateGroups.get(dateGroup);
    if (!amountGroups) return;
    
    // Find the specific amount group
    const amountGroup = amountGroups.find((group: AmountGroup) => group.amount === amount);
    if (!amountGroup) return;
    
    const entriesToDelete = amountGroup.entries.filter((entry: Sale) => entry.id !== keepSaleId);
    
    setIsLoading(true);
    try {
      const dbInstance = await db.init();
      await dbInstance.run('BEGIN TRANSACTION');
      
      try {
        // Delete each entry except the one to keep
        for (const entry of entriesToDelete) {
          // Get entry details before deletion
          const result = dbInstance.exec(`
            SELECT payment_mode, party_id 
            FROM transactions 
            WHERE id = ? AND type = 'sale'
          `, [entry.id]);

          if (result.length && result[0].values.length) {
            const [paymentMode, partyId] = result[0].values[0];

            // If it's a credit sale, update party balance
            if (paymentMode === 'credit' && partyId) {
              dbInstance.run(`
                UPDATE parties
                SET current_balance = current_balance - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [entry.amount, partyId]);
            }

            // Delete the sale
            dbInstance.run('DELETE FROM transactions WHERE id = ?', [entry.id]);
          }
        }
        
        // Commit transaction
        dbInstance.run('COMMIT');
        
        // Save changes to localStorage
        db.save();
        
        // Reload data
        await loadSales();
        await loadCreditors();
        
        alert(`Successfully kept 1 entry and deleted ${entriesToDelete.length} duplicate entries.`);
        
      } catch (error) {
        dbInstance.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error managing duplicates:', error);
      alert('Error deleting duplicate entries. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle the import complete event from the ImportManager
  const handleImportComplete = async (entries: BulkSaleEntry[]) => {
    if (!entries.length) return;
    
    setIsLoading(true);
    
    try {
      const dbInstance = await db.init();
      await dbInstance.run('BEGIN TRANSACTION');

      try {
        // Process each entry
        for (const entry of entries) {
          let partyId = null;
          
          if (entry.payment_mode === 'credit') {
            // Check if party exists
            const partyResult = await dbInstance.exec(`
              SELECT id FROM parties WHERE LOWER(name) = LOWER(?)
            `, [entry.party_name.trim()]);

            if (partyResult.length > 0 && partyResult[0].values.length > 0) {
              partyId = partyResult[0].values[0][0];
          } else {
              // Create new party
              partyId = generateId();
              await dbInstance.run(`
                INSERT INTO parties (id, name, current_balance, created_at, updated_at)
                VALUES (?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
              `, [partyId, entry.party_name.trim()]);
            }
          }

          // Add the sale transaction
          const saleId = entry.id;
          await dbInstance.run(`
            INSERT INTO transactions (
              id, date, type, amount, payment_mode, party_id, created_at
            ) VALUES (?, ?, 'sale', ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            saleId,
            entry.date,
            parseFloat(entry.amount),
            entry.payment_mode,
            partyId
          ]);

          // Update party balance for credit sales
          if (entry.payment_mode === 'credit' && partyId) {
            await dbInstance.run(`
              UPDATE parties
              SET current_balance = current_balance + ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [parseFloat(entry.amount), partyId]);
          }
        }

        await dbInstance.run('COMMIT');
        
        // Reload data
        await loadSales();
        await loadCreditors();
      
      // Show success message
        alert(`Successfully imported ${entries.length} sales.`);
      } catch (error) {
        await dbInstance.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error importing sales:', error);
      alert('Error importing sales. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Update the applyDateFilter function
  const applyDateFilter = async () => {
    setIsLoading(true);
    try {
      // Reset to first page when applying new filters
      setCurrentPage(1);
      await Promise.all([
        loadSales(),
        loadCreditors()
      ]);
    } catch (error) {
      console.error('Error applying date filter:', error);
      showNotification('Failed to apply date filter. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Update the clearDateFilter function
  const clearDateFilter = async () => {
    setIsLoading(true);
    try {
      setDateRange({ from: null, to: null });
      // Reset to first page when clearing filters
      setCurrentPage(1);
      await Promise.all([
        loadSales(),
        loadCreditors()
      ]);
    } catch (error) {
      console.error('Error clearing date filter:', error);
      showNotification('Failed to clear date filter. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Update the handleDateFilter function too
  const handleDateFilter = async (filter: string) => {
    setIsLoading(true);
    try {
      const today = new Date();
      let start = new Date();
      let end = new Date();

      switch (filter) {
        case 'today':
          start = today;
          break;
        case 'yesterday':
          start.setDate(today.getDate() - 1);
          end = start;
          break;
        case 'week':
          start.setDate(today.getDate() - 7);
          break;
        case 'month':
          start.setMonth(today.getMonth() - 1);
          break;
        case 'quarter':
          start.setMonth(today.getMonth() - 3);
          break;
        case 'halfYear':
          start.setMonth(today.getMonth() - 6);
          break;
        case 'year':
          start.setFullYear(today.getFullYear() - 1);
          break;
        default:
          return;
      }

      setStartDate(formatDate(start, 'yyyy-MM-dd'));
      setEndDate(formatDate(end, 'yyyy-MM-dd'));
      
      // Reset to first page when applying new date filter
      setCurrentPage(1);
      
      await Promise.all([
        loadSales(),
        loadCreditors()
      ]);
    } catch (error) {
      console.error('Error applying date filter:', error);
      showNotification('Failed to apply date filter. Please try again.', 'error');
      } finally {
      setIsLoading(false);
    }
  };

  // Create a handleDateRangeChange function
  const handleDateRangeChange = (field: 'from' | 'to', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value || null
    }));
  };

  // Add this function after other handlers like handleAddBulkSales
  const handleBulkDelete = async (saleIds: string[]) => {
    if (saleIds.length === 0) return;
    
    setIsLoading(true);
    try {
      const dbInstance = await db.init();
      await dbInstance.run('BEGIN TRANSACTION');
      
      try {
        // For each sale ID
        for (const saleId of saleIds) {
          // Get sale details before deletion
          const result = await dbInstance.exec(`
            SELECT 
              amount, 
              payment_mode, 
              party_id 
            FROM transactions 
            WHERE id = ? AND type = 'sale'
          `, [saleId]);

          if (result.length && result[0].values.length) {
            const [amount, paymentMode, partyId] = result[0].values[0];

            // If it's a credit sale, update party balance
            if (paymentMode === 'credit' && partyId) {
              await dbInstance.run(`
                UPDATE parties
                SET current_balance = current_balance - ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [amount, partyId]);
            }

            // Delete the sale
            await dbInstance.run('DELETE FROM transactions WHERE id = ?', [saleId]);
          }
        }
        
        // Commit transaction
        await dbInstance.run('COMMIT');
        
        // Save changes to localStorage
        db.save();
        
        // Reload data
        await loadSales();
        await loadCreditors();
        
        // Show success notification
        showNotification(`Successfully deleted ${saleIds.length} sales.`, 'success');
      } catch (error) {
        await dbInstance.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting sales:', error);
      showNotification('Error deleting sales. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Add a handleShowBulkDelete function with proper event handling
  const handleShowBulkDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBulkDeleteModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Sales</h1>
        <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          type="button"
        >
          <Plus className="h-4 w-4 mr-1 inline" />
          New Sale
        </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowBulkAddModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            type="button"
          >
            <Plus className="h-4 w-4 mr-1 inline" />
            Bulk Entry
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowImportModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            type="button"
          >
            <Upload className="h-4 w-4 mr-1 inline" />
            Import CSV
          </button>
          
          {/* Replace the bulk delete button with a more options menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowActionsMenu(!showActionsMenu);
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isLoading}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {showActionsMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1" role="menu" aria-orientation="vertical">
                  <button
                    onClick={handleShowBulkDelete}
                    className="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center"
                    role="menuitem"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Bulk Delete
                  </button>
                  {/* Add other advanced actions here if needed */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('sales')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'sales'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
            disabled={isLoading}
          >All Sales
          </button>
          <button
            onClick={() => setActiveTab('creditors')}
            className={`
              pb-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'creditors'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
            disabled={isLoading}
          >
            Credit Buyers
          </button>
        </nav>
      </div>

      {activeTab === 'sales' && (
        <>
          {/* Add new state for date range filtering */}
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Filter Sales by Date</h2>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateRange.from || ''}
                  onChange={(e) => handleDateRangeChange('from', e.target.value)}
                  className="w-full p-2 border rounded-md disabled:opacity-50 disabled:bg-gray-100"
                  disabled={isLoading}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateRange.to || ''}
                  onChange={(e) => handleDateRangeChange('to', e.target.value)}
                  className="w-full p-2 border rounded-md disabled:opacity-50 disabled:bg-gray-100"
                  disabled={isLoading}
                />
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={applyDateFilter}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Applying...' : 'Apply Filter'}
                </button>
                <button 
                  onClick={clearDateFilter}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Clearing...' : 'Clear'}
                </button>
              </div>
            </div>
            {(dateRange.from || dateRange.to) && (
              <div className="mt-2 text-sm text-blue-600">
                Filtered by date: {dateRange.from ? `From ${new Date(dateRange.from || '').toLocaleDateString()}` : ''} 
                {dateRange.to ? `${dateRange.from ? ' to ' : 'Until '}${new Date(dateRange.to || '').toLocaleDateString()}` : ''}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {['today', 'yesterday', 'week', 'month', 'quarter', 'halfYear', 'year'].map((filter) => (
              <button
                key={filter}
                onClick={() => handleDateFilter(filter)}
                className="px-3 py-1 border rounded-md text-sm hover:bg-gray-50 disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? 
                  <span className="inline-flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </span> 
                  : filter === 'week' ? 'This Week' 
                  : filter === 'month' ? 'This Month' 
                  : filter === 'quarter' ? 'Last 3 Months' 
                  : filter === 'halfYear' ? 'Last 6 Months' 
                  : filter === 'year' ? 'This Year' 
                  : filter.charAt(0).toUpperCase() + filter.slice(1)
                }
              </button>
            ))}
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                // Also reset date range and reload data
                setDateRange({ from: null, to: null });
                loadSales();
                loadCreditors();
              }}
              className="px-3 py-1 border rounded-md text-sm hover:bg-gray-50 text-blue-600 border border-blue-200 hover:border-blue-300"
              disabled={isLoading}
            >
              Clear Filter
            </button>
          </div>

          {/* Place this after the date filter's clear button */}
          {hasDuplicates && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                className={`px-3 py-1 flex items-center gap-1 rounded-md text-sm ${
                  showDuplicatesOnly 
                    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                    : 'border border-gray-300 text-amber-600 hover:bg-amber-50'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                {showDuplicatesOnly ? 'Show All Entries' : `Review ${duplicateCount} Duplicate${duplicateCount > 1 ? 's' : ''}`}
              </button>
              
              {duplicateGroups.size > 0 && ignoredDuplicateGroups.size > 0 && (
                <button
                  onClick={() => setIgnoredDuplicateGroups(new Set())}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
                  title="Show all duplicates again, including previously ignored ones"
                >
                  Reset Ignored Duplicates
                </button>
              )}
            </div>
          )}

          {/* Custom Date Range Filter */}
          <div className="flex flex-wrap items-center gap-4 mb-4 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleDateChange('start', e.target.value)}
                className="border border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                max={endDate || undefined}
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleDateChange('end', e.target.value)}
                className="border border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                min={startDate || undefined}
                disabled={isLoading}
              />
            </div>
            {(startDate || endDate) && (
              <div className="flex items-center text-sm text-gray-500">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md">
                  Showing sales from {startDate ? new Date(startDate).toLocaleDateString() : 'the beginning'} 
                  {' '}to{' '}
                  {endDate ? new Date(endDate).toLocaleDateString() : 'now'}
                </span>
              </div>
            )}
          </div>

          {/* Search and Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex space-x-4">
                <div className="flex-1">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Search sales..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div>
                  <select
                    value={selectedPaymentMode}
                    onChange={(e) => setSelectedPaymentMode(e.target.value)}
                    className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    disabled={isLoading}
                  >
                    <option value="all">All Modes</option>
                    <option value="cash">Cash</option>
                    <option value="digital">Digital</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Total Sales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Sales</p>
                  <p className="text-xl font-semibold text-gray-900">₹{totalSales.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <IndianRupee className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Cash Sales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Cash Sales</p>
                  <p className="text-xl font-semibold text-green-600">₹{totalCash.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <IndianRupee className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Digital Sales */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Digital Sales</p>
                  <p className="text-xl font-semibold text-purple-600">₹{totalDigital.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <IndianRupee className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Sales Table with Duplicate Grouping */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="overflow-x-auto">
              {duplicateGroups.size > 0 && showDuplicatesOnly && (
                <div className="p-4 bg-amber-50 border-b border-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-amber-800 font-medium">
                        Found duplicate entries (same date AND amount) on {duplicateGroups.size} different dates.
                      </p>
                      <p className="text-amber-700 text-sm mt-1">
                        Total of {filteredIds.size} entries have been identified as duplicates with matching date and amount. Review each group to select which to keep.
                      </p>
                      <ul className="mt-2 list-disc pl-5 text-sm text-amber-700">
                        {Array.from(duplicateGroups.entries()).slice(0, 3).map(([date, amountGroups]) => (
                          <li key={date}>
                            {new Date(date).toLocaleDateString()}: {amountGroups.length} amount groups
                          </li>
                        ))}
                        {duplicateGroups.size > 3 && <li>...and {duplicateGroups.size - 3} more dates with duplicates</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative z-10">
                      Date
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative z-10">
                      Amount
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative z-10">
                      Payment Mode
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative z-10">
                      Party Name
                    </th>
                    <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative z-10">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {showDuplicatesOnly ? (
                    // Show grouped duplicate entries by date and amount
                    Array.from(duplicateGroups.entries()).map(([date, amountGroups]) => (
                      <React.Fragment key={date}>
                        {/* Date group header row */}
                        <tr 
                          className="cursor-pointer bg-amber-50 hover:bg-amber-100 border-l-4 border-amber-400"
                          onClick={() => setExpandedGroup(expandedGroup === date ? null : date)}
                        >
                          <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-amber-800" colSpan={5}>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center">
                                {expandedGroup === date ? 
                                  <ChevronRight className="h-4 w-4 mr-2 transform rotate-90" /> : 
                                  <ChevronRight className="h-4 w-4 mr-2" />
                                }
                                <span className="mr-2 font-medium">Date: {new Date(date).toLocaleDateString()}</span>
                                <span className="bg-amber-200 text-amber-800 px-2 py-0.5 rounded text-xs font-semibold">
                                  {amountGroups.length} amount groups
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-amber-700">
                                  <span className="mr-2">Amount groups:</span>
                                  <span className="font-medium">
                                    {amountGroups.map((group: AmountGroup) => 
                                      <span key={group.amount} className="inline-block mx-1 px-1.5 py-0.5 bg-white rounded border border-amber-300">
                                        ₹{group.amount.toLocaleString()} ({group.entries.length})
                                      </span>
                                    )}
                                  </span>
                                </div>
                                {expandedGroup !== date && (
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedGroup(date);
                                      }}
                                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded border border-blue-300 text-xs"
                                    >
                                      Review
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleIgnoreDuplicates(date);
                                      }}
                                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded border border-gray-300 text-xs"
                                      title="Ignore these duplicates and keep all entries"
                                    >
                                      Ignore All
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        
                        {/* Expanded group entries - show amount subgroups */}
                        {expandedGroup === date && (
                          <>
                            {amountGroups.map((amountGroup: AmountGroup, groupIndex: number) => (
                              <React.Fragment key={`${date}_${amountGroup.amount}`}>
                                {/* Amount subgroup header */}
                                <tr className="bg-amber-100">
                                  <td colSpan={5} className="px-6 py-2">
                                    <div className="flex justify-between items-center text-amber-800 font-medium">
                                      <div>
                                        Amount group: ₹{amountGroup.amount.toLocaleString()} 
                                        <span className="ml-2 text-xs font-normal">
                                          ({amountGroup.entries.length} duplicate entries with this amount)
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                                
                                {/* Entries within this amount group */}
                                {amountGroup.entries.map((sale: Sale, index: number) => (
                                  <tr 
                                    key={sale.id} 
                                    className={`hover:bg-gray-50 ${
                                      filteredIds.has(sale.id) 
                                        ? 'bg-amber-50 border-l-4 border-amber-400' 
                                        : ''
                                    }`}
                                  >
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {new Date(sale.date).toLocaleDateString()}
                                      <div className="text-xs text-gray-500">
                                        Created: {new Date(sale.created_at).toLocaleTimeString()}
                                      </div>
                                      {filteredIds.has(sale.id) && (
                                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                          Duplicate Date & Amount
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      ₹{sale.amount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        sale.payment_mode === 'cash'
                                          ? 'bg-green-100 text-green-800'
                                          : sale.payment_mode === 'digital'
                                          ? 'bg-purple-100 text-purple-800'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}>
                                        {sale.payment_mode.charAt(0).toUpperCase() + sale.payment_mode.slice(1)}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {sale.party_name || '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 relative z-0">
                                        <button
                                          onClick={() => handleDeleteSale(sale.id)}
                                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                          disabled={isLoading}
                                        >
                                        <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    // Regular sales view (non-grouped)
                    displayedSales.map((sale: Sale) => (
                      <tr 
                        key={sale.id} 
                        className={`hover:bg-gray-50 ${
                          filteredIds.has(sale.id) 
                            ? 'bg-amber-50 border-l-4 border-amber-400' 
                            : ''
                        }`}
                      >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(sale.date).toLocaleDateString()}
                          <div className="text-xs text-gray-500">
                            Created: {new Date(sale.created_at).toLocaleTimeString()}
                          </div>
                          {filteredIds.has(sale.id) && (
                            <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              Duplicate Date & Amount
                            </span>
                          )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{sale.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          sale.payment_mode === 'cash'
                            ? 'bg-green-100 text-green-800'
                            : sale.payment_mode === 'digital'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {sale.payment_mode.charAt(0).toUpperCase() + sale.payment_mode.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {sale.party_name || '-'}
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 relative z-0">
                        <button
                          onClick={() => handleDeleteSale(sale.id)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          disabled={isLoading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add pagination controls */}
          {!showDuplicatesOnly && <PaginationControls />}
        </>
      )}

      {/* New Sale Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">New Sale</h3>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddModal(false);
                }}
                className="text-gray-400 hover:text-gray-500"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  id="amount"
                  value={newSale.amount}
                  onChange={(e) => setNewSale({ ...newSale, amount: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="payment_mode" className="block text-sm font-medium text-gray-700">
                  Payment Mode
                </label>
                <select
                  id="payment_mode"
                  value={newSale.payment_mode}
                  onChange={(e) => setNewSale({ ...newSale, payment_mode: e.target.value as 'cash' | 'digital' | 'credit' })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="digital">Digital</option>
                  <option value="credit">Credit</option>
                </select>
              </div>

              {newSale.payment_mode === 'credit' && (
                <div>
                  <label htmlFor="party_name" className="block text-sm font-medium text-gray-700">
                    Party Name
                  </label>
                  <input
                    type="text"
                    id="party_name"
                    value={newSale.party_name}
                    onChange={(e) => setNewSale({ ...newSale, party_name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    required={newSale.payment_mode === 'credit'}
                  />
                </div>
              )}
              
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  id="date"
                  value={newSale.date}
                  onChange={(e) => setNewSale({ ...newSale, date: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  required
                />
            </div>
            
              <div className="flex justify-end pt-4">
              <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddModal(false);
                  }}
                  className="mr-3 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddSale();
                  }}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                disabled={isLoading}
              >
                  {isLoading ? 'Adding...' : 'Add Sale'}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Sales Modal */}
      {showBulkAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50" onClick={(e) => e.stopPropagation()}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Add Multiple Sales</h3>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowBulkAddModal(false);
                }}
                className="text-gray-400 hover:text-gray-500"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Add multiple sales records in one go. Click "Add Row" to add more entries.
              </p>
              
              {bulkEntries.map((entry, index) => (
                <div key={entry.id} className="p-4 border rounded-md bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-sm font-medium">Entry #{index + 1}</h4>
                    {bulkEntries.length > 1 && (
                        <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeBulkEntry(entry.id);
                        }}
                        className="text-red-600 hover:text-red-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                    )}
              </div>
              
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount (₹)
                          </label>
                          <input
                        type="number"
                        value={entry.amount}
                        onChange={(e) => updateBulkEntry(entry.id, 'amount', e.target.value)}
                        className="w-full p-2 border rounded-md"
                        required
                      />
                        </div>
                        
                            <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Date
                              </label>
                              <input
                                type="date"
                        value={entry.date}
                        onChange={(e) => updateBulkEntry(entry.id, 'date', e.target.value)}
                        className="w-full p-2 border rounded-md"
                        required
                      />
                      </div>
                      
                      <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Payment Mode
                      </label>
                        <select
                        value={entry.payment_mode}
                        onChange={(e) => updateBulkEntry(entry.id, 'payment_mode', e.target.value)}
                        className="w-full p-2 border rounded-md"
                            >
                              <option value="cash">Cash</option>
                              <option value="digital">Digital</option>
                              <option value="credit">Credit</option>
                            </select>
                          </div>
                          
                    {entry.payment_mode === 'credit' && (
                          <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Party Name
                        </label>
                            <input
                              type="text"
                          value={entry.party_name}
                          onChange={(e) => updateBulkEntry(entry.id, 'party_name', e.target.value)}
                          className="w-full p-2 border rounded-md"
                          required
                        />
                          </div>
                    )}
                            </div>
                    </div>
              ))}
                  
              <div className="flex justify-between items-center pt-4">
                    <button
                      type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addBulkEntry();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Add Row
                            </button>
                
                <div className="flex gap-2">
                    <button 
                      type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowBulkAddModal(false);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                    </button>
                    <button
                      type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddBulkSales();
                    }}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Adding...' : `Add ${bulkEntries.length} Sales`}
                    </button>
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportManager 
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <BulkDeleteModal
          sales={fullFilteredData}
          onClose={() => setShowBulkDeleteModal(false)}
          onDelete={handleBulkDelete}
        />
      )}
    </div>
  );
};

export default Sales;
