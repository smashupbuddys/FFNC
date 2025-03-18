import db, { generateId } from '../db';
import { ParsedEntry } from '../../pages/BulkEntry/types';

// Interfaces
export interface BulkEntry {
  type: 'sale' | 'expense' | 'bill' | 'payment';
  data: {
    id?: string;
    date: string;
    amount: number;
    payment_mode?: 'cash' | 'digital' | 'credit';
    party_name?: string;
    staff_name?: string;
    description?: string;
    billNumber?: string;
    hasGST?: boolean;
  }
}

export interface Transaction {
  id: string;
  date: string;
  type: 'bill' | 'payment' | 'sale';
  amount: number;
  bill_number?: string;
  has_gst: boolean;
  description?: string;
  running_balance: number;
  created_at: string;
}

export interface DuplicateInfo {
  existingEntry: {
    date: string;
    amount: number;
    type: string;
    billNumber?: string;
    partyName?: string;
    description?: string;
  };
  newEntry: {
    date: string;
    amount: number;
    type: string;
    billNumber?: string;
    partyName?: string;
    description?: string;
  };
  reason: 'AMOUNT_DATE_PARTY' | 'BILL_NUMBER' | 'EXACT_MATCH';
}

// Utility Functions
export const calculateGSTAmount = (amount: number) => {
  const baseAmount = Math.round((amount / 1.03) * 100) / 100;
  const gstAmount = Math.round((amount - baseAmount) * 100) / 100;
  return { baseAmount, gstAmount };
};

