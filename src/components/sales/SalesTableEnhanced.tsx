import React, { useState, useMemo, useCallback } from 'react';
import { Sale } from '../../types/sales';
import { formatDateWithOrdinal } from '../../utils/dateUtils';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

interface SalesTableEnhancedProps {
  sales: Sale[];
  filteredTotal: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onDeleteSale: (id: string) => void;
  onViewCreditHistory?: (creditorId: string, creditorName: string) => void;
  onBulkSelectionChange?: (selectedIds: string[]) => void;
  sortConfig: {
    key: keyof Sale | null;
    direction: 'ascending' | 'descending';
  };
  onSort: (key: keyof Sale) => void;
  isLoading: boolean;
  enableSelection?: boolean;
}

const SalesTableEnhanced: React.FC<SalesTableEnhancedProps> = ({
  sales,
  filteredTotal,
  currentPage,
  pageSize,
  onPageChange,
  onDeleteSale,
  onViewCreditHistory,
  onBulkSelectionChange,
  sortConfig,
  onSort,
  isLoading,
  enableSelection = false
}) => {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Calculate total pages
  const totalPages = useMemo(() => {
    return Math.ceil(filteredTotal / pageSize);
  }, [filteredTotal, pageSize]);

  // Handle item selection
  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
      
      if (onBulkSelectionChange) {
        onBulkSelectionChange(Array.from(newSelection));
      }
      
      return newSelection;
    });
  }, [onBulkSelectionChange]);

  // Handle select all for current page
  const toggleSelectAll = useCallback(() => {
    if (selectedItems.size === sales.length) {
      // Deselect all
      setSelectedItems(new Set());
      if (onBulkSelectionChange) {
        onBulkSelectionChange([]);
      }
    } else {
      // Select all on current page
      const newSelection = new Set(sales.map(sale => sale.id));
      setSelectedItems(newSelection);
      if (onBulkSelectionChange) {
        onBulkSelectionChange(Array.from(newSelection));
      }
    }
  }, [sales, selectedItems.size, onBulkSelectionChange]);

  // Generate sort indicator
  const getSortIndicator = useCallback((key: keyof Sale) => {
    if (sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'ascending' ? '▲' : '▼';
  }, [sortConfig]);

  if (isLoading) {
    return (
      <div className="w-full p-4 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="w-full p-4 text-center text-gray-500">
        No sales found. Add a new sale or import from Excel/CSV.
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <div className="overflow-x-auto w-full">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {enableSelection && (
                <th className="p-2 w-10">
                  <input
                    type="checkbox"
                    checked={selectedItems.size > 0 && selectedItems.size === sales.length}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
              )}
              <th 
                className="p-2 text-left cursor-pointer hover:bg-gray-200"
                onClick={() => onSort('date')}
              >
                Date {getSortIndicator('date')}
              </th>
              <th 
                className="p-2 text-right cursor-pointer hover:bg-gray-200"
                onClick={() => onSort('amount')}
              >
                Amount {getSortIndicator('amount')}
              </th>
              <th 
                className="p-2 text-left cursor-pointer hover:bg-gray-200"
                onClick={() => onSort('payment_mode')}
              >
                Payment Mode {getSortIndicator('payment_mode')}
              </th>
              <th 
                className="p-2 text-left cursor-pointer hover:bg-gray-200"
                onClick={() => onSort('party_name')}
              >
                Party Name {getSortIndicator('party_name')}
              </th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t hover:bg-gray-50">
                {enableSelection && (
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(sale.id)}
                      onChange={() => toggleItemSelection(sale.id)}
                      className="rounded"
                    />
                  </td>
                )}
                <td className="p-2">{formatDateWithOrdinal(sale.date)}</td>
                <td className="p-2 text-right">₹{sale.amount.toFixed(2)}</td>
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
                <td className="p-2">
                  {sale.payment_mode === 'credit' && sale.party_name ? (
                    <button
                      className="text-blue-600 hover:underline focus:outline-none"
                      onClick={() => onViewCreditHistory && sale.party_name && onViewCreditHistory(sale.id, sale.party_name)}
                    >
                      {sale.party_name}
                    </button>
                  ) : (
                    sale.party_name || '-'
                  )}
                </td>
                <td className="p-2 text-right">
                  <button
                    onClick={() => onDeleteSale(sale.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete sale"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t">
        <div className="flex items-center">
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{" "}
            <span className="font-medium">
              {Math.min(currentPage * pageSize, filteredTotal)}
            </span>{" "}
            of <span className="font-medium">{filteredTotal}</span> results
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`p-2 rounded ${currentPage === 1
              ? "text-gray-400 cursor-not-allowed"
              : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          {/* Page numbers */}
          <div className="hidden sm:flex space-x-1">
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
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
                  onClick={() => onPageChange(pageNum)}
                  className={`px-3 py-1 rounded ${
                    currentPage === pageNum
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className={`p-2 rounded ${
              currentPage === totalPages
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SalesTableEnhanced);
