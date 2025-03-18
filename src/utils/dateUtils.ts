import { ExcelImportConfig } from '../types/sales';

/**
 * Formats a date according to the specified format
 */
export const formatDate = (date: Date, formatString: string): string => {
  const pad = (n: number): string => n.toString().padStart(2, '0');
  
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  
  return formatString
    .replace('yyyy', yyyy.toString())
    .replace('YYYY', yyyy.toString())
    .replace('MM', MM)
    .replace('dd', dd)
    .replace('DD', dd);
};

/**
 * Gets the ordinal suffix for a day number (e.g., "st", "nd", "rd", "th")
 */
export const getOrdinalSuffix = (day: number): string => {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

/**
 * Formats a date string with ordinal suffix (e.g., "21st February 2023")
 */
export const formatDateWithOrdinal = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${day}${getOrdinalSuffix(day)} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

/**
 * Parses a date string according to the specified format
 */
export const parseDateWithFormat = (dateStr: string, format: ExcelImportConfig['dateFormat']): Date | null => {
  try {
    // Clean the input string
    const cleanDateStr = dateStr.trim();
    
    // Extract date components
    let day: number = 0;
    let month: number = 0;
    let year: number = 0;
    
    // Parse based on format
    switch (format) {
      case 'DD/MM/YYYY': {
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('/');
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          year = parseInt(parts[2], 10);
        }
        break;
      }
      case 'DD/MM/YY': {
        if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('/');
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          let yearPrefix = new Date().getFullYear().toString().substring(0, 2);
          year = parseInt(yearPrefix + parts[2], 10);
        }
        break;
      }
      case 'MM/DD/YYYY': {
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('/');
          month = parseInt(parts[0], 10) - 1;
          day = parseInt(parts[1], 10);
          year = parseInt(parts[2], 10);
        }
        break;
      }
      case 'MM/DD/YY': {
        if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('/');
          month = parseInt(parts[0], 10) - 1;
          day = parseInt(parts[1], 10);
          let yearPrefix = new Date().getFullYear().toString().substring(0, 2);
          year = parseInt(yearPrefix + parts[2], 10);
        }
        break;
      }
      case 'YYYY-MM-DD': {
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('-');
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        }
        break;
      }
      case 'DD-MMM-YYYY': {
        // Check if it's text month format (01-Feb-2025)
        if (/^\d{1,2}[-]\w{3}[-]\d{4}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('-');
          day = parseInt(parts[0], 10);
          
          const monthMap: Record<string, number> = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
          };
          
          const monthStr = parts[1].toLowerCase().substring(0, 3);
          month = monthMap[monthStr];
          if (month === undefined) return null;
          
          year = parseInt(parts[2], 10);
        }
        break;
      }
      case 'auto': {
        // Try DD/MM/YYYY
        if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('/');
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          year = parseInt(parts[2], 10);
        }
        // Try DD/MM/YY
        else if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('/');
          day = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          let yearPrefix = new Date().getFullYear().toString().substring(0, 2);
          year = parseInt(yearPrefix + parts[2], 10);
        }
        // Try YYYY-MM-DD
        else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('-');
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        }
        // Check if it's text month format (01-Feb-2025)
        else if (/^\d{1,2}[-]\w{3}[-]\d{4}$/.test(cleanDateStr)) {
          const parts = cleanDateStr.split('-');
          day = parseInt(parts[0], 10);
          
          const monthMap: Record<string, number> = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
          };
          
          const monthStr = parts[1].toLowerCase().substring(0, 3);
          month = monthMap[monthStr];
          if (month === undefined) return null;
          
          year = parseInt(parts[2], 10);
        }
        else {
          // Try standard Date parsing as last resort
          const date = new Date(cleanDateStr);
          if (!isNaN(date.getTime())) {
            return date;
          }
          return null;
        }
        break;
      }
    }
    
    // Validate date components
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31) return null;
    if (month < 0 || month > 11) return null;
    if (year < 1900 || year > 2100) return null;
    
    return new Date(year, month, day);
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};
