import React, { useState, useEffect } from 'react';
import { Sale } from '../../types/sales';
import { formatDateWithOrdinal } from '../../utils/dateUtils';
import { X, AlertTriangle } from 'lucide-react';

interface BulkDeleteModalProps {
  sales: Sale[];
  onClose: () => void;
  onDelete: (saleIds: string[]) => Promise<void>;
}

const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({ sales, onClose, onDelete }) => {
  const [selectedPaymentModes, setSelectedPaymentModes] = useState<('cash' | 'digital' | 'credit')[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [filteredSales, setFilteredSales] = useState<Sale[]>(sales);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Predefined date ranges
  const applyDateFilter = (filter: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (filter) {
      case 'today':
        start = today;
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        end = new Date(start);
        break;
      case 'thisWeek':
        start.setDate(today.getDate() - today.getDay());
        break;
      case 'lastWeek':
        start.setDate(today.getDate() - today.getDay() - 7);
        end.setDate(today.getDate() - today.getDay() - 1);
        break;
      case 'thisMonth':
        start.setDate(1);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'last3Months':
        start.setMonth(today.getMonth() - 3);
        break;
      case 'last6Months':
        start.setMonth(today.getMonth() - 6);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        break;
      case 'lastYear':
        start = new Date(today.getFullYear() - 1, 0, 1);
        end = new Date(today.getFullYear() - 1, 11, 31);
        break;
      case 'clear':
        setDateRange({ start: '', end: '' });
        return;
      default:
        return;
    }

    const formatDateToString = (date: Date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setDateRange({
      start: formatDateToString(start),
      end: formatDateToString(end)
    });
  };

  // Apply all filters when filter criteria changes
  useEffect(() => {
    let filtered = [...sales];
    
    // Filter by payment modes
    if (selectedPaymentModes.length > 0) {
      filtered = filtered.filter(sale => selectedPaymentModes.includes(sale.payment_mode));
    }
    
    // Filter by date range
    if (dateRange.start) {
      const startDate = dateRange.start.split('T')[0]; // Normalize date format
      filtered = filtered.filter(sale => {
        const saleDate = sale.date.split('T')[0]; // Normalize date format
        return saleDate >= startDate;
      });
    }
    
    if (dateRange.end) {
      const endDate = dateRange.end.split('T')[0]; // Normalize date format
      filtered = filtered.filter(sale => {
        const saleDate = sale.date.split('T')[0]; // Normalize date format
        return saleDate <= endDate;
      });
    }
    
    // Filter by amount range
    if (minAmount && !isNaN(Number(minAmount))) {
      filtered = filtered.filter(sale => sale.amount >= Number(minAmount));
    }
    
    if (maxAmount && !isNaN(Number(maxAmount))) {
      filtered = filtered.filter(sale => sale.amount <= Number(maxAmount));
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(sale => 
        (sale.party_name && sale.party_name.toLowerCase().includes(term)) ||
        sale.amount.toString().includes(term) ||
        sale.date.includes(term) ||
        sale.payment_mode.includes(term)
      );
    }
    
    setFilteredSales(filtered);
  }, [sales, selectedPaymentModes, dateRange, minAmount, maxAmount, searchTerm]);

  const togglePaymentMode = (mode: 'cash' | 'digital' | 'credit') => {
    if (selectedPaymentModes.includes(mode)) {
      setSelectedPaymentModes(selectedPaymentModes.filter(m => m !== mode));
    } else {
      setSelectedPaymentModes([...selectedPaymentModes, mode]);
    }
  };

  const handleDelete = async () => {
    if (filteredSales.length === 0) return;
    
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    
    setIsLoading(true);
    setConfirmDelete(false);
    
    try {
      await onDelete(filteredSales.map(sale => sale.id));
      onClose();
    } catch (error) {
      console.error('Error deleting sales:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetFilters = () => {
    setSelectedPaymentModes([]);
    setDateRange({ start: '', end: '' });
    setMinAmount('');
    setMaxAmount('');
    setSearchTerm('');
  };

  // Calculate total amounts by payment mode
  const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalByCash = filteredSales
    .filter(sale => sale.payment_mode === 'cash')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const totalByDigital = filteredSales
    .filter(sale => sale.payment_mode === 'digital')
    .reduce((sum, sale) => sum + sale.amount, 0);
  const totalByCredit = filteredSales
    .filter(sale => sale.payment_mode === 'credit')
    .reduce((sum, sale) => sum + sale.amount, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-red-600 text-white p-4 rounded-t-lg">
          <h3 className="text-lg font-medium">Bulk Delete Sales</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Filter controls */}
        <div className="p-4 border-b">
          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by party name, amount, etc."
              className="w-full p-2 border rounded-md"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Mode Filter
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => togglePaymentMode('cash')}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    selectedPaymentModes.includes('cash')
                      ? 'bg-green-100 border-green-300 text-green-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Cash
                </button>
                <button
                  onClick={() => togglePaymentMode('digital')}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    selectedPaymentModes.includes('digital')
                      ? 'bg-blue-100 border-blue-300 text-blue-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Digital
                </button>
                <button
                  onClick={() => togglePaymentMode('credit')}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    selectedPaymentModes.includes('credit')
                      ? 'bg-orange-100 border-orange-300 text-orange-800'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Credit
                </button>
                {selectedPaymentModes.length > 0 && (
                  <button
                    onClick={() => setSelectedPaymentModes([])}
                    className="px-3 py-1 rounded-full text-sm border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="Min"
                  className="w-full p-2 border rounded-md"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="Max"
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Date Filters
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => applyDateFilter('today')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Today</button>
              <button onClick={() => applyDateFilter('yesterday')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Yesterday</button>
              <button onClick={() => applyDateFilter('thisWeek')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">This Week</button>
              <button onClick={() => applyDateFilter('lastWeek')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Last Week</button>
              <button onClick={() => applyDateFilter('thisMonth')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">This Month</button>
              <button onClick={() => applyDateFilter('lastMonth')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Last Month</button>
              <button onClick={() => applyDateFilter('last3Months')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">Last 3 Months</button>
              <button onClick={() => applyDateFilter('thisYear')} className="px-3 py-1 text-sm border rounded hover:bg-gray-50">This Year</button>
              <button onClick={() => applyDateFilter('clear')} className="px-3 py-1 text-sm border border-gray-300 text-blue-600 rounded hover:bg-blue-50">Clear Date</button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full p-2 border rounded-md"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Reset All Filters
            </button>
          </div>
        </div>
        
        {/* Summary statistics */}
        <div className="p-4 border-b bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded-lg border shadow-sm">
              <p className="text-sm text-gray-500">Total Selected</p>
              <p className="text-xl font-semibold">₹{totalAmount.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{filteredSales.length} sales</p>
            </div>
            
            <div className="bg-white p-3 rounded-lg border shadow-sm">
              <p className="text-sm text-gray-500">Cash</p>
              <p className="text-xl font-semibold text-green-600">₹{totalByCash.toLocaleString()}</p>
              <p className="text-xs text-gray-500">
                {filteredSales.filter(s => s.payment_mode === 'cash').length} sales
              </p>
            </div>
            
            <div className="bg-white p-3 rounded-lg border shadow-sm">
              <p className="text-sm text-gray-500">Digital</p>
              <p className="text-xl font-semibold text-blue-600">₹{totalByDigital.toLocaleString()}</p>
              <p className="text-xs text-gray-500">
                {filteredSales.filter(s => s.payment_mode === 'digital').length} sales
              </p>
            </div>
            
            <div className="bg-white p-3 rounded-lg border shadow-sm">
              <p className="text-sm text-gray-500">Credit</p>
              <p className="text-xl font-semibold text-orange-600">₹{totalByCredit.toLocaleString()}</p>
              <p className="text-xs text-gray-500">
                {filteredSales.filter(s => s.payment_mode === 'credit').length} sales
              </p>
            </div>
          </div>
        </div>
        
        {/* Preview */}
        <div className="flex-1 overflow-y-auto p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Sales that will be deleted ({filteredSales.length})
          </h4>
          
          {filteredSales.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No sales match the selected filters.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Payment Mode</th>
                    <th className="p-2 text-left">Party Name</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.slice(0, 50).map((sale) => (
                    <tr key={sale.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{formatDateWithOrdinal(sale.date)}</td>
                      <td className="p-2 text-right">₹{sale.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          sale.payment_mode === 'cash' 
                            ? 'bg-green-100 text-green-800' 
                            : sale.payment_mode === 'digital' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-orange-100 text-orange-800'
                        }`}>
                          {sale.payment_mode}
                        </span>
                      </td>
                      <td className="p-2">{sale.party_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSales.length > 50 && (
                <div className="p-2 text-center text-gray-500 border-t">
                  Showing 50 of {filteredSales.length} sales
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Confirmation message */}
        {confirmDelete && (
          <div className="p-4 border-t bg-red-50">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">
                  Are you absolutely sure?
                </p>
                <p className="text-sm text-red-700 mt-1">
                  This will permanently delete {filteredSales.length} sales totaling ₹{totalAmount.toLocaleString()}. 
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Actions */}
        <div className="p-4 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            className={`px-4 py-2 text-white rounded-md disabled:opacity-50 ${
              confirmDelete
                ? 'bg-red-700 hover:bg-red-800'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            disabled={filteredSales.length === 0 || isLoading}
          >
            {isLoading 
              ? 'Deleting...' 
              : confirmDelete 
                ? `Yes, Delete ${filteredSales.length} Sales` 
                : `Delete ${filteredSales.length} Sales`
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkDeleteModal;
