import React, { useState } from 'react';
import { Transaction, Creditor } from '../../types/sales';
import { formatDateWithOrdinal } from '../../utils/dateUtils';
import { X } from 'react-feather';

interface CreditHistoryModalProps {
  creditor: Creditor;
  transactions: Transaction[];
  onClose: () => void;
  onAddPayment: (amount: number, date: string, description: string) => Promise<void>;
}

const CreditHistoryModal: React.FC<CreditHistoryModalProps> = ({ 
  creditor, 
  transactions, 
  onClose, 
  onAddPayment 
}) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onAddPayment(parseFloat(amount), date, description);
      setAmount('');
      setDescription('');
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Error adding payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between bg-indigo-600 text-white p-4 rounded-t-lg">
          <h3 className="text-lg font-medium">{creditor.name} - Credit History</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {/* Summary */}
        <div className="p-4 border-b">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm text-blue-800 font-medium">Total Credit</h4>
              <p className="text-xl font-bold">₹{creditor.total_credit.toFixed(2)}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <h4 className="text-sm text-green-800 font-medium">Total Paid</h4>
              <p className="text-xl font-bold">₹{creditor.total_paid.toFixed(2)}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-sm text-red-800 font-medium">Balance Due</h4>
              <p className="text-xl font-bold">₹{creditor.remaining_balance.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        {/* Add Payment Form */}
        <div className="p-4 border-b">
          <h4 className="text-md font-medium mb-3">Add Payment</h4>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0.01"
                placeholder="Enter amount"
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
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 border rounded-md"
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description (Optional)
              </label>
              <div className="flex">
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., 'Partial payment'"
                  className="flex-1 p-2 border rounded-l-md"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-r-md hover:bg-indigo-700 disabled:bg-indigo-300"
                  disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
                >
                  {isSubmitting ? 'Adding...' : 'Add Payment'}
                </button>
              </div>
            </div>
          </form>
        </div>
        
        {/* Transaction History */}
        <div className="flex-1 overflow-y-auto p-4">
          <h4 className="text-md font-medium mb-3">Transaction History</h4>
          
          {transactions.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No transactions found for this creditor.
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">
                        {formatDateWithOrdinal(transaction.date)}
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          transaction.type === 'sale' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {transaction.type === 'sale' ? 'Sale' : 'Payment'}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        ₹{transaction.amount.toFixed(2)}
                      </td>
                      <td className="p-2">
                        {transaction.description || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditHistoryModal;
