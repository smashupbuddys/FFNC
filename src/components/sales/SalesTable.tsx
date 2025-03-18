import React from 'react';
import { Sale } from '../../types/sales';
import { formatDateWithOrdinal } from '../../utils/dateUtils';

interface SalesTableProps {
  sales: Sale[];
  onDeleteSale: (id: string) => void;
  isLoading: boolean;
}

const SalesTable: React.FC<SalesTableProps> = ({ sales, onDeleteSale, isLoading }) => {
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
    <div className="overflow-x-auto w-full">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Date</th>
            <th className="p-2 text-right">Amount</th>
            <th className="p-2 text-left">Payment Mode</th>
            <th className="p-2 text-left">Party Name</th>
            <th className="p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="border-t hover:bg-gray-50">
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
              <td className="p-2">{sale.party_name || '-'}</td>
              <td className="p-2 text-right">
                <button
                  onClick={() => onDeleteSale(sale.id)}
                  className="text-red-500 hover:text-red-700"
                  title="Delete sale"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SalesTable;
