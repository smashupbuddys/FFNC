import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Trash2, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw, Calendar, Pencil } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Area } from 'recharts';
import db, { generateId } from '../lib/db';
import { addTransaction, deleteTransaction, processBulkEntries, recalculatePartyBalance } from '../lib/db/operations';
import BulkEntryModal from '../components/BulkEntryModal';
import InflationAnalysisSection from '../components/InflationAnalysisSection';
import EditTransactionModal from '../components/EditTransactionModal';
import { Transaction as BaseTransaction } from '../lib/types';

interface Party {
  id: string;
  name: string;
  credit_limit: number;
  current_balance: number;
  contact_person?: string;
  phone?: string;
  address?: string;
  gst_number?: string;
  created_at: string;
  updated_at: string;
}

interface Transaction extends Omit<BaseTransaction, 'type'> {
  type: 'bill' | 'expense';
  running_balance: number;
  baseAmount?: number;
  gstAmount?: number;
  is_permanent?: boolean;
  has_gst: boolean;
}

interface ChartData {
  month: string;
  bills: number;
  payments: number;
  balance: number;
  gstAmount: number;
  inflationAdjustedBalance: number;
}

const calculateGSTAmount = (amount: number, hasGST: boolean) => {
  if (!hasGST) return { baseAmount: amount, gstAmount: 0 };
  const baseAmount = Math.round((amount / 1.03) * 100) / 100;
  const gstAmount = Math.round((amount - baseAmount) * 100) / 100;
  return { baseAmount, gstAmount };
};

const PartyDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [party, setParty] = useState<Party | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [fixStatus, setFixStatus] = useState<string>('Ready');
  const [showOnlyWithGR, setShowOnlyWithGR] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);


  useEffect(() => {
    if (id) {
      loadPartyDetails();
      loadTransactions();
    }
  }, [id, startDate, endDate, showOnlyWithGR]);

  const loadPartyDetails = async () => {
    try {
      const dbInstance = await db.init();
      const result = dbInstance.exec('SELECT * FROM parties WHERE id = ?', [id]);

      if (result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        setParty({
          id: row[0],
          name: row[1],
          credit_limit: row[2],
          current_balance: row[3],
          contact_person: row[4],
          phone: row[5],
          address: row[6],
          gst_number: row[7],
          created_at: row[8],
          updated_at: row[9],
        });
      } else {
        setParty(null);
      }
    } catch (error) {
      console.error('Error loading party details:', error);
    }
  };

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const dbInstance = await db.init();
      let query = `
        WITH ordered_transactions AS (
          SELECT 
            t.id,
            t.date,
            CASE 
              WHEN t.type = 'expense' AND t.expense_category = 'party_payment' THEN 'payment'
              WHEN t.type = 'bill' THEN 'bill'
              ELSE t.type 
            END as type,
            t.amount,
            t.has_gst,
            t.bill_number,
            t.description,
            t.created_at,
            t.updated_at,
            t.is_permanent
          FROM transactions t
          WHERE t.party_id = ?
          AND (t.type = 'bill' OR (t.type = 'expense' AND t.expense_category = 'party_payment'))
          ${startDate && endDate ? 'AND t.date BETWEEN ? AND ?' : startDate ? 'AND t.date >= ?' : endDate ? 'AND t.date <= ?' : ''}
          ${showOnlyWithGR ? 'AND t.bill_number IS NOT NULL' : ''}
          ORDER BY t.date ASC
        )
        SELECT * FROM ordered_transactions
      `;

      const params = [id];
      if (startDate && endDate) {
        params.push(startDate, endDate);
      } else if (startDate) {
        params.push(startDate);
      } else if (endDate) {
        params.push(endDate);
      }

      const result = await db.exec(query, params);

      if (result.length > 0) {
        let runningBalance = 0;
        const txns = result[0].values.map((row: any) => {
          const [id, date, type, amount, has_gst, bill_number, description, created_at, updated_at, is_permanent] = row;
          const numAmount = Number(amount || 0);
          const { baseAmount, gstAmount } = calculateGSTAmount(numAmount, has_gst);

          if (type === 'bill') {
            runningBalance += numAmount;
          } else if (type === 'payment') {
            runningBalance -= numAmount;
          }

          return {
            id,
            date,
            type,
            amount: numAmount,
            has_gst,
            bill_number,
            description,
            created_at,
            updated_at,
            baseAmount,
            gstAmount,
            running_balance: runningBalance,
            is_permanent
          };
        });

        setTransactions([...txns].reverse());
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixBalances = async () => {
    if (isSaving) return;
    setFixStatus('Recalculating Balances...');
    setIsSaving(true);
    try {
      await recalculatePartyBalance(id!);
      await loadTransactions();
      await loadPartyDetails();
      setFixStatus('Balances Fixed!');
      setTimeout(() => setFixStatus('Ready'), 2000);
    } catch (error) {
      console.error('Error fixing balances:', error);
      setFixStatus('Error');
      setTimeout(() => setFixStatus('Ready'), 2000);
      alert('Error fixing balances. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    setIsSaving(true);
    try {
      await deleteTransaction(id!, transactionId);
      await loadTransactions();
      await loadPartyDetails();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      if (error instanceof Error && error.message === 'Cannot delete a permanent transaction') {
        alert('This transaction cannot be deleted as it is a permanent record.');
      } else {
        alert('Error deleting transaction. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditTransaction = async (updatedTransaction: Transaction) => {
    setIsSaving(true);
    try {
      const dbInstance = await db.init();
      await db.run('BEGIN TRANSACTION');

      try {
        const isOpeningBalance = updatedTransaction.description?.includes('[OPENING BALANCE]');
        
        // Update the transaction
        await db.run(`
          UPDATE transactions 
          SET date = ?,
              amount = ?,
              bill_number = ?,
              has_gst = ?,
              description = ?,
              is_permanent = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [
          updatedTransaction.date,
          updatedTransaction.amount,
          updatedTransaction.bill_number || null,
          updatedTransaction.has_gst ? 1 : 0,
          updatedTransaction.description || null,
          updatedTransaction.is_permanent ? 1 : 0,
          updatedTransaction.id
        ]);

        // If this is an opening balance, we need to recalculate all balances
        if (isOpeningBalance) {
          // Get the original transaction to calculate balance difference
          const originalTxn = transactions.find(t => t.id === updatedTransaction.id);
          if (originalTxn) {
            const balanceDifference = updatedTransaction.amount - originalTxn.amount;
            
            // Update party's current balance to reflect the change
            await db.run(`
              UPDATE parties 
              SET current_balance = current_balance + ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [balanceDifference, id]);
          }
        }

        // Recalculate all running balances
        await recalculatePartyBalance(id!);

        await db.run('COMMIT');

        // Reload data
        await loadTransactions();
        await loadPartyDetails();

        setShowEditModal(false);
        setSelectedTransaction(null);
      } catch (error) {
        await db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Error updating transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDeleteTransactions = async () => {
    if (selectedTransactions.length === 0) {
      alert('Please select at least one transaction to delete.');
      return;
    }

    setIsSaving(true);
    try {
      const dbInstance = await db.init();
      dbInstance.run('BEGIN TRANSACTION');

      try {
        const sortedTransactions = selectedTransactions
          .map((txId) => transactions.find((t) => t.id === txId))
          .filter((t) => t !== undefined)
          .sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime());

        // Check for permanent transactions first
        const permanentTransactions = sortedTransactions.filter(t => t?.is_permanent);
        if (permanentTransactions.length > 0) {
          throw new Error('Cannot delete permanent transactions');
        }

        for (const transaction of sortedTransactions) {
          if (transaction) {
            await deleteTransaction(id!, transaction.id);
          }
        }

        dbInstance.run('COMMIT');
        setSelectedTransactions([]);
        await loadTransactions();
        await loadPartyDetails();
      } catch (error) {
        dbInstance.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error deleting transactions:', error);
      if (error instanceof Error && error.message === 'Cannot delete permanent transactions') {
        alert('Some of the selected transactions are permanent and cannot be deleted.');
      } else {
        alert('Error deleting transactions. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkEntry = async (entries: any[]) => {
    setIsSaving(true);
    try {
      await processBulkEntries(id!, entries);
      await loadTransactions();
      await loadPartyDetails();
      setShowBulkModal(false);
    } catch (error) {
      console.error('Error processing bulk entries:', error);
      alert('Error processing bulk entries. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteParty = async () => {
    if (!party) return;

    try {
      // First check for permanent transactions
      const dbInstance = await db.init();
      console.log('Checking for permanent transactions...');
      
      const permanentResult = await db.exec(`
        SELECT COUNT(*) as permanent_count, 
               (SELECT COUNT(*) FROM transactions WHERE party_id = ?) as total_count 
        FROM transactions 
        WHERE party_id = ? 
        AND is_permanent = 1
      `, [id, id]);

      const permanentCount = permanentResult[0].values[0][0];
      const totalCount = permanentResult[0].values[0][1];

      console.log(`Found ${permanentCount} permanent transactions out of ${totalCount} total`);

      if (permanentCount > 0) {
        const forceDelete = window.confirm(
          `⚠️ WARNING: This party has ${permanentCount} permanent transactions (like opening balance) out of ${totalCount} total transactions.\n\n` +
          `Deleting this party will:\n` +
          `- Permanently remove ALL transactions\n` +
          `- Delete historical balance records\n` +
          `- Cannot be undone\n\n` +
          `Are you absolutely sure you want to force delete this party?`
        );

        if (!forceDelete) return;

        // Second confirmation for force deletion
        const finalConfirmation = window.confirm(
          `🚨 FINAL WARNING: You are about to force delete ${party.name}\n\n` +
          `This will permanently delete:\n` +
          `- ${permanentCount} permanent transactions\n` +
          `- ${totalCount - permanentCount} regular transactions\n` +
          `- All historical records\n\n` +
          `Type 'DELETE' to confirm:`
        );

        if (!finalConfirmation) return;

        // Get user to type DELETE to confirm
        const userInput = window.prompt(
          `Type 'DELETE' to permanently remove ${party.name} and all its transactions:`
        );

        if (userInput !== 'DELETE') {
          alert('Deletion cancelled: Incorrect confirmation text');
          return;
        }
      } else {
        // Normal deletion flow for parties without permanent transactions
        if (!window.confirm(`Are you sure you want to delete ${party.name} and all associated transactions?`)) {
          return;
        }
      }

      setIsSaving(true);
      console.log('Starting deletion process...');

      try {
        // Use a simple try/catch without nesting to avoid complexity
        console.log('Beginning transaction...');
        await db.run('BEGIN TRANSACTION');
        
        console.log('Deleting transactions...');
        await db.run('DELETE FROM transactions WHERE party_id = ?', [id]);
        console.log('Transactions deleted successfully');

        console.log('Deleting party...');
        await db.run('DELETE FROM parties WHERE id = ?', [id]);
        console.log('Party deleted successfully');

        console.log('Committing transaction...');
        await db.run('COMMIT');
        console.log('Transaction committed successfully');

        // First update state, then navigate without timeout
        setIsSaving(false);
        console.log('Navigation to parties list...');
        navigate('/parties');
        console.log('Navigation completed');
        
        return; // Exit function after successful deletion
      } catch (error) {
        console.error('Error during deletion:', error);
        await db.run('ROLLBACK');
        throw error; // Re-throw to be caught by outer catch
      }
    } catch (error) {
      console.error('Error in handleDeleteParty:', error);
      setIsSaving(false); // Make sure to reset the saving state
      
      // Show appropriate error message
      if (error instanceof Error) {
        alert(`Error deleting party: ${error.message}`);
      } else {
        alert('Error deleting party. Please try again.');
      }
    }
  };

  const toggleSelectTransaction = (transactionId: string) => {
    setSelectedTransactions((prev) =>
      prev.includes(transactionId) ? prev.filter((id) => id !== transactionId) : [...prev, transactionId]
    );
  };

  const filteredTransactions = useMemo(() => {
    return transactions;
  }, [transactions]);

  const summary = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let gstTransactions = 0;
    let totalGSTAmount = 0;

    const transactionsWithBalance = filteredTransactions.map((t) => {
      const { baseAmount, gstAmount } = t.has_gst ? calculateGSTAmount(t.amount, true) : { baseAmount: t.amount, gstAmount: 0 };

      if (t.has_gst) {
        gstTransactions++;
        totalGSTAmount += gstAmount;
      }

      if (t.type === 'bill') {
        totalDebit += t.amount;
      } else {
        totalCredit += t.amount;
      }

      return {
        ...t,
        baseAmount,
        gstAmount,
      };
    });

    return {
      totalDebit,
      totalCredit,
      pendingBalance: party?.current_balance || 0,
      gstTransactions,
      totalGSTAmount,
      gstPercentage: (gstTransactions / filteredTransactions.length) * 100 || 0,
      transactionsWithBalance,
    };
  }, [filteredTransactions, party?.current_balance]);

  const chartData = useMemo(() => {
    const data: ChartData[] = [];
    let runningBalance = 0;

    // Group transactions by month
    const monthlyData = new Map<string, {
      bills: number;
      payments: number;
      gstAmount: number;
    }>();

    filteredTransactions.forEach((t) => {
      const month = t.date.substring(0, 7); // YYYY-MM
      const current = monthlyData.get(month) || {
        bills: 0,
        payments: 0,
        gstAmount: 0
      };

      if (t.type === 'bill') {
        current.bills += t.amount;
        runningBalance += t.amount;
      } else {
        current.payments += t.amount;
        runningBalance -= t.amount;
      }

      if (t.has_gst) {
        current.gstAmount += calculateGSTAmount(t.amount, true).gstAmount;
      }

      monthlyData.set(month, current);
    });

    // Convert to array and sort by month
    Array.from(monthlyData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([month, values]) => {
        data.push({
          month,
          bills: values.bills,
          payments: values.payments,
          balance: runningBalance,
          gstAmount: values.gstAmount,
          inflationAdjustedBalance: runningBalance * 1.1 // Example inflation adjustment
        });
      });

    return data;
  }, [filteredTransactions]);

  if (isLoading || !party) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/parties')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{party.name}</h1>
            <p className="text-sm text-gray-500">
              {party.gst_number && <span className="mr-3">GST: {party.gst_number}</span>}
              {party.contact_person && <span>Contact: {party.contact_person}</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={isLoading || isSaving}
          >
            <Plus className="w-4 h-4 mr-2" />
            Bulk Entry
          </button>
          <button
            onClick={handleDeleteParty}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            disabled={isLoading || isSaving}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Party
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date</label>
            <div className="relative mt-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <Calendar className="absolute right-3 top-2 h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <div className="relative mt-1">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <Calendar className="absolute right-3 top-2 h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Show only with GR filter */}
      <div className="flex items-center mb-4">
        <input
          id="showOnlyWithGR"
          type="checkbox"
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          checked={showOnlyWithGR}
          onChange={(e) => setShowOnlyWithGR(e.target.checked)}
        />
        <label htmlFor="showOnlyWithGR" className="ml-2 block text-sm text-gray-900">
          Show only bills with GR number
        </label>
      </div>

      {/* Summary and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Bills Summary Card */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Bills Summary</h3>
              <div className="p-3 bg-red-100 rounded-full">
                <ArrowUpRight className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Total Bills Amount</p>
                <p className="text-2xl font-semibold text-red-600">₹{summary.totalDebit.toLocaleString()}</p>
              </div>
              {summary.totalGSTAmount > 0 && (
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Base Amount</p>
                      <p className="text-lg font-semibold text-blue-700">₹{(summary.totalDebit - summary.totalGSTAmount).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">GST Amount</p>
                      <p className="text-lg font-semibold text-blue-700">₹{summary.totalGSTAmount.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payments Summary Card */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Payments Summary</h3>
              <div className="p-3 bg-green-100 rounded-full">
                <ArrowDownRight className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Total Payments Made</p>
                <p className="text-2xl font-semibold text-green-600">₹{summary.totalCredit.toLocaleString()}</p>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-600 rounded-full transition-all duration-300"
                  style={{ width: `${(summary.totalCredit / summary.totalDebit * 100) || 0}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">
                {((summary.totalCredit / summary.totalDebit * 100) || 0).toFixed(1)}% of total bills paid
              </p>
            </div>
          </div>

          {/* Balance Summary Card */}
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Balance Summary</h3>
              <div className={`p-3 rounded-full ${summary.pendingBalance > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                {summary.pendingBalance > 0 ? (
                  <ArrowUpRight className="w-6 h-6 text-red-600" />
                ) : (
                  <ArrowDownRight className="w-6 h-6 text-green-600" />
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className={`text-2xl font-semibold ${summary.pendingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ₹{Math.abs(summary.pendingBalance).toLocaleString()}
                  <span className="ml-2 text-base font-medium">
                    {summary.pendingBalance > 0 ? 'DR' : 'CR'}
                  </span>
                </p>
              </div>
              
              {party.credit_limit > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-sm text-gray-600 mb-2">Credit Limit Usage</p>
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block text-blue-600">
                          {((summary.pendingBalance / party.credit_limit) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-blue-600">
                          ₹{party.credit_limit.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-100">
                      <div
                        style={{ width: `${(summary.pendingBalance / party.credit_limit * 100)}%` }}
                        className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Daily Transactions</h3>
          <div className="h-80">
            <div className="mb-4 text-sm text-gray-500">
              <span className="inline-flex items-center mr-4">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                Running Balance
              </span>
              <span className="inline-flex items-center">
                <span className="w-3 h-3 bg-blue-200 opacity-50 rounded-full mr-2"></span>
                Inflation Adjusted
              </span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" />
                <YAxis stroke="#6B7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                  }}
                  formatter={(value: any) => `₹${parseInt(value).toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="bills" name="Bills" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="payments" name="Payments" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="inflationAdjustedBalance"
                  name="Inflation Adjusted"
                  stroke="#3B82F6"
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  name="Running Balance"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="gstAmount"
                  name="GST"
                  stroke="#8B5CF6"
                  dot={false}
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Inflation Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <InflationAnalysisSection
          amount={summary.pendingBalance}
          startDate={transactions[transactions.length - 1]?.date || new Date().toISOString().split('T')[0]}
          type={summary.pendingBalance > 0 ? 'credit-given' : 'credit-taken'}
        />
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Transaction History</h2>
          {selectedTransactions.length > 0 && (
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedTransactions.length})
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={selectedTransactions.length === filteredTransactions.length && filteredTransactions.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTransactions(filteredTransactions.map((t) => t.id));
                      } else {
                        setSelectedTransactions([]);
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Base Amount</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GST</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bill Number</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Running Balance</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {summary.transactionsWithBalance.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={selectedTransactions.includes(transaction.id)}
                      onChange={() => toggleSelectTransaction(transaction.id)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      transaction.type === 'bill'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {transaction.type === 'bill' ? 'Bill' : 'Payment'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₹{transaction.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">₹{transaction.baseAmount?.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {transaction.has_gst ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-red-600">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.bill_number || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.description || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${
                      transaction.running_balance > 0
                        ? 'text-red-600'
                        : transaction.running_balance < 0
                        ? 'text-green-600'
                        : 'text-gray-900'
                    }`}>
                      ₹{Math.abs(transaction.running_balance).toLocaleString()}
                      {transaction.running_balance !== 0 && (
                        <span className="ml-1">
                          {transaction.running_balance > 0 ? 'DR' : 'CR'}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setShowEditModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 mr-2"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTransaction(transaction.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Entry Modal */}
      {showBulkModal && (
        <BulkEntryModal
          show={showBulkModal}
          onClose={() => setShowBulkModal(false)}
          onSubmit={handleBulkEntry}
          transactions={transactions}
          partyId={id}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center">
              <div className="mr-4">
                <AlertTriangle className="w-10 h-10 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Confirm Delete</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Are you sure you want to delete the selected transactions? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleBulkDeleteTransactions();
                  setShowDeleteConfirmation(false);
                }}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && selectedTransaction && (
        <div>
          <EditTransactionModal
            show={showEditModal}
            transaction={{
              id: selectedTransaction.id,
              date: selectedTransaction.date,
              type: selectedTransaction.type === 'expense' ? 'payment' : 'bill',
              amount: selectedTransaction.amount,
              bill_number: selectedTransaction.bill_number,
              has_gst: selectedTransaction.has_gst,
              description: selectedTransaction.description
            }}
            onClose={() => {
              setShowEditModal(false);
              setSelectedTransaction(null);
            }}
            onConfirm={handleEditTransaction}
          />
        </div>
      )}
    </div>
  );
};

export default PartyDetails;
