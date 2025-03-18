import { ParsedEntry } from '../types';
import { generateId } from '../../../lib/db';
import db from '../../../lib/db';

// Define all possible expense types
const STANDARD_EXPENSES = new Set([
  'Home', 'Rent', 'Petty', 'Food', 'Poly', 'GP', 'Repair', 
  'Labour', 'Transport'
]);

// Define valid expense categories that match the database schema
const EXPENSE_CATEGORIES = new Set([
  'goods_purchase', 'salary', 'advance', 'home', 'rent',
  'party_payment', 'petty', 'poly', 'food'
]);

// Cache for party names to avoid repeated DB queries
let partyNamesCache: Set<string> | null = null;

// Function to load party names from DB
const loadPartyNames = async (): Promise<Set<string>> => {
  if (partyNamesCache) return partyNamesCache;
  
  const dbInstance = await db.init();
  const result = await dbInstance.exec('SELECT name FROM parties');
  
  partyNamesCache = new Set(
    result[0]?.values.map((row: any[]) => row[0].toLowerCase()) || []
  );
  
  return partyNamesCache;
};

// Function to validate if a party exists
const validateParty = async (partyName: string): Promise<boolean> => {
  const partyNames = await loadPartyNames();
  return partyNames.has(partyName.toLowerCase());
};

// Function to clear party names cache
export const clearPartyNamesCache = () => {
  partyNamesCache = null;
};

// Define regex patterns for bill formats
const BILL_PATTERNS = {
  FULL: /^(.+?)\s*\((\d{1,2}\/\d{1,2}\/\d{2})\)\s*([A-Z0-9]+)\s+(\d+)(?:\s+GR\s+(\d+))?\s*(?:GST)?$/,
  WITH_DATE: /^(.+?)\s*\(date:\s*(\d{1,2}\/\d{1,2}\/\d{2})\)\s*(\d+)$/
};

export const parseEntries = async (text: string, selectedDate: string): Promise<(ParsedEntry | { error: string, line: string })[]> => {
  const lines = text.split('\n').filter(line => line.trim());
  const entries: (ParsedEntry | { error: string, line: string })[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    try {
      // First try to match bill patterns
      const fullBillMatch = trimmedLine.match(BILL_PATTERNS.FULL);
      const simpleBillMatch = trimmedLine.match(BILL_PATTERNS.WITH_DATE);

      if (fullBillMatch || simpleBillMatch) {
        let partyName: string, date: string, billNumber: string | undefined, amount: string, grAmount: string | undefined;
        
        if (fullBillMatch) {
          // Full bill format: "Santosh Tops (25/1/25) SV2029 73173 GR 302 GST"
          [, partyName, date, billNumber, amount, grAmount] = fullBillMatch;
        } else if (simpleBillMatch) {
          // Simple bill format: "Santosh Tops (date: 13/12/24) 33201"
          [, partyName, date, amount] = simpleBillMatch;
          billNumber = undefined;
        } else {
          throw new Error('Invalid bill format');
        }

        // Check if party exists but don't throw error
        const isValidParty = await validateParty(partyName.trim());
        const parsedAmount = parseFloat(amount);
        
        if (isNaN(parsedAmount)) {
          throw new Error(`Invalid amount in bill: ${amount}`);
        }

        entries.push({
          type: 'bill',
          data: {
            id: generateId(),
            date: formatDate(date),
            amount: parsedAmount,
            party_name: partyName.trim(),
            billNumber,
            hasGST: trimmedLine.toUpperCase().includes('GST'),
            grAmount: grAmount ? parseFloat(grAmount) : undefined,
            payment_mode: 'pending',
            isValidParty
          }
        });
        continue;
      }

      // If not a bill, proceed with existing parsing logic
      let entryDate = selectedDate;
      let lineWithoutDate = trimmedLine;
      
      // Handle date formats
      const datePatterns = [
        /\(date:\s*(\d{1,2}\/\d{1,2}\/\d{2})\)/,  // (date: DD/MM/YY)
        /\((\d{1,2}\/\d{1,2}\/\d{2})\)/           // (DD/MM/YY)
      ];

      for (const pattern of datePatterns) {
        const dateMatch = trimmedLine.match(pattern);
        if (dateMatch) {
          try {
            entryDate = formatDate(dateMatch[1]);
            lineWithoutDate = trimmedLine.replace(pattern, '').trim();
            break;
          } catch (error) {
            console.error('Date parsing error:', error);
          }
        }
      }

      let entry: ParsedEntry | null = null;
      const parts = lineWithoutDate.split(/\s+/);
      const firstWord = parts[0];

      // Handle different entry types
      if (/^\d+\.$/.test(firstWord)) {
        // Sales entries (1. 23500, 7. 21506 net, 20. 9300 (Maa))
        entry = await parseSaleEntry(parts, entryDate);
      } else if (parts.length > 2 && (parts[1].toLowerCase() === 'sal' || parts[1].toLowerCase() === 'adv')) {
        // Staff expenses (Alok Sal 30493)
        entry = await parseStaffExpenseEntry(parts, entryDate);
      } else if (parts.length >= 3 && parts[2].toLowerCase() === 'party') {
        // Party payments (PBK 20000 Party GST)
        entry = await parsePartyPaymentEntry(parts, entryDate, lineWithoutDate);
      } else if (parts.length >= 2) {
        if (STANDARD_EXPENSES.has(firstWord)) {
          // Standard expenses (Home 23988, GP 94100 GST)
          entry = await parseExpenseEntry(parts, entryDate, lineWithoutDate);
        } else {
          // Check for bill pattern or random word
          const hasAmount = parts.some(part => !isNaN(parseFloat(part)));
          if (hasAmount) {
            // Try to parse as bill or random expense
            entry = await parseRandomEntry(parts, entryDate, lineWithoutDate);
          } else {
            entries.push({ error: 'Invalid format - no amount found', line: trimmedLine });
            continue;
          }
        }
      }

      if (entry) {
        entries.push(entry);
      } else {
        entries.push({ error: 'Unrecognized entry format', line: trimmedLine });
      }
    } catch (error) {
      console.error(`Error parsing line: ${trimmedLine}`, error);
      entries.push({ error: error instanceof Error ? error.message : 'Error parsing entry', line: trimmedLine });
    }
  }

  return entries;
};

