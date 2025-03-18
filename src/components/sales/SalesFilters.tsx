import React, { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { DateRange } from '../../types/sales';

interface SalesFiltersProps {
  searchTerm: string;
  dateRange: DateRange;
  selectedPaymentModes: ('cash' | 'digital' | 'credit')[];
  onSearchChange: (value: string) => void;
  onDateRangeChange: (range: DateRange) => void;
  onPaymentModeChange: (modes: ('cash' | 'digital' | 'credit')[]) => void;
}

const SalesFilters: React.FC<SalesFiltersProps> = ({
  searchTerm,
  dateRange,
  selectedPaymentModes,
  onSearchChange,
  onDateRangeChange,
  onPaymentModeChange
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handlePredefinedDateRange = useCallback((type: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (type) {
      case 'today':
        // Leave start and end as today
        break;
      case 'yesterday':
        start.setDate(today.getDate() - 1);
        end = new Date(start);
        break;
      case 'thisWeek':
        // Set to the beginning of current week (Sunday)
        start.setDate(today.getDate() - today.getDay());
        break;
      case 'lastWeek':
        // Last week (Sunday to Saturday)
        start.setDate(today.getDate() - today.getDay() - 7);
        end.setDate(today.getDate() - today.getDay() - 1);
        break;
      case 'thisMonth':
        // Beginning of current month
        start.setDate(1);
        break;
      case 'lastMonth':
        // Last month
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'clear':
        // Clear the date range
        onDateRangeChange({ from: null, to: null });
        return;
      default:
        return;
    }

    const formatDate = (date: Date) => {
      return date.toISOString().split('T')[0];
    };

    onDateRangeChange({
      from: formatDate(start),
      to: formatDate(end)
    });
  }, [onDateRangeChange]);

  const togglePaymentMode = useCallback((mode: 'cash' | 'digital' | 'credit') => {
    let newModes: ('cash' | 'digital' | 'credit')[];
    
    if (selectedPaymentModes.includes(mode)) {
      // Remove the mode if it's already selected
      newModes = selectedPaymentModes.filter(m => m !== mode);
    } else {
      // Add the mode if it's not already selected
      newModes = [...selectedPaymentModes, mode];
    }
    
    onPaymentModeChange(newModes);
  }, [selectedPaymentModes, onPaymentModeChange]);

  const clearFilters = useCallback(() => {
    onSearchChange('');
    onDateRangeChange({ from: null, to: null });
    onPaymentModeChange([]);
  }, [onSearchChange, onDateRangeChange, onPaymentModeChange]);

  const isFiltersActive = searchTerm || dateRange.from || dateRange.to || selectedPaymentModes.length > 0;

  return (
    <div className="mb-6 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by amount, payment mode, or party name..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
        {searchTerm && (
          <button
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => onSearchChange('')}
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Filter */}
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className={`px-3 py-1.5 border rounded-md text-sm ${
              dateRange.from || dateRange.to
                ? 'bg-blue-50 border-blue-300 text-blue-800'
                : 'border-gray-300 text-gray-700'
            }`}
          >
            {dateRange.from || dateRange.to ? 'Date: Selected' : 'Filter by Date'}
          </button>
          
          {showDatePicker && (
            <div className="absolute left-0 top-full mt-1 w-64 p-3 bg-white border border-gray-200 rounded-md shadow-lg z-10">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
                    <input
                      type="date"
                      value={dateRange.from || ''}
                      onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value || null })}
                      className="w-full p-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                    <input
                      type="date"
                      value={dateRange.to || ''}
                      onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value || null })}
                      className="w-full p-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
                
                <div className="border-t pt-2">
                  <p className="text-xs font-medium text-gray-700 mb-1">Quick Selections</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <button
                      onClick={() => handlePredefinedDateRange('today')}
                      className="p-1 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => handlePredefinedDateRange('yesterday')}
                      className="p-1 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                      Yesterday
                    </button>
                    <button
                      onClick={() => handlePredefinedDateRange('thisWeek')}
                      className="p-1 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                      This Week
                    </button>
                    <button
                      onClick={() => handlePredefinedDateRange('lastWeek')}
                      className="p-1 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                      Last Week
                    </button>
                    <button
                      onClick={() => handlePredefinedDateRange('thisMonth')}
                      className="p-1 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => handlePredefinedDateRange('lastMonth')}
                      className="p-1 bg-gray-50 hover:bg-gray-100 rounded"
                    >
                      Last Month
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-end pt-2 border-t">
                  <button
                    onClick={() => {
                      handlePredefinedDateRange('clear');
                      setShowDatePicker(false);
                    }}
                    className="px-2 py-1 text-xs text-red-600 hover:text-red-800"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setShowDatePicker(false)}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded ml-2"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Payment Mode Filters */}
        <button
          onClick={() => togglePaymentMode('cash')}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            selectedPaymentModes.includes('cash')
              ? 'bg-green-100 border-green-300 text-green-800'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Cash
        </button>
        <button
          onClick={() => togglePaymentMode('digital')}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            selectedPaymentModes.includes('digital')
              ? 'bg-blue-100 border-blue-300 text-blue-800'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Digital
        </button>
        <button
          onClick={() => togglePaymentMode('credit')}
          className={`px-3 py-1.5 rounded-md text-sm border ${
            selectedPaymentModes.includes('credit')
              ? 'bg-orange-100 border-orange-300 text-orange-800'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Credit
        </button>
        
        {/* Clear All Filters */}
        {isFiltersActive && (
          <button
            onClick={clearFilters}
            className="ml-auto px-3 py-1.5 text-sm text-red-600 hover:text-red-800 border border-transparent"
          >
            Clear All Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(SalesFilters);
