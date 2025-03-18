import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface EditTransactionModalProps {
  show: boolean;
  transaction: {
    id: string;
    date: string;
    type: 'bill' | 'payment';
    amount: number;
    bill_number?: string;
    has_gst: boolean;
    description?: string;
    is_permanent?: boolean;
  };
  onClose: () => void;
  onConfirm: (updatedTransaction: any) => Promise<void>;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  show,
  transaction,
  onClose,
  onConfirm
}) => {
  const [editedTransaction, setEditedTransaction] = useState({
    ...transaction
  });
  const [showFirstConfirmation, setShowFirstConfirmation] = useState(false);
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const isOpeningBalance = transaction.description?.includes('[OPENING BALANCE]');

  if (!show) return null;

  const handleFirstConfirm = () => {
    setShowFirstConfirmation(true);
  };

  const handleFinalConfirm = async () => {
    try {
      setIsProcessing(true);
      await onConfirm({
        ...editedTransaction,
        is_permanent: isOpeningBalance ? 1 : 0 // Ensure opening balance remains permanent
      });
      onClose();
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Error updating transaction. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const hasChanges = () => {
    return (
      editedTransaction.date !== transaction.date ||
      editedTransaction.amount !== transaction.amount ||
      editedTransaction.bill_number !== transaction.bill_number ||
      editedTransaction.has_gst !== transaction.has_gst ||
      editedTransaction.description !== transaction.description
    );
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Edit {isOpeningBalance ? 'Opening Balance' : transaction.type === 'bill' ? 'Bill' : 'Payment'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={isProcessing}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isOpeningBalance && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-100 rounded-md">
            <p className="text-sm text-yellow-800">
              This is an opening balance entry. Changes will affect the party's initial balance.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={editedTransaction.date}
              onChange={(e) => setEditedTransaction({ ...editedTransaction, date: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={showFirstConfirmation || isProcessing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Amount</label>
            <input
              type="number"
              value={editedTransaction.amount}
              onChange={(e) => setEditedTransaction({ ...editedTransaction, amount: parseFloat(e.target.value) })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              disabled={showFirstConfirmation || isProcessing}
            />
          </div>

          {!isOpeningBalance && transaction.type === 'bill' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Bill Number</label>
              <input
                type="text"
                value={editedTransaction.bill_number || ''}
                onChange={(e) => setEditedTransaction({ ...editedTransaction, bill_number: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                disabled={showFirstConfirmation || isProcessing}
              />
            </div>
          )}

          {!isOpeningBalance && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={editedTransaction.has_gst}
                onChange={(e) => setEditedTransaction({ ...editedTransaction, has_gst: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                disabled={showFirstConfirmation || isProcessing}
              />
              <label className="ml-2 block text-sm text-gray-900">Has GST</label>
            </div>
          )}

          {!isOpeningBalance && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                type="text"
                value={editedTransaction.description || ''}
                onChange={(e) => setEditedTransaction({ ...editedTransaction, description: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                disabled={showFirstConfirmation || isProcessing}
              />
            </div>
          )}
        </div>

        {!showFirstConfirmation && !showFinalConfirmation && (
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              onClick={handleFirstConfirm}
              disabled={!hasChanges() || isProcessing}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Update
            </button>
          </div>
        )}

        {showFirstConfirmation && !showFinalConfirmation && (
          <div className="mt-6">
            <div className="flex items-center p-4 bg-yellow-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">
                  Are you sure you want to edit this {isOpeningBalance ? 'opening balance' : transaction.type}?
                </h4>
                <p className="mt-1 text-sm text-yellow-700">
                  {isOpeningBalance 
                    ? "This will modify the party's initial balance and affect all subsequent balance calculations."
                    : "This will modify the transaction and update all balances."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowFirstConfirmation(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                disabled={isProcessing}
              >
                Go Back
              </button>
              <button
                onClick={() => setShowFinalConfirmation(true)}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                disabled={isProcessing}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {showFinalConfirmation && (
          <div className="mt-6">
            <div className="flex items-center p-4 bg-red-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-3" />
              <div>
                <h4 className="text-sm font-medium text-red-800">
                  Final Confirmation Required
                </h4>
                <p className="mt-1 text-sm text-red-700">
                  {isOpeningBalance 
                    ? "This will permanently change the party's opening balance. Are you absolutely sure?"
                    : "This action cannot be undone. Are you absolutely sure?"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowFinalConfirmation(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
                disabled={isProcessing}
              >
                Go Back
              </button>
              <button
                onClick={handleFinalConfirm}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditTransactionModal;
