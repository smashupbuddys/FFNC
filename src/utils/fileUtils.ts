/**
 * Parses CSV text into data and columns
 */
export const parseCSV = (csvText: string): { data: Record<string, string>[]; columns: string[] } => {
  // Basic CSV parser, assumes first line is header
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return { data: [], columns: [] };
  }
  
  // Parse header
  const header = lines[0].split(',').map(h => h.trim());
  
  // Parse data
  const data = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    
    // Create object with headers as keys
    const row: Record<string, string> = {};
    header.forEach((columnName, index) => {
      row[columnName] = values[index] || '';
    });
    
    return row;
  });
  
  return { data, columns: header };
};

/**
 * Extracts text from a PDF file
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        // In a real application, you would use a PDF parsing library here
        // For now, we'll just return a message indicating this needs to be implemented
        reject(new Error('PDF text extraction not implemented. Please install and use a PDF parsing library.'));
      } catch (error) {
        reject(new Error('Failed to extract text from PDF. Please check the file format.'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading the PDF file.'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parses PDF text into data and columns
 */
export const parsePDFText = (text: string): { data: Record<string, string>[]; columns: string[] } => {
  // This is a placeholder for PDF text parsing
  // In a real application, you would implement a more sophisticated parser
  
  // Simple table detection - assume lines with multiple whitespace-separated words are table rows
  const lines = text.split(/\r?\n/).filter(line => {
    const words = line.trim().split(/\s+/);
    return words.length > 3; // Assume table rows have at least 4 columns
  });
  
  if (lines.length < 2) {
    return { data: [], columns: [] };
  }
  
  // Assume first line is header
  const header = lines[0].split(/\s+/).map(col => col.trim());
  
  // Parse data rows
  const data = lines.slice(1).map(line => {
    const values = line.split(/\s+/).map(v => v.trim());
    
    // Create object with headers as keys
    const row: Record<string, string> = {};
    header.forEach((columnName, index) => {
      if (index < values.length) {
        row[columnName] = values[index];
      } else {
        row[columnName] = '';
      }
    });
    
    return row;
  });
  
  return { data, columns: header };
};

/**
 * Generates a unique ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};
