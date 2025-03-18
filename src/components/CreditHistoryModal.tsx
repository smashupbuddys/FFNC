import React from 'react';
import { X, ArrowUpRight, ArrowDownRight, Calendar, Plus, IndianRupee } from 'lucide-react';
import { useState } from 'react';
import db, { generateId } from '../lib/db';

interface Transaction {
  id: string;
  date: string;
  type: 'sale' | 'payment';
  amount: number;
  description?: string;
  created_at: string;
}

interface CreditHistoryModalProps {
  show: boolean;
  onClose: () => void;
  customerName: string;
  transactions: Transaction[];
  totalCredit: number;
  totalPaid: number;
  onUpdate?: () => void;
}

const CreditHistoryModal: React.FC<CreditHistoryModalProps> = ({
  show,
  onClose,
  customerName,
  transactions,
  totalCredit,
  totalPaid,
  onUpdate
}) => {
  if (!show) return null;

  const remainingBalance = totalCredit - totalPaid;
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: 'sale' as 'sale' | 'payment',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAddTransaction = async () => {
    if (!newTransaction.amount || !newTransaction.date) {
      alert('Amount and date are required');
      return;
    }

    setIsProcessing(true);
    try {
      const dbInstance = await db.init();
      const id = generateId();

      await dbInstance.run('BEGIN TRANSACTION');

      try {
        // Add the transaction
        await dbInstance.run(`
          INSERT INTO transactions (
            id, date, type, amount, description, created_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          id,
          newTransaction.date,
          newTransaction.type,
          parseFloat(newTransaction.amount),
          newTransaction.description || null
        ]);

        // Update total paid amount if it's a payment
        if (newTransaction.type === 'payment') {
          await dbInstance.run(`
            UPDATE credit_sales
            SET paid_amount = paid_amount + ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE customer_name = ?
          `, [parseFloat(newTransaction.amount), customerName]);
        }

        await dbInstance.run('COMMIT');
        db.save();

        // Reset form and close modal
        setNewTransaction({
          type: 'sale',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          description: ''
        });
        setShowAddModal(false);

        // Refresh data
        if (onUpdate) {
          onUpdate();
        }
      } catch (error) {
        await dbInstance.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert('Error adding transaction. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full p-6">
        <div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{customerName}</h3>
              <p className="mt-1 text-sm text-gray-500">Credit History</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Entry
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

        {/* Add Transaction Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200]">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add Transaction</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <select
                    value={newTransaction.type}
                    onChange={(e) => setNewTransaction({
                      ...newTransaction,
                      type: e.target.value as 'sale' | 'payment'
                    })}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  >
                    <option value="sale">Credit</option>
                    <option value="payment">Payment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newTransaction.date}
                    onChange={(e) => setNewTransaction({
                      ...newTransaction,
                      date: e.target.value
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <IndianRupee className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={newTransaction.amount}
                      onChange={(e) => setNewTransaction({
                        ...newTransaction,
                        amount: e.target.value
                      })}
                      className="block w-full pl-10 pr-12 border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={newTransaction.description}
                    onChange={(e) => setNewTransaction({
                      ...newTransaction,
                      description: e.target.value
                    })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    placeholder="Enter description"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTransaction}
                  disabled={isProcessing || !newTransaction.amount || !newTransaction.date}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isProcessing ? 'Adding...' : 'Add Transaction'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center justify-between group hover:bg-blue-100 transition-colors duration-200 p-2 rounded-lg cursor-pointer">
              <div>
                <p className="text-sm text-blue-600">Total Credit</p>
                <p className="mt-1 text-xl font-semibold text-blue-700">
                  ₹{totalCredit.toLocaleString()}
                </p>
              </div>
              <ArrowUpRight className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between group hover:bg-green-100 transition-colors duration-200 p-2 rounded-lg cursor-pointer">
              <div>
                <p className="text-sm text-green-600">Total Paid</p>
                <p className="mt-1 text-xl font-semibold text-green-700">
                  ₹{totalPaid.toLocaleString()}
                </p>
              </div>
              <ArrowDownRight className="w-6 h-6 text-green-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>

          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center justify-between group hover:bg-red-100 transition-colors duration-200 p-2 rounded-lg cursor-pointer">
              <div>
                <p className="text-sm text-red-600">Remaining Balance</p>
                <p className="mt-1 text-xl font-semibold text-red-700">
                  ₹{remainingBalance.toLocaleString()}
                </p>
              </div>
              <ArrowUpRight className="w-6 h-6 text-red-500 group-hover:scale-110 transition-transform duration-200" />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="mt-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Running Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((transaction, index) => {
                  // Calculate running balance
                  const runningBalance = transactions
                    .slice(0, index + 1)
                    .reduce((sum, t) => 
                      sum + (t.type === 'sale' ? t.amount : -t.amount), 
                    0);

                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(transaction.date).toLocaleDateString()}
                        <span className="ml-2 text-xs text-gray-500">
                          {new Date(transaction.date).toLocaleTimeString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          transaction.type === 'sale'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {transaction.type === 'sale' ? 'Credit' : 'Payment'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{transaction.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {transaction.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          runningBalance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          ₹{Math.abs(runningBalance).toLocaleString()}
                          {runningBalance !== 0 && (
                            <span className="ml-1 font-semibold">
                              {runningBalance > 0 ? 'DR' : 'CR'}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default CreditHistoryModal;