const formatDate = (date: string): string => {
  try {
    const cleanDate = date.trim();
    const [day, month, year] = cleanDate.split('/').map(part => {
      const num = parseInt(part.trim(), 10);
      if (isNaN(num)) throw new Error(`Invalid date part: ${part}`);
      return num;
    });

    // Validate date parts
    if (!day || !month || !year) throw new Error('Missing date parts');
    if (day < 1 || day > 31) throw new Error('Invalid day');
    if (month < 1 || month > 12) throw new Error('Invalid month');
    if (year < 0 || year > 99) throw new Error('Invalid year');

    // Format with padding
    return `20${year.toString().padStart(2, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  } catch (error) {
    throw new Error(`Invalid date format - use DD/MM/YY: ${error.message}`);
  }
};

const parseSaleEntry = async (parts: string[], entryDate: string): Promise<ParsedEntry> => {
  // Check if we have a valid sale entry
  if (parts.length < 2 || !parts[1]) {
    throw new Error(`Invalid sale entry format: ${parts.join(' ')}`);
  }
  
  const amount = parseFloat(parts[1]);
  if (isNaN(amount)) {
    throw new Error(`Invalid amount in sale entry: ${parts[1]}`);
  }

  let payment_mode: 'cash' | 'digital' | 'credit' = 'cash';
  let party_name = null;

  if (parts.length > 2) {
    const typeIndicator = parts[2].toLowerCase();
    if (typeIndicator === 'net') {
      payment_mode = 'digital';
      party_name = parts.slice(3).join(' ').trim() || null;
    } else {
      payment_mode = 'credit';
      party_name = parts.slice(2).join(' ').replace(/^\(|\)$/g, '').trim() || null;
      
      // Validate party if credit sale
      if (party_name && !(await validateParty(party_name))) {
        throw new Error(`Unknown party: ${party_name}`);
      }
    }
  }

  return {
    type: 'sale',
    data: {
      id: generateId(),
      date: entryDate,
      amount,
      payment_mode,
      party_name,
      staff_name: null,
      description: null,
      billNumber: null,
      hasGST: false
    }
  };
};

const parseRandomEntry = async (parts: string[], entryDate: string, line: string): Promise<ParsedEntry> => {
  // Find the amount in the parts
  const amountIndex = parts.findIndex(part => !isNaN(parseFloat(part)));
  if (amountIndex === -1) {
    throw new Error(`No valid amount found in entry: ${line}`);
  }
  
  const amount = parseFloat(parts[amountIndex]);
  // Take all words before the amount as potential party name
  const potentialPartyName = parts.slice(0, amountIndex).join(' ');
  const hasGST = line.toUpperCase().includes('GST');
  
  // Check if this might be a party payment
  const isParty = await validateParty(potentialPartyName);
  
  if (isParty) {
    // This is a party payment
    return {
      type: 'payment',
      data: {
        id: generateId(),
        date: entryDate,
        amount,
        party_name: potentialPartyName,
        hasGST,
        description: undefined,
        staff_name: undefined,
        billNumber: undefined,
        payment_mode: undefined,
        expense_category: 'party_payment'
      }
    };
  } else {
    // This is a random expense
    return {
      type: 'expense',
      data: {
        id: generateId(),
        date: entryDate,
        amount,
        description: potentialPartyName,
        hasGST,
        staff_name: undefined,
        billNumber: undefined,
        party_name: undefined,
        payment_mode: undefined,
        expense_category: 'petty'
      }
    };
  }
};

const parseBillEntry = async (parts: string[], entryDate: string, line: string): Promise<ParsedEntry> => {
  if (parts.length < 2) {
    throw new Error(`Invalid bill entry format: ${line}`);
  }

  const party_name = parts[0].trim();
  
  // Validate party name
  if (!(await validateParty(party_name))) {
    throw new Error(`Unknown party in bill entry: ${party_name}`);
  }

  const entry: ParsedEntry = {
    type: 'bill',
    data: {
      id: generateId(),
      date: entryDate,
      party_name,
      amount: 0,
      billNumber: null,
      description: null,
      hasGST: line.toUpperCase().includes('GST'),
      staff_name: null,
      payment_mode: null,
      expense_category: null
    }
  };

  // Find amount (first numeric part without /)
  let amountIndex = -1;
  for (let i = 1; i < parts.length; i++) {
    if (!parts[i].includes('/') && !isNaN(parseFloat(parts[i]))) {
      amountIndex = i;
      entry.data.amount = parseFloat(parts[i]);
      break;
    }
  }

  if (amountIndex === -1) throw new Error('Invalid amount in bill entry');

  // Extract bill number (between party name and amount)
  if (amountIndex > 1) {
    entry.data.billNumber = parts.slice(1, amountIndex).join(' ')
      .replace(/[()]/g, '')  // Remove any parentheses
      .trim();
  }

  // Process remaining parts after amount
  if (amountIndex < parts.length - 1) {
    const remainingParts = parts.slice(amountIndex + 1);

    // Check for GR number
    const grIndex = remainingParts.findIndex(p => p.toUpperCase() === 'GR');
    if (grIndex !== -1 && grIndex + 1 < remainingParts.length) {
      entry.data.description = `GR ${remainingParts[grIndex + 1]}`;
    }
  }

  return entry;
};

const parseExpenseEntry = async (parts: string[], entryDate: string, line: string): Promise<ParsedEntry> => {
  if (parts.length < 2) {
    throw new Error(`Invalid expense entry format: ${line}`);
  }
    
  const amount = parseFloat(parts[1]);
  if (isNaN(amount)) {
    throw new Error(`Invalid amount in expense entry: ${parts[1]}`);
  }
    
  const description = parts[0].toLowerCase();
  const hasGST = line.toUpperCase().includes('GST');

  // Map expense type to valid expense category
  let expense_category: string;
  switch (description) {
    case 'gp': expense_category = 'goods_purchase'; break;
    case 'home': expense_category = 'home'; break;
    case 'rent': expense_category = 'rent'; break;
    case 'petty': expense_category = 'petty'; break;
    case 'poly': expense_category = 'poly'; break;
    case 'food': expense_category = 'food'; break;
    default: expense_category = 'petty';
  }
  
  return {
    type: 'expense',
    data: {
      id: generateId(),
      date: entryDate,
      amount,
      description,
      hasGST,
      staff_name: null,
      billNumber: null,
      party_name: null,
      payment_mode: null,
      expense_category
    }
  };
};

const parseStaffExpenseEntry = async (parts: string[], entryDate: string): Promise<ParsedEntry> => {
  if (parts.length < 3) {
    throw new Error(`Invalid staff expense format: ${parts.join(' ')}`);
  }

  const staff_name = parts[0];
  const type = parts[1].toLowerCase();
  const amount = parseFloat(parts[2]);
  
  if (isNaN(amount)) {
    throw new Error(`Invalid amount in staff expense: ${parts[2]}`);
  }

  return {
    type: 'expense',
    data: {
      id: generateId(),
      date: entryDate,
      amount,
      description: `${staff_name} ${type}`,
      hasGST: false,
      staff_name,
      billNumber: null,
      party_name: null,
      payment_mode: null,
      expense_category: 'salary'
    }
  };
};

const parsePartyPaymentEntry = async (parts: string[], entryDate: string, line: string): Promise<ParsedEntry> => {
  if (parts.length < 3) {
    throw new Error(`Invalid party payment format: ${line}`);
  }

  const party_name = parts[0].trim();
  const amount = parseFloat(parts[1]);
  const hasGST = line.toUpperCase().includes('GST');
  
  // Validate party name
  if (!(await validateParty(party_name))) {
    throw new Error(`Unknown party in party payment: ${party_name}`);
  }

  return {
    type: 'payment',
    data: {
      id: generateId(),
      date: entryDate,
      amount,
      party_name,
      hasGST,
      description: null,
      staff_name: null,
      billNumber: null,
      payment_mode: null,
      expense_category: 'party_payment'
    }
  };
};
