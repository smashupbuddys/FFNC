import { Sale, BulkSaleEntry, SalesAnalysis, DateRange } from '../types/sales';
import { formatDateWithOrdinal } from './dateUtils';

/**
 * Calculates payment mode statistics for a given set of sales
 */
export const calculateSalesAnalysis = (sales: Sale[]): SalesAnalysis => {
  const initialStats = {
    cash: { count: 0, total: 0 },
    digital: { count: 0, total: 0 },
    credit: { count: 0, total: 0 }
  };

  return sales.reduce((stats, sale) => {
    const mode = sale.payment_mode;
    return {
      ...stats,
      [mode]: {
        count: stats[mode].count + 1,
        total: stats[mode].total + sale.amount
      }
    };
  }, initialStats);
};

/**
 * Groups sales by date for summary display
 */
export const groupSalesByDate = (sales: Sale[]): Record<string, Sale[]> => {
  return sales.reduce((acc, sale) => {
    // Get date without time component
    const dateKey = sale.date.split('T')[0];
    
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    
    acc[dateKey].push(sale);
    return acc;
  }, {} as Record<string, Sale[]>);
};

/**
 * Formats a series of sales as a CSV string
 */
export const formatSalesAsCsv = (sales: Sale[]): string => {
  // Define the CSV header
  const header = ['Date', 'Amount', 'Payment Mode', 'Party Name'].join(',');
  
  // Generate the CSV rows
  const rows = sales.map(sale => {
    return [
      formatDateWithOrdinal(sale.date),
      sale.amount.toFixed(2),
      sale.payment_mode,
      sale.party_name || ''
    ].join(',');
  });
  
  // Combine header and rows
  return [header, ...rows].join('\n');
};

/**
 * Filter sales based on various criteria
 */
export const filterSales = (
  sales: Sale[], 
  searchTerm: string = '',
  dateRange: DateRange = { from: null, to: null },
  paymentModes: ('cash' | 'digital' | 'credit')[] = []
): Sale[] => {
  let filteredSales = [...sales];
  
  // Filter by search term
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredSales = filteredSales.filter(sale => 
      (sale.party_name && sale.party_name.toLowerCase().includes(term)) ||
      sale.amount.toString().includes(term) ||
      sale.date.includes(term) ||
      sale.payment_mode.includes(term)
    );
  }
  
  // Filter by date range
  if (dateRange.from) {
    filteredSales = filteredSales.filter(sale => {
      const saleDate = new Date(sale.date);
      const fromDate = new Date(dateRange.from as string);
      return saleDate >= fromDate;
    });
  }
  
  if (dateRange.to) {
    filteredSales = filteredSales.filter(sale => {
      const saleDate = new Date(sale.date);
      const toDate = new Date(dateRange.to as string);
      // Set time to end of day
      toDate.setHours(23, 59, 59, 999);
      return saleDate <= toDate;
    });
  }
  
  // Filter by payment modes
  if (paymentModes.length > 0) {
    filteredSales = filteredSales.filter(sale => 
      paymentModes.includes(sale.payment_mode)
    );
  }
  
  return filteredSales;
};

/**
 * Sort sales based on field and direction
 */
export const sortSales = (
  sales: Sale[],
  key: keyof Sale | null,
  direction: 'ascending' | 'descending'
): Sale[] => {
  if (!key) return sales;
  
  return [...sales].sort((a, b) => {
    // Extract values, handling possible undefined
    let valueA: any = a[key];
    let valueB: any = b[key];
    
    // Handle date strings
    if (key === 'date') {
      valueA = new Date(valueA as string).getTime();
      valueB = new Date(valueB as string).getTime();
    }
    
    // Handle string comparisons
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }
    
    // For undefined party_name, use empty string
    if (key === 'party_name') {
      valueA = valueA || '';
      valueB = valueB || '';
    }
    
    if (valueA < valueB) {
      return direction === 'ascending' ? -1 : 1;
    }
    if (valueA > valueB) {
      return direction === 'ascending' ? 1 : -1;
    }
    return 0;
  });
};

/**
 * Convert BulkSaleEntry to Sale objects
 */
export const convertBulkEntriesToSales = (
  entries: BulkSaleEntry[],
  generateIdFn: () => string
): Sale[] => {
  return entries.map(entry => ({
    id: generateIdFn(),
    date: entry.date,
    amount: parseFloat(entry.amount),
    payment_mode: entry.payment_mode,
    party_name: entry.payment_mode === 'credit' ? entry.party_name : undefined,
    created_at: new Date().toISOString()
  }));
};

/**
 * Paginate an array of sales
 */
export const paginateSales = (
  sales: Sale[],
  page: number,
  pageSize: number
): Sale[] => {
  const startIndex = (page - 1) * pageSize;
  return sales.slice(startIndex, startIndex + pageSize);
};
