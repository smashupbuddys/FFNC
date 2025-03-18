import initSqlJs from 'sql.js';
import { markChanges } from './db/autoSync';

// Constants
const DB_STORAGE_KEY = 'finance_db_data';

// Singleton instance
let dbInstance: any = null;
let initPromise: Promise<any> | null = null;

// Load database from localStorage
const loadFromStorage = (): Uint8Array | null => {
  const storedData = localStorage.getItem(DB_STORAGE_KEY);
  if (!storedData) return null;
  
  try {
    const arr = JSON.parse(storedData);
    return new Uint8Array(arr);
  } catch (error) {
    console.error('Error parsing stored database, clearing storage:', error);
    localStorage.removeItem(DB_STORAGE_KEY);
    return null;
  }
};

// Save database to localStorage
const saveToStorage = (data: Uint8Array) => {
  try {
    const arr = Array.from(data);
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(arr));
    markChanges();
  } catch (error) {
    console.error('Error saving database:', error);
  }
};

// Save database to file
export const saveToFile = async () => {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }

  try {
    const data = dbInstance.export();
    const blob = new Blob([data], { type: 'application/octet-stream' });
    return blob;
  } catch (error) {
    console.error('Error saving database to file:', error);
    throw error;
  }
};

// Load database from file
export const loadFromFile = async (file: File) => {
  if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite3')) {
    throw new Error('Invalid file type. Please upload a .db, .sqlite, or .sqlite3 file');
  }

  try {
    const SQL = await initSqlJs({
      // Allocate more memory and enable memory growth
      wasmSettings: {
        initial: 256,  // Initial memory in pages (16MB)
        maximum: 2048
      },
      locateFile: file => {
        const baseUrl = import.meta.env.BASE_URL || '/';
        return `${baseUrl}sql.js/${file}`;
      }
    });

    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    const newDb = new SQL.Database(data);
    
    try {
      const tables = [
        'parties',
        'transactions',
        'staff',
        'credit_sales',
        'credit_payments',
        'staff_holidays',
        'staff_advances',
        'staff_advance_payments'
      ];

      for (const table of tables) {
        try {
          newDb.exec(`SELECT 1 FROM ${table} LIMIT 1`);
        } catch (error) {
          throw new Error(`Invalid database structure: Missing table '${table}'`);
        }
      }
    } catch (error) {
      throw new Error(`Database validation failed: ${error.message}`);
    }

    if (dbInstance) {
      dbInstance.close();
    }
    dbInstance = newDb;

    const exportedData = dbInstance.export();
    saveToStorage(exportedData);

    return true;
  } catch (error) {
    console.error('Error loading database from file:', error);
    throw error;
  }
};