const convertToSQLDate = (date: string) => {
  try {
    // First try to parse as YYYY-MM-DD
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }

    // Then try DD/MM/YY format
    const parts = date.split('/');
    if (parts.length === 3) {
      const [day, month, year] = parts.map(part => part.trim());
      return `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    throw new Error('Invalid date format');
  } catch (error) {
    console.error('Date conversion error:', error);
    throw new Error(`Invalid date format: ${date}. Expected DD/MM/YY or YYYY-MM-DD`);
  }
};

// Main Functions
export const processBulkEntries = async (partyId: string | undefined, entries: ParsedEntry[]) => {
  const dbInstance = await db.init();

  try {
    dbInstance.run('BEGIN TRANSACTION');

    try {
      // Convert date format and sort chronologically
      const sortedEntries = [...entries].sort((a, b) => {
        const dateA = new Date(convertToSQLDate(a.data.date));
        const dateB = new Date(convertToSQLDate(b.data.date));
        return dateA.getTime() - dateB.getTime();
      });

      for (const entry of sortedEntries) {
        // Check for duplicates before processing
        const isDuplicate = await checkDuplicateTransaction(
          partyId || null,
          entry.data.date,
          entry.data.amount,
          entry.type,
          entry.data.billNumber
        );

        if (isDuplicate) {
          console.warn('Skipping duplicate entry:', entry);
          continue;
        }

        const sqlDate = convertToSQLDate(entry.data.date);
        
        if (entry.type === 'payment') {
          const paymentId = generateId();
          dbInstance.run(`
            INSERT INTO transactions (
              id, date, type, amount,
              expense_category, has_gst, description,
              party_id, created_at
            ) VALUES (?, ?, 'expense', ?, 'party_payment', ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            paymentId,
            sqlDate,
            entry.data.amount,
            entry.data.hasGST ? 1 : 0,
            entry.data.description || null,
            partyId || null
          ]);

        } else if (entry.type === 'bill') {
          const billId = generateId();
          dbInstance.run(`
            INSERT INTO transactions (
              id, date, type, amount,
              bill_number, has_gst, description,
              party_id, created_at
            ) VALUES (?, ?, 'bill', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [
            billId,
            sqlDate,
            entry.data.amount,
            entry.data.billNumber || null,
            entry.data.hasGST ? 1 : 0,
            entry.data.description || null,
            partyId || null
          ]);

        }
      }

      // After processing all entries, recalculate running balances
      if (partyId) {
        await recalculatePartyBalance(partyId);
      }

      dbInstance.run('COMMIT');
      db.save();
    } catch (error) {
      dbInstance.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error in processBulkEntries:', error);
    throw error;
  }
};

export const checkDuplicateTransaction = async (
  partyId: string | null,
  date: string,
  amount: number,
  type: string,
  billNumber?: string
): Promise<DuplicateInfo | null> => {
  const dbInstance = await db.init();
  
  try {
    // First check for exact match including bill number
    const exactMatchQuery = `
      SELECT t.*, p.name as party_name 
      FROM transactions t
      LEFT JOIN parties p ON t.party_id = p.id
      WHERE t.date = ? 
      AND ABS(t.amount - ?) < 0.01
      AND t.type = ?
      ${billNumber ? 'AND t.bill_number = ?' : ''}
      ${partyId ? 'AND t.party_id = ?' : ''}
      LIMIT 1
    `;

    const exactMatchParams = [date, amount, type];
    if (billNumber) exactMatchParams.push(billNumber);
    if (partyId) exactMatchParams.push(partyId);

    const exactMatch = await dbInstance.exec(exactMatchQuery, exactMatchParams);

    if (exactMatch.length > 0 && exactMatch[0].values.length > 0) {
      const existing = exactMatch[0].values[0];
      return {
        existingEntry: {
          date: existing.date,
          amount: existing.amount,
          type: existing.type,
          billNumber: existing.bill_number,
          partyName: existing.party_name,
          description: existing.description
        },
        newEntry: {
          date,
          amount,
          type,
          billNumber,
          partyName: existing.party_name // Use same party name for comparison
        },
        reason: 'EXACT_MATCH'
      };
    }

    // Check for same amount + date + party combination
    if (partyId) {
      const amountDateQuery = `
        SELECT t.*, p.name as party_name 
        FROM transactions t
        LEFT JOIN parties p ON t.party_id = p.id
        WHERE t.date = ? 
        AND ABS(t.amount - ?) < 0.01
        AND t.party_id = ?
        LIMIT 1
      `;

      const amountDateMatch = await dbInstance.exec(amountDateQuery, [date, amount, partyId]);

      if (amountDateMatch.length > 0 && amountDateMatch[0].values.length > 0) {
        const existing = amountDateMatch[0].values[0];
        return {
          existingEntry: {
            date: existing.date,
            amount: existing.amount,
            type: existing.type,
            billNumber: existing.bill_number,
            partyName: existing.party_name,
            description: existing.description
          },
          newEntry: {
            date,
            amount,
            type,
            billNumber,
            partyName: existing.party_name
          },
          reason: 'AMOUNT_DATE_PARTY'
        };
      }
    }

    // Check for duplicate bill number for the same party
    if (billNumber && partyId) {
      const billNumberQuery = `
        SELECT t.*, p.name as party_name 
        FROM transactions t
        LEFT JOIN parties p ON t.party_id = p.id
        WHERE t.bill_number = ?
        AND t.party_id = ?
        LIMIT 1
      `;

      const billNumberMatch = await dbInstance.exec(billNumberQuery, [billNumber, partyId]);

      if (billNumberMatch.length > 0 && billNumberMatch[0].values.length > 0) {
        const existing = billNumberMatch[0].values[0];
        return {
          existingEntry: {
            date: existing.date,
            amount: existing.amount,
            type: existing.type,
            billNumber: existing.bill_number,
            partyName: existing.party_name,
            description: existing.description
          },
          newEntry: {
            date,
            amount,
            type,
            billNumber,
            partyName: existing.party_name
          },
          reason: 'BILL_NUMBER'
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    throw error;
  }
};

export const deleteTransaction = async (partyId: string, transactionId: string) => {
  const dbInstance = await db.init();
  
  try {
    dbInstance.run('BEGIN TRANSACTION');

    try {
      // Check if transaction is permanent
      const permanentCheck = await dbInstance.exec(
        'SELECT is_permanent FROM transactions WHERE id = ?',
        [transactionId]
      );

      if (permanentCheck.length > 0 && permanentCheck[0].values.length > 0) {
        const isPermanent = permanentCheck[0].values[0][0];
        if (isPermanent) {
          throw new Error('Cannot delete a permanent transaction');
        }
      }

      // Delete the transaction
      dbInstance.run('DELETE FROM transactions WHERE id = ?', [transactionId]);

      // Recalculate running balances
      await recalculatePartyBalance(partyId);

      dbInstance.run('COMMIT');
      db.save();
    } catch (error) {
      dbInstance.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteTransaction:', error);
    throw error;
  }
};

export const addTransaction = async (
  partyId: string, 
  transaction: Omit<Transaction, 'id' | 'running_balance' | 'created_at'>
) => {
  const dbInstance = await db.init();
  
  try {
    dbInstance.run('BEGIN TRANSACTION');

    try {
      // Check for duplicates
      const isDuplicate = await checkDuplicateTransaction(
        partyId,
        transaction.date,
        transaction.amount,
        transaction.type,
        transaction.bill_number
      );

      if (isDuplicate) {
        throw new Error('Duplicate transaction detected');
      }

      const transactionId = generateId();
      const sqlDate = convertToSQLDate(transaction.date);
      
      if (transaction.type === 'bill') {
        dbInstance.run(`
          INSERT INTO transactions (
            id, date, type, amount,
            bill_number, has_gst, description,
            party_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          transactionId,
          sqlDate,
          transaction.type,
          transaction.amount,
          transaction.bill_number || null,
          transaction.has_gst ? 1 : 0,
          transaction.description || null,
          partyId
        ]);

      } else if (transaction.type === 'payment') {
        dbInstance.run(`
          INSERT INTO transactions (
            id, date, type, amount,
            expense_category, has_gst, description,
            party_id, created_at
          ) VALUES (?, ?, 'expense', ?, 'party_payment', ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          transactionId,
          sqlDate,
          transaction.amount,
          transaction.has_gst ? 1 : 0,
          transaction.description || null,
          partyId
        ]);

      }

      // Recalculate running balances
      await recalculatePartyBalance(partyId);

      dbInstance.run('COMMIT');
      db.save();

      return transactionId;
    } catch (error) {
      dbInstance.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error in addTransaction:', error);
    throw error;
  }
};

export const recalculatePartyBalance = async (partyId: string) => {
  const dbInstance = await db.init();

  try {
    // Get all transactions sorted by date and created_at
    const result = await dbInstance.exec(`
      SELECT 
        id,
        date,
        type,
        amount,
        expense_category,
        created_at
      FROM transactions 
      WHERE party_id = ? 
      AND (
        type = 'bill' 
        OR (type = 'expense' AND expense_category = 'party_payment')
      )
      ORDER BY date ASC, created_at ASC
    `, [partyId]);

    if (!result.length) return 0;

    let runningBalance = 0;
    const transactions = result[0].values;

    // Process transactions chronologically
    for (const [id, date, type, amount, expenseCategory] of transactions) {
      // Update running balance based on transaction type
      if (type === 'bill') {
        runningBalance += parseFloat(amount);
      } else if (type === 'expense' && expenseCategory === 'party_payment') {
        runningBalance -= parseFloat(amount);
      }

      // Update running balance for each transaction
      dbInstance.run(`
        UPDATE transactions 
        SET running_balance = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [runningBalance, id]);
    }

    // Update party's current balance
    dbInstance.run(`
      UPDATE parties
      SET current_balance = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [runningBalance, partyId]);

    return runningBalance;
  } catch (error) {
    console.error('Error recalculating balances:', error);
    throw error;
  }
};

export const fixAllPartiesBalances = async () => {
  const dbInstance = await db.init();
  const parties = await dbInstance.exec('SELECT id FROM parties');
  
  if (parties && parties[0]?.values) {
    for (const [partyId] of parties[0].values) {
      try {
        await recalculatePartyBalance(partyId);
      } catch (error) {
        console.error(`Error fixing balance for party ${partyId}:`, error);
      }
    }
  }
};
