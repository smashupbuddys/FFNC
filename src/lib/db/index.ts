import initSqlJs from 'sql.js';
import { markChanges } from './autoSync';

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
    console.error('Error parsing stored database:', error);
    return null;
  }
};

// Save database to localStorage
const saveToStorage = (data: Uint8Array) => {
  try {
    const arr = Array.from(data);
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(arr));
    markChanges(); // Mark that changes have occurred
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
  if (!file.name.endsWith('.png')) {
    throw new Error('Invalid file type. Please upload a .png file');
  }

  try {
    const SQL = await initSqlJs({
      locateFile: file => `https://sql.js.org/dist/${file}`
    });

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);
    
    // Create new database instance from file
    const newDb = new SQL.Database(data);
    
    // Validate database structure by checking required tables
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

    // Replace existing database
    if (dbInstance) {
      dbInstance.close();
    }
    dbInstance = newDb;

    // Save to localStorage
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
    try {
      const SQL = await initSqlJs({
        locateFile: file => `https://sql.js.org/dist/${file}`
      });

      // Try to load existing database
      const existingData = loadFromStorage();
      if (existingData) {
        dbInstance = new SQL.Database(existingData);
      } else {
        // Create new database
        dbInstance = new SQL.Database();
        
        // Initialize schema
        dbInstance.run(`
          -- Create tables and indexes
          -- ... (rest of schema initialization)
          
          -- Create budget_categories table
          CREATE TABLE IF NOT EXISTS budget_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            monthly_limit DECIMAL(12,2),
            color TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create investment_tracking table
          CREATE TABLE IF NOT EXISTS investment_tracking (
            id TEXT PRIMARY KEY,
            type TEXT CHECK(type IN ('stocks', 'mutual_funds', 'fixed_deposit', 'real_estate', 'other')),
            amount DECIMAL(12,2) NOT NULL,
            purchase_date DATE NOT NULL,
            expected_return_rate DECIMAL(5,2),
            maturity_date DATE,
            current_value DECIMAL(12,2),
            last_updated DATETIME,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create tax_planning table
          CREATE TABLE IF NOT EXISTS tax_planning (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            fiscal_year TEXT NOT NULL,
            date DATE NOT NULL,
            section TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create recurring_transactions table
          CREATE TABLE IF NOT EXISTS recurring_transactions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            frequency TEXT CHECK(frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
            type TEXT CHECK(type IN ('income', 'expense')),
            category_id TEXT REFERENCES budget_categories(id),
            next_date DATE NOT NULL,
            end_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create financial_ratios table
          CREATE TABLE IF NOT EXISTS financial_ratios (
            id TEXT PRIMARY KEY,
            date DATE NOT NULL,
            current_ratio DECIMAL(8,4),
            quick_ratio DECIMAL(8,4),
            debt_to_equity DECIMAL(8,4),
            inventory_turnover DECIMAL(8,4),
            gross_margin DECIMAL(8,4),
            net_margin DECIMAL(8,4),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          -- Create indexes for new tables
          CREATE INDEX IF NOT EXISTS idx_budget_categories_name ON budget_categories(name);
          CREATE INDEX IF NOT EXISTS idx_investment_tracking_type ON investment_tracking(type);
          CREATE INDEX IF NOT EXISTS idx_tax_planning_fiscal_year ON tax_planning(fiscal_year);
          CREATE INDEX IF NOT EXISTS idx_recurring_transactions_next_date ON recurring_transactions(next_date);
          CREATE INDEX IF NOT EXISTS idx_financial_ratios_date ON financial_ratios(date);
        `);

        // Save the new database
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

// Generate unique ID
export const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Database wrapper with common operations
const db = {
  init: initDB,
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