// Initialize SQL.js
const initDB = async () => {
  if (dbInstance) return dbInstance;
  
  if (initPromise) return initPromise;

  initPromise = new Promise(async (resolve, reject) => {
    // Ensure WASM file exists
    try {
      const wasmResponse = await fetch('/sql.js/sql-wasm.wasm');
      if (!wasmResponse.ok) {
        throw new Error('SQL.js WASM file not found');
      }
    } catch (error) {
      console.error('Error checking WASM file:', error);
      reject(new Error('SQL.js WASM file not accessible'));
      return;
    }

    try {
      const SQL = await initSqlJs({
        // Allocate more memory and enable memory growth
        wasmSettings: {
          initial: 256,
          maximum: 2048
        },
        locateFile: file => {
          const baseUrl = import.meta.env.BASE_URL || '/';
          return `${baseUrl}sql.js/${file}`;
        }
      });

      const existingData = loadFromStorage();
      if (existingData) {
        dbInstance = new SQL.Database(existingData);
        
        // Run migrations for existing database
        try {
          // Add is_permanent column if it doesn't exist
          const columnsResult = dbInstance.exec(`
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='transactions'
          `);
          
          const tableSchema = columnsResult[0].values[0][0] as string;
          if (!tableSchema.includes('is_permanent')) {
            dbInstance.run(`
              ALTER TABLE transactions 
              ADD COLUMN is_permanent BOOLEAN DEFAULT 0
            `);
            
            // Update existing opening balance transactions to be permanent
            dbInstance.run(`
              UPDATE transactions 
              SET is_permanent = 1 
              WHERE description LIKE '%OPENING BALANCE%'
            `);
            
            console.log('Added is_permanent column and updated opening balance transactions');
            const data = dbInstance.export();
            saveToStorage(data);
          }
        } catch (error) {
          console.error('Error running migrations:', error);
        }
      } else {
        dbInstance = new SQL.Database();
        
        dbInstance.run(`
          -- Create parties table
          CREATE TABLE IF NOT EXISTS parties (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            credit_limit DECIMAL(12,2) DEFAULT 0,
            current_balance DECIMAL(12,2) DEFAULT 0,
            contact_person TEXT,
            phone TEXT,
            address TEXT,
            gst_number TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create transactions table
          CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            date DATE NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('sale', 'expense', 'bill')),
            amount DECIMAL(12,2) NOT NULL,
            payment_mode TEXT CHECK(payment_mode IN ('cash', 'digital', 'credit')),
            expense_category TEXT CHECK(
              expense_category IN (
                'goods_purchase', 'salary', 'advance', 'home', 'rent',
                'party_payment', 'petty', 'poly', 'food'
              )
            ),
            has_gst BOOLEAN DEFAULT 0,
            bill_number TEXT,
            return_amount DECIMAL(12,2),
            description TEXT,
            party_id TEXT REFERENCES parties(id),
            staff_id TEXT REFERENCES staff(id),
            running_balance DECIMAL(12,2),
            is_permanent BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create credit sales table
          CREATE TABLE IF NOT EXISTS credit_sales (
            id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            date DATE NOT NULL,
            paid_amount DECIMAL(12,2) DEFAULT 0,
            description TEXT,
            payment_frequency TEXT CHECK (payment_frequency IN ('daily', 'weekly', 'monthly')) DEFAULT 'weekly',
            next_payment_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            credit_increase_description TEXT
          );

          -- Create credit payments table
          CREATE TABLE IF NOT EXISTS credit_payments (
            id TEXT PRIMARY KEY,
            credit_sale_id TEXT NOT NULL REFERENCES credit_sales(id),
            amount DECIMAL(12,2) NOT NULL,
            date DATE NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create credit adjustments table
          CREATE TABLE IF NOT EXISTS credit_adjustments (
            id TEXT PRIMARY KEY,
            credit_sale_id TEXT NOT NULL REFERENCES credit_sales(id),
            adjustment_amount DECIMAL(12,2) NOT NULL,
            adjustment_date DATE NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create staff table
          CREATE TABLE IF NOT EXISTS staff (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            salary DECIMAL(10,2) NOT NULL,
            joining_date DATE NOT NULL,
            current_advance DECIMAL(10,2) DEFAULT 0,
            contact_number TEXT,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create staff holidays table
          CREATE TABLE IF NOT EXISTS staff_holidays (
            id TEXT PRIMARY KEY,
            staff_id TEXT NOT NULL REFERENCES staff(id),
            date DATE NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('weekly', 'festival', 'personal', 'sick')),
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(staff_id, date)
          );

          -- Create staff advances table
          CREATE TABLE IF NOT EXISTS staff_advances (
            id TEXT PRIMARY KEY,
            staff_id TEXT NOT NULL REFERENCES staff(id),
            amount DECIMAL(12,2) NOT NULL,
            date DATE NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create staff advance payments table
          CREATE TABLE IF NOT EXISTS staff_advance_payments (
            id TEXT PRIMARY KEY,
            advance_id TEXT NOT NULL REFERENCES staff_advances(id),
            amount DECIMAL(12,2) NOT NULL,
            date DATE NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create settings table
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create indexes
          CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
          CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
          CREATE INDEX IF NOT EXISTS idx_transactions_party_id ON transactions(party_id);
          CREATE INDEX IF NOT EXISTS idx_transactions_staff_id ON transactions(staff_id);
          CREATE INDEX IF NOT EXISTS idx_credit_sales_date ON credit_sales(date);
          CREATE INDEX IF NOT EXISTS idx_credit_payments_sale ON credit_payments(credit_sale_id);
          CREATE INDEX IF NOT EXISTS idx_staff_holidays_staff_id ON staff_holidays(staff_id);
          CREATE INDEX IF NOT EXISTS idx_staff_advances_staff_id ON staff_advances(staff_id);
          CREATE INDEX IF NOT EXISTS idx_credit_adjustments_credit_sale_id ON credit_adjustments(credit_sale_id);
        `);

        const data = dbInstance.export();
        saveToStorage(data);
      }

      resolve(dbInstance);
    } catch (error) {
      console.error('Error initializing database:', error);
      reject(error);
    } finally {
      initPromise = null;
    }
  });

  return initPromise;
};

// Save database after each operation
const saveDatabase = () => {
  if (dbInstance) {
    const data = dbInstance.export();
    saveToStorage(data);
  }
};

// Update existing opening balance transactions
const updateOpeningBalanceTransactions = () => {
  if (!dbInstance) return;
  
  try {
    // Debug: Check table structure
    console.log('Checking database state...');
    const tables = dbInstance.exec(`SELECT name FROM sqlite_master WHERE type='table'`);
    console.log('Tables:', tables);
    
    // Debug: Check transactions with opening balance
    const openingBalances = dbInstance.exec(`
      SELECT id, date, description, is_permanent 
      FROM transactions 
      WHERE description LIKE '%OPENING BALANCE%'
    `);
    console.log('Opening balance transactions:', openingBalances);

    // First check if any opening balance transactions exist that aren't marked permanent
    const result = dbInstance.exec(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE description LIKE '%OPENING BALANCE%' 
      AND (is_permanent IS NULL OR is_permanent = 0)
    `);

    if (result.length > 0 && result[0].values[0][0] > 0) {
      console.log('Found opening balance transactions to update');
      // Update the transactions
      dbInstance.run(`
        UPDATE transactions 
        SET is_permanent = 1 
        WHERE description LIKE '%OPENING BALANCE%'
      `);
      
      // Debug: Verify the update
      const afterUpdate = dbInstance.exec(`
        SELECT id, date, description, is_permanent 
        FROM transactions 
        WHERE description LIKE '%OPENING BALANCE%'
      `);
      console.log('After update:', afterUpdate);
      
      console.log('Updated existing opening balance transactions to be permanent');
      saveDatabase();
    } else {
      console.log('No opening balance transactions to update');
    }
  } catch (error) {
    console.error('Error updating opening balance transactions:', error);
  }
};

// Generate unique ID
export const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Database wrapper with common operations
const db = {
  init: async () => {
    const instance = await initDB();
    // Run the update after initialization
    updateOpeningBalanceTransactions();
    return instance;
  },
  save: saveDatabase,
  run: async (sql: string, params: any[] = []) => {
    const instance = await initDB();
    instance.run(sql, params);
    saveDatabase();
  },
  exec: async (sql: string, params: any[] = []) => {
    const instance = await initDB();
    return instance.exec(sql, params);
  },
  get instance() {
    return dbInstance;
  }
};

export default db;
