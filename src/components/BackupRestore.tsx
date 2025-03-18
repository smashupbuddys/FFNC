import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Loader, HardDrive, Settings, FileText, RefreshCw, Check } from 'lucide-react';
import { exportDatabase, importDatabase, type BackupData } from '../lib/db/backup';
import { saveToFile, loadFromFile } from '../lib/db';
import { generatePDF } from '../utils/pdfGenerator';
import { forceExport } from '../lib/db/autoSync';
import initSqlJs from 'sql.js';
import db from '../lib/db';

const BackupRestore = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dbFileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateLastSync = () => setLastSync(new Date());
    window.addEventListener('db-exported', updateLastSync);
    return () => window.removeEventListener('db-exported', updateLastSync);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (syncStatus === 'success') {
      const timer = setTimeout(() => setSyncStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [syncStatus]);

  const handleForceSync = async () => {
    try {
      setSyncStatus('syncing');
      setSyncMessage('Syncing data...');
      await forceExport();
      
      setLastSync(new Date());
      setSyncStatus('success');
      setSyncMessage('Backup saved successfully');
    } catch (error) {
      console.error('Force sync failed:', error);
      setSyncStatus('error');
      setSyncMessage('Error syncing data');
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const data = await exportDatabase();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `finance-backup-${timestamp}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    } finally {
      setIsExporting(false);
      setShowDropdown(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.jpg')) {
      alert('Invalid file format. Please upload a .jpg backup file.');
      return;
    }

    try {
      setIsImporting(true);

      const text = await file.text();
      const data = JSON.parse(text) as BackupData;

      if (!data.version || !data.timestamp || !data.tables) {
        throw new Error('Invalid backup file format');
      }

      const confirmed = window.confirm(
        'This will replace all existing data with the backup data. Are you sure you want to continue?'
      );
      
      if (!confirmed) return;

      await importDatabase(data);

      alert('Data imported successfully! Please refresh the page.');
      window.location.reload();
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Error importing data. Please check the file format and try again.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setShowDropdown(false);
    }
  };

  const handleExportToFile = async () => {
    try {
      setIsExporting(true);
      const blob = await saveToFile();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      a.download = `finance-db-${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting database file:', error);
      alert('Error exporting database file. Please try again.');
    } finally {
      setIsExporting(false);
      setShowDropdown(false);
    }
  };

  const handleImportFromFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.png')) {
      alert('Invalid file format. Please upload a .png database file.');
      return;
    }

    try {
      setIsImporting(true);

      const confirmed = window.confirm(
        'This will replace all existing data with the database file. Are you sure you want to continue?'
      );
      
      if (!confirmed) return;

      // Create a new FileReader
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          if (!e.target?.result) {
            throw new Error('Failed to read file');
          }
          
          // Convert FileReader result to Uint8Array
          const buffer = e.target.result as ArrayBuffer;
          const uint8Array = new Uint8Array(buffer);
          
          // Initialize SQL.js
          const SQL = await initSqlJs({
            locateFile: file => `https://sql.js.org/dist/${file}`
          });
          
          // Create new database instance
          const newDb = new SQL.Database(uint8Array);
          
          // Validate database structure
          try {
            newDb.exec('SELECT 1 FROM parties LIMIT 1');
            newDb.exec('SELECT 1 FROM transactions LIMIT 1');
            
            // If validation passes, update the database
            if (db.instance) {
              db.instance.close();
            }
            
            // Save to localStorage
            const exportedData = newDb.export();
            const arr = Array.from(exportedData);
            localStorage.setItem('finance_db_data', JSON.stringify(arr));
            
            alert('Database imported successfully! Please refresh the page.');
            window.location.reload();
          } catch (error) {
            throw new Error('Invalid database structure');
          }
        } catch (error) {
          console.error('Error processing database file:', error);
          alert('Error processing database file. Please check the file and try again.');
        }
      };

      reader.onerror = () => {
        throw new Error('Failed to read file');
      };

      // Read the file as ArrayBuffer
      reader.readAsArrayBuffer(file);
      
    } catch (error) {
      console.error('Error importing database file:', error);
      alert('Error importing database file. Please check the file and try again.');
    } finally {
      setIsImporting(false);
      if (dbFileInputRef.current) {
        dbFileInputRef.current.value = '';
      }
      setShowDropdown(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setIsGeneratingPDF(true);
      await generatePDF();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
      setShowDropdown(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors duration-200"
        >
          <Settings className="w-4 h-4 mr-2 text-blue-600" />
          <span className="hidden sm:inline">Data</span>
        </button>

        <button
          onClick={handleForceSync}
          disabled={syncStatus === 'syncing'}
          className={`
            inline-flex items-center px-3 py-1.5 border text-sm font-medium rounded-md
            transition-colors duration-200
            ${syncStatus === 'syncing' 
              ? 'border-gray-300 text-gray-400 cursor-not-allowed'
              : syncStatus === 'success'
              ? 'border-green-300 text-green-700 bg-green-50'
              : syncStatus === 'error'
              ? 'border-red-300 text-red-700 bg-red-50'
              : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
            }
          `}
        >
          {syncStatus === 'syncing' ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin text-gray-400" />
          ) : syncStatus === 'success' ? (
            <Check className="w-4 h-4 mr-2 text-green-600" />
          ) : syncStatus === 'error' ? (
            <RefreshCw className="w-4 h-4 mr-2 text-red-600" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2 text-blue-600" />
          )}
          <span className="hidden sm:inline">
            {syncStatus === 'syncing' ? 'Syncing...' : 'Force Sync'}
          </span>
        </button>

        {(lastSync || syncMessage) && (
          <span className={`text-xs ${
            syncStatus === 'error' ? 'text-red-500' :
            syncStatus === 'success' ? 'text-green-500' :
            'text-gray-500'
          }`}>
            {syncMessage || `Last sync: ${lastSync?.toLocaleTimeString()}`}
          </span>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-2 right-0 bg-white border border-gray-200 rounded-md shadow-lg p-1 w-56 z-50">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex w-full items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            {isExporting ? (
              <Loader className="w-4 h-4 mr-2 animate-spin text-blue-600" />
            ) : (
              <Download className="w-4 h-4 mr-2 text-blue-600" />
            )}
            Backup Data
          </button>

          <label className="flex w-full items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer">
            {isImporting ? (
              <Loader className="w-4 h-4 mr-2 animate-spin text-blue-600" />
            ) : (
              <Upload className="w-4 h-4 mr-2 text-blue-600" />
            )}
            Restore Data
            <input
              type="file"
              accept=".jpg"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
              ref={fileInputRef}
            />
          </label>

          <hr className="my-1 border-gray-200" />

          <button
            onClick={handleExportToFile}
            disabled={isExporting}
            className="flex w-full items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            {isExporting ? (
              <Loader className="w-4 h-4 mr-2 animate-spin text-blue-600" />
            ) : (
              <HardDrive className="w-4 h-4 mr-2 text-blue-600" />
            )}
            Backup DB File
          </button>

          <label className="flex w-full items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md cursor-pointer">
            {isImporting ? (
              <Loader className="w-4 h-4 mr-2 animate-spin text-blue-600" />
            ) : (
              <HardDrive className="w-4 h-4 mr-2 text-blue-600" />
            )}
            Restore DB File
            <input
              type="file"
              accept=".png"
              onChange={handleImportFromFile}
              disabled={isImporting}
              className="hidden"
              ref={dbFileInputRef}
            />
          </label>

          <hr className="my-1 border-gray-200" />

          <button
            onClick={handleExportPDF}
            disabled={isGeneratingPDF}
            className="flex w-full items-center px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            {isGeneratingPDF ? (
              <Loader className="w-4 h-4 mr-2 animate-spin text-blue-600" />
            ) : (
              <FileText className="w-4 h-4 mr-2 text-blue-600" />
            )}
            Export Report
          </button>
        </div>
      )}
    </div>
  );
};

export default BackupRestore;
