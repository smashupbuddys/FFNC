import { exportDatabase } from './backup';
import { saveToFile } from '../db';
import { debounce } from 'lodash';

// Keep track of pending changes
let hasChanges = false;

// Debounced export function to prevent too frequent exports
const debouncedExport = debounce(async () => {
  if (!hasChanges) return;
  
  try {
    await performExport();
    hasChanges = false;
  } catch (error) {
    console.error('Auto-export failed:', error);
  }
}, 5000); // Wait 5 seconds after last change before exporting

// Separate export logic for reuse
const performExport = async () => {
  try {
    // Export to JSON backup
    const data = await exportDatabase();
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    localStorage.setItem('finance-backup', await jsonBlob.text());

    // Export to DB backup
    const dbBlob = await saveToFile();
    localStorage.setItem('finance-db-backup', await dbBlob.text());

    // Dispatch event to notify of successful export
    window.dispatchEvent(new Event('db-exported'));
    
    return true;
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
};

// Function to mark that changes have occurred
export const markChanges = () => {
  hasChanges = true;
  debouncedExport();
};

// Function to force immediate export
export const forceExport = async () => {
  try {
    debouncedExport.cancel(); // Cancel any pending debounced exports
    await performExport();
    hasChanges = false;
    return true;
  } catch (error) {
    console.error('Force export failed:', error);
    throw error;
  }
};
