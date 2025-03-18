export interface Sale {
  id: string;
  date: string;
  amount: number;
  payment_mode: 'cash' | 'digital' | 'credit';
  party_name?: string;
  created_at: string;
}

export interface Creditor {
  id: string;
  name: string;
  total_credit: number;
  total_paid: number;
  remaining_balance: number;
  last_transaction_date: string;
}

export interface Transaction {
  id: string;
  date: string;
  type: 'sale' | 'payment';
  amount: number;
  description?: string;
  created_at: string;
}

export interface BulkSaleEntry {
  id: string;
  amount: string;
  payment_mode: 'cash' | 'digital' | 'credit';
  party_name: string;
  date: string;
  isCombined?: boolean;
  originalCount?: number;
}

export interface AmountGroup {
  amount: number;
  entries: Sale[];
}

export interface ExcelImportConfig {
  dateColumn: string;
  amountColumn: string;
  paymentModeColumn: string | null;
  partyNameColumn: string | null;
  defaultPaymentMode: 'cash' | 'digital' | 'credit';
  defaultPartyName: string;
  useDefaultsWhenMissing: boolean;
  dateFormat: 'DD-MMM-YYYY' | 'DD/MM/YY' | 'DD/MM/YYYY' | 'MM/DD/YY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'auto';
  dateFilter: {
    enabled: boolean;
    startDate: string;
    endDate: string;
  };
}

export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface PaymentModeStats {
  count: number;
  total: number;
}

export interface SalesAnalysis {
  cash: PaymentModeStats;
  digital: PaymentModeStats;
  credit: PaymentModeStats;
}

export interface ImportPreview {
  valid: BulkSaleEntry[];
  invalid: Array<{row: any, reason: string}>;
  dateSummary: Array<{
    date: string;
    totalAmount: number;
    entriesCount: number;
    paymentModes: {
      cash: number;
      digital: number;
      credit: number;
    };
  }>;
  duplicates?: {
    groupCount: number;
    entryCount: number;
    mergedGroupCount: number;
  };
  processedCount?: number;
}
