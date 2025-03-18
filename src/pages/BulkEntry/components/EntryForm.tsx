import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import { EntryFormProps } from '../types';
import db from '../../../lib/db';

interface EntryFormProps {
  entries: string;
  selectedDate: string;
  onEntriesChange: (value: string) => void;
  onDateChange: (date: string) => void;
  isProcessing: boolean;
  mode: 'basic' | 'advanced';
  activeSection: 'all' | 'sales' | 'expenses' | 'bills';
}

const EntryForm: React.FC<EntryFormProps> = ({
  entries,
  selectedDate,
  onEntriesChange,
  onDateChange,
  isProcessing,
  mode,
  activeSection
}) => {
  const [partyNames, setPartyNames] = useState<Set<string>>(new Set());
  const [highlightedText, setHighlightedText] = useState<string>('');
  const [salesEntries, setSalesEntries] = useState('');
  const [expensesEntries, setExpensesEntries] = useState('');
  const [billsEntries, setBillsEntries] = useState('');
  const [lastSaleNumber, setLastSaleNumber] = useState(1);
  const basicTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const textareaRefs = {
    sales: React.useRef<HTMLTextAreaElement>(null),
    expenses: React.useRef<HTMLTextAreaElement>(null),
    bills: React.useRef<HTMLTextAreaElement>(null)
  };

  useEffect(() => {
    loadPartyNames();
  }, []);

  useEffect(() => {
    if (mode === 'basic') {
      // Combine all entries when switching to basic mode
      const combined = [salesEntries, expensesEntries, billsEntries]
        .filter(Boolean)
        .join('\n');
      onEntriesChange(combined);
    } else {
      // Split existing entries when switching to advanced mode
      const lines = entries.split('\n');
      const sales: string[] = [];
      const expenses: string[] = [];
      const bills: string[] = [];
      let maxNumber = 0;
      
      lines.forEach(line => {
        if (/^\d+\./.test(line)) {
          // Extract sale number
          const match = line.match(/^(\d+)\./);
          if (match) {
            maxNumber = Math.max(maxNumber, parseInt(match[1]));
          }
          sales.push(line);
        } else if (/^[A-Za-z]+\s+\d+/.test(line)) {
          expenses.push(line);
        } else if (/.*\(.*\).*/.test(line)) {
          bills.push(line);
        }
      });
      
      setSalesEntries(sales.join('\n'));
      setExpensesEntries(expenses.join('\n'));
      setBillsEntries(bills.join('\n'));
      setLastSaleNumber(maxNumber + 1);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'basic') {
      highlightPartyNames(entries);
    } else {
      switch (activeSection) {
        case 'sales':
          highlightPartyNames(salesEntries);
          break;
        case 'expenses':
          highlightPartyNames(expensesEntries);
          break;
        case 'bills':
          highlightPartyNames(billsEntries);
          break;
      }
    }
  }, [entries, partyNames, mode, activeSection]);

  const handleSalesEntryChange = (value: string) => {
    const lines = value.split('\n').filter(line => line.trim());
    const processedLines = lines.map((line, index) => {
      // If line already starts with a number, keep it
      if (/^\d+\./.test(line)) {
        return line;
      }
      // Otherwise, add the next number
      return `${lastSaleNumber + index}. ${line}`;
    });
    
    // Update last sale number for next entry
    if (processedLines.length > 0) {
      const numbers = processedLines
        .map(line => {
          const match = line.match(/^(\d+)\./);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(num => num > 0);
      
      if (numbers.length > 0) {
        setLastSaleNumber(Math.max(...numbers) + 1);
      }
    }
    
    setSalesEntries(processedLines.join('\n'));
    if (mode === 'advanced') {
      onEntriesChange(processedLines.join('\n'));
    }
  };

  const handleSectionChange = (value: string, section: 'sales' | 'expenses' | 'bills') => {
    // Update the appropriate section state
    switch (section) {
      case 'sales':
        handleSalesEntryChange(value);
        break;
      case 'expenses':
        setExpensesEntries(value);
        onEntriesChange(value);
        break;
      case 'bills':
        setBillsEntries(value);
        onEntriesChange(value);
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, section: 'sales' | 'expenses' | 'bills') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      
      // Get the text before and after the cursor
      const beforeCursor = value.substring(0, start);
      const afterCursor = value.substring(end);
      
      // For sales section, add the next number
      if (section === 'sales') {
        const lines = beforeCursor.split('\n');
        const lastLine = lines[lines.length - 1];
        const match = lastLine.match(/^(\d+)\./);
        const nextNumber = match ? parseInt(match[1]) + 1 : lastSaleNumber;
        
        // Update the textarea value with the new numbered line
        const newValue = `${beforeCursor}\n${nextNumber}. ${afterCursor}`;
        handleSectionChange(newValue, section);
        
        // Set cursor position after the new number
        setTimeout(() => {
          const ref = textareaRefs[section].current;
          if (ref) {
            const newPosition = start + `\n${nextNumber}. `.length;
            ref.selectionStart = newPosition;
            ref.selectionEnd = newPosition;
            ref.focus();
          }
        }, 0);
      } else {
        // For other sections, just add a new line
        const newValue = `${beforeCursor}\n${afterCursor}`;
        handleSectionChange(newValue, section);
        
        // Set cursor position after the new line
        setTimeout(() => {
          const ref = textareaRefs[section].current;
          if (ref) {
            const newPosition = start + 1;
            ref.selectionStart = newPosition;
            ref.selectionEnd = newPosition;
            ref.focus();
          }
        }, 0);
      }
    }
  };

  const loadPartyNames = async () => {
    try {
      const dbInstance = await db.init();
      const result = await dbInstance.exec('SELECT name FROM parties');
      setPartyNames(new Set(result[0]?.values.map((row: any[]) => row[0].toLowerCase()) || []));
    } catch (error) {
      console.error('Error loading party names:', error);
    }
  };

  const highlightPartyNames = (text: string) => {
    const lines = text.split('\n');
    const highlightedLines = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) return line;

      // Check if this is a party entry
      const firstWord = parts[0];
      if (firstWord.includes('(') || /^\d+\.$/.test(firstWord)) {
        // Handle credit sale format: "20. 9300 (Maa)"
        const partyMatch = line.match(/\((.*?)\)/);
        if (partyMatch) {
          const partyName = partyMatch[1].trim().toLowerCase();
          const isValid = partyNames.has(partyName);
          return line.replace(
            partyMatch[0],
            `<span class="${isValid ? 'text-green-600' : 'text-red-500'}">${partyMatch[0]}</span>`
          );
        }
      } else {
        // Handle direct party name format: "SAJ (date: 13/12/24) 33201"
        const potentialParty = firstWord.toLowerCase();
        const isValid = partyNames.has(potentialParty);
        return line.replace(
          firstWord,
          `<span class="${isValid ? 'text-green-600' : 'text-red-500'}">${firstWord}</span>`
        );
      }
      return line;
    });

    setHighlightedText(highlightedLines.join('\n'));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-4">
        {mode === 'basic' && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800">
              Press Enter to start a new line. Each entry should be on its own line.
            </p>
          </div>
        )}

        {/* Mode-specific instructions */}
        {mode === 'advanced' && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              {activeSection === 'sales' && 'Enter Sales Only:'}
              {activeSection === 'expenses' && 'Enter Expenses Only:'}
              {activeSection === 'bills' && 'Enter Bills Only:'}
            </h4>
            <div className="text-sm text-blue-800">
              {activeSection === 'sales' && (
                <p>Enter each sale on a new line:<br />
                • Cash: "1. 23500"<br />
                • Digital: "7. 21506 net"<br />
                • Credit: "20. 9300 (Maa)"</p>
              )}
              {activeSection === 'expenses' && (
                <p>Enter each expense on a new line:<br />
                • Basic: "Home 23988"<br />
                • With GST: "GP 94100 GST"<br />
                • Staff: "Alok Sal 30493"</p>
              )}
              {activeSection === 'bills' && (
                <p>Enter each bill on a new line:<br />
                • Full: "PendalKarigar (25/1/25) SV2029 73173 GR 302 GST"<br />
                • Simple: "SAJ (date: 13/12/24) 33201"</p>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Date
          </label>
          <div className="relative mt-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Enter Transactions
          </label>
          <p className="text-sm text-gray-500 mb-2">
            {mode === 'basic' 
              ? 'Enter all types of transactions' 
              : `Enter ${activeSection} only`}
          </p>
          {mode === 'basic' ? (
            <div className="mt-1 relative">
              <div className="absolute inset-0 pointer-events-none">
                <pre
                  className="p-3 font-mono text-sm whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: highlightedText }}
                />
              </div>
              <textarea
                ref={basicTextareaRef}
                rows={10}
                value={entries}
                onChange={(e) => {
                  onEntriesChange(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const start = target.selectionStart;
                    const end = target.selectionEnd;
                    const value = target.value;
                    const newValue = value.substring(0, start) + '\n' + value.substring(end);
                    onEntriesChange(newValue);
                    requestAnimationFrame(() => {
                      const newPosition = start + 1;
                      target.selectionStart = newPosition;
                      target.selectionEnd = newPosition;
                    });
                  }
                }}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono bg-transparent"
                style={{ color: 'transparent', caretColor: 'black' }}
                placeholder="1. 23500&#10;7. 21506 net&#10;20. 9300 (Maa)&#10;Home 23988&#10;Alok Sal 30493&#10;SAJ (date: 13/12/24) 33201 GR 302"
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 mt-1">
              {/* Sales Section */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales</label>
                <div className="relative">
                  <textarea
                    value={salesEntries}
                    ref={textareaRefs.sales}
                    onChange={(e) => handleSalesEntryChange(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, 'sales')}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                    rows={8}
                    placeholder="23500&#10;21506 net&#10;9300 (Maa)"
                  />
                  <div className="absolute top-0 right-0 mt-2 mr-2">
                    <span className="text-xs text-gray-500">Next #: {lastSaleNumber}</span>
                  </div>
                </div>
              </div>

              {/* Expenses Section */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Expenses</label>
                <div className="relative">
                  <textarea
                    value={expensesEntries}
                    ref={textareaRefs.expenses}
                    onChange={(e) => handleSectionChange(e.target.value, 'expenses')}
                    onKeyDown={(e) => handleKeyDown(e, 'expenses')}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                    rows={8}
                    placeholder="Home 23988&#10;Alok Sal 30493&#10;Food 3321"
                  />
                </div>
              </div>

              {/* Bills Section */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bills</label>
                <div className="relative">
                  <textarea
                    value={billsEntries}
                    ref={textareaRefs.bills}
                    onChange={(e) => handleSectionChange(e.target.value, 'bills')}
                    onKeyDown={(e) => handleKeyDown(e, 'bills')}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                    rows={8}
                    placeholder="SAJ (date: 13/12/24) 33201&#10;PendalKarigar (25/1/25) SV2029 73173"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Entry Format Guide:</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <p>• Sales: "1. 23500", "7. 21506 net", "20. 9300 (Maa)"</p>
            <p>• Bills: "PendalKarigar (25/1/25) SV2029 73173 GR 302 GST"</p>
            <p>• Staff: "Alok Sal 30493", "Raj Adv 5000"</p>
            <p>• Standard: "Home 23988", "GP 94100 GST", "Food 3321"</p>
            <p>• Random: "Repair 5000", "Labour 2500", "Transport 3000 GST"</p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-green-600">■</span> Valid party name
              <span className="text-red-500">■</span> Invalid party name
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntryForm;
