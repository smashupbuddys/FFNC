import React, { useState, useEffect, useRef } from 'react';
import { Brain, Send, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Server } from 'lucide-react';
import { generateRecommendations } from '../lib/ai/analysis';
import { initializeLLM, getAvailableModels, checkLMStudioConnection, generateResponse, streamResponse } from '../lib/ai/lmStudio';
import LMStudioSettings from '../components/LMStudioSettings';
import { useSettings } from '../hooks/useSettings';
import db from '../lib/db';

interface Message {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Add new interface for commands
interface Command {
  id: string;
  label: string;
  description: string;
  action: () => void;
}

// Add new interface and state for pending updates
interface PendingUpdate {
  type: 'payment_update' | 'sale' | 'expense' | 'bill' | 'payment';
  data: any;
}

// Add new interface for streaming message
interface StreamingMessage extends Message {
  isStreaming?: boolean;
}

// Add new interfaces for smart entry handling
interface SmartEntry {
  type: 'sale' | 'expense' | 'bill' | 'payment';
  amount: number;
  date?: string;
  party?: string;
  partyError?: string;
  description?: string;
  category?: string;
  paymentMode?: string;
  grAmount?: number;
  billNumber?: string;
  isUrgent?: boolean;
}

// Add new regex patterns for smarter parsing
const AMOUNT_PATTERN = /(?:rs\.?|₹)?\s*(\d+(?:\.\d{1,2})?)/i;
const VALID_PARTY_NAME = /^[a-zA-Z0-9\s&.'()-]+$/;
const INVALID_PARTY_CHARS = /[^a-zA-Z0-9\s&.'()-]/g;
const PARTY_PATTERN = /(?:to|from|by|for)\s+([a-zA-Z0-9\s&.'()-]+?)(?=\s+(?:by|via|through|using|with|$)|$)/i;
const PAYMENT_MODE_PATTERN = /(?:by|via|through|using|with)\s+(cash|upi|bank\s*transfer|cheque|online)/i;
const DATE_PATTERN = /(?:on|dated?|for)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i;
const CATEGORY_PATTERN = /(?:category|type|under)\s+([a-z\s]+?)(?=\s+|$)/i;
const GR_PATTERN = /(?:gr|gst)\s*(\d+)/i;
const BILL_NUMBER_PATTERN = /(?:bill|invoice|number)\s*(?:no\.?|#)?\s*([a-z0-9-]+)/i;
const URGENCY_PATTERN = /\b(urgent|priority|important)\b/i;

const AIChat: React.FC = () => {
  const [messages, setMessages] = useState<StreamingMessage[]>([
    {
      type: 'assistant',
      content: `👋 Welcome to your AI Financial Assistant!

I'm here to help you with:
• Analyzing your financial data and trends
• Providing insights on sales and expenses
• Offering recommendations for business growth
• Answering questions about your financial metrics
• Helping with financial planning and forecasting

You can ask me questions like:
• "How are my sales trending this month?"
• "What's my current profit margin?"
• "What are the top expense categories?"
• "How can I improve my cash flow?"
• "What's my business's financial health?"

I'm connected to your financial data and can provide real-time insights. Feel free to ask any questions!

Would you like me to start with a quick overview of your current financial status?`,
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [showMetrics, setShowMetrics] = useState(true);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number>(0);
  const [metrics, setMetrics] = useState<{
    salesGrowth: number;
    profitMargin: number;
    cashFlow: number;
    isLoading: boolean;
    lastUpdated: number;
  }>({
    salesGrowth: 0,
    profitMargin: 0,
    cashFlow: 0,
    isLoading: true,
    lastUpdated: 0
  });
  const { settings, saveSettings } = useSettings();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [hasInitialAnalysis, setHasInitialAnalysis] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>('');

  // Add quick commands for data entry
  const quickCommands = [
    { label: 'Add Sale', command: 'Record a new sale' },
    { label: 'Add Expense', command: 'Add a new expense' },
    { label: 'Add Party', command: 'Add a new party' },
    { label: 'Bulk Entry', command: 'Help me with bulk entry' }
  ];

  // Define commands with specific handlers
  const commands: Command[] = [
    {
      id: 'sale',
      label: '/sale',
      description: 'Record a new sale transaction',
      action: () => handleSpecificCommand('sale')
    },
    {
      id: 'expense',
      label: '/expense',
      description: 'Add a new expense',
      action: () => handleSpecificCommand('expense')
    },
    {
      id: 'party',
      label: '/party',
      description: 'Add a new party/vendor',
      action: () => handleSpecificCommand('party')
    },
    {
      id: 'bulk',
      label: '/bulk',
      description: 'Start bulk entry mode',
      action: () => handleSpecificCommand('bulk')
    },
    {
      id: 'delete',
      label: '/delete',
      description: 'Delete last transaction',
      action: () => handleSpecificCommand('delete')
    },
    {
      id: 'recent',
      label: '/recent',
      description: 'Show recent entries',
      action: () => handleSpecificCommand('recent')
    }
  ];

  // Filter commands based on input
  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(commandFilter.toLowerCase()) ||
    cmd.description.toLowerCase().includes(commandFilter.toLowerCase())
  );

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Modify the initial load effect
  useEffect(() => {
    const initializeChat = async () => {
      await checkConnection();
      await loadModels();
      await loadFinancialMetrics();
    };

    // Only run initialization once
    if (!hasInitialAnalysis) {
      initializeChat();
      setHasInitialAnalysis(true);
    }
  }, [hasInitialAnalysis]);

  // Remove the automatic analysis from checkConnection
  const checkConnection = async () => {
    const connected = await checkLMStudioConnection();
    setIsConnected(connected);
    if (connected) {
      await initializeLLM();
    }
  };

  // Add quick command handler
  const handleQuickCommand = (command: string) => {
    setInputMessage(command);
    handleSendMessage(command);
  };

  // Add function to validate and clean party names
  const validatePartyName = (name: string): { isValid: boolean; cleanName?: string; error?: string } => {
    if (!name) return { isValid: false, error: 'Party name is required' };
    
    // Remove leading/trailing spaces and normalize internal spaces
    const trimmed = name.trim().replace(/\s+/g, ' ');
    
    // Check minimum length
    if (trimmed.length < 2) {
      return { isValid: false, error: 'Party name must be at least 2 characters long' };
    }
    
    // Check for invalid characters
    const invalidChars = trimmed.match(INVALID_PARTY_CHARS);
    if (invalidChars) {
      return { 
        isValid: false, 
        error: `Invalid characters found: ${[...new Set(invalidChars)].join(' ')}. Only letters, numbers, spaces, and &.'()- are allowed.`
      };
    }
    
    return { isValid: true, cleanName: trimmed };
  };

  // Modify parseSmartEntry to include party validation
  const parseSmartEntry = (input: string): SmartEntry | null => {
    const amountMatch = input.match(AMOUNT_PATTERN);
    if (!amountMatch) return null;

    const amount = parseFloat(amountMatch[1]);
    const type = input.toLowerCase().includes('sale') ? 'sale' :
                 input.toLowerCase().includes('bill') ? 'bill' :
                 input.toLowerCase().includes('payment') ? 'payment' : 'expense';

    const entry: SmartEntry = { type, amount };

    // Extract and validate party name
    const partyMatch = input.match(PARTY_PATTERN);
    if (partyMatch) {
      const validation = validatePartyName(partyMatch[1]);
      if (validation.isValid && validation.cleanName) {
        entry.party = validation.cleanName;
      } else if (validation.error) {
        entry.partyError = validation.error;
      }
    }

    const paymentMatch = input.match(PAYMENT_MODE_PATTERN);
    if (paymentMatch) entry.paymentMode = paymentMatch[1].toLowerCase();

    const dateMatch = input.match(DATE_PATTERN);
    if (dateMatch) {
      const [day, month, year = new Date().getFullYear()] = dateMatch[1].split('/');
      entry.date = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }

    const categoryMatch = input.match(CATEGORY_PATTERN);
    if (categoryMatch) entry.category = categoryMatch[1].trim();

    const grMatch = input.match(GR_PATTERN);
    if (grMatch) entry.grAmount = parseFloat(grMatch[1]);

    const billNumberMatch = input.match(BILL_NUMBER_PATTERN);
    if (billNumberMatch) entry.billNumber = billNumberMatch[1];

    const urgencyMatch = input.match(URGENCY_PATTERN);
    if (urgencyMatch) entry.isUrgent = true;

    return entry;
  };

  // Modify formatEntryForConfirmation to show party validation errors
  const formatEntryForConfirmation = (entry: SmartEntry): string => {
    const lines = [
      `Type: ${entry.type.toUpperCase()}`,
      `Amount: ₹${entry.amount.toLocaleString()}`,
      entry.partyError ? `⚠️ Party Error: ${entry.partyError}` : (entry.party ? `Party: ${entry.party}` : null),
      entry.date ? `Date: ${entry.date}` : 'Date: Today',
      entry.paymentMode ? `Payment: ${entry.paymentMode}` : null,
      entry.category ? `Category: ${entry.category}` : null,
      entry.grAmount ? `GR Amount: ₹${entry.grAmount.toLocaleString()}` : null,
      entry.billNumber ? `Bill Number: ${entry.billNumber}` : null,
      entry.isUrgent ? '🚨 Marked as URGENT' : null
    ].filter(Boolean);

    return lines.join('\n');
  };

  // Add function to check for duplicates
  const checkForDuplicates = async (dbInstance: any, entry: SmartEntry): Promise<any[]> => {
    const query = `
      SELECT *
      FROM transactions
      WHERE type = ?
      AND amount = ?
      AND date = ?
      ${entry.party ? 'AND party = ?' : ''}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const params = [
      entry.type,
      entry.amount,
      entry.date || new Date().toISOString().slice(0, 10),
      ...(entry.party ? [entry.party] : [])
    ];

    const result = await dbInstance.exec(query, params);
    return result[0]?.values || [];
  };

  // Modify handleSendMessage to use smart entry parsing
  const handleSendMessage = async (directCommand?: string) => {
    const messageToSend = directCommand || inputMessage;
    if ((!messageToSend.trim() && !directCommand) || isLoading) return;
    
    if (!directCommand) setInputMessage('');
    
    const userMessage = {
      type: 'user' as const,
      content: messageToSend.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const smartEntry = parseSmartEntry(messageToSend);
      if (smartEntry) {
        const dbInstance = await db.init();
        const duplicates = await checkForDuplicates(dbInstance, smartEntry);

        let confirmationMessage = formatEntryForConfirmation(smartEntry);

        if (duplicates.length > 0) {
          confirmationMessage = `⚠️ WARNING: Possible duplicate entry detected!\n\nExisting entry:\n${formatEntry(duplicates[0])}\n\nNew entry:\n${confirmationMessage}\n\nAre you absolutely sure you want to proceed? Reply with "yes, proceed with duplicate" to confirm.`;
        } else {
          confirmationMessage += '\n\nDoes this look correct? Reply with "yes" to confirm or "no" to cancel.';
        }

        setMessages(prev => [...prev, {
          type: 'assistant',
          content: confirmationMessage,
          timestamp: new Date()
        }]);

        setPendingUpdate({
          type: smartEntry.type,
          data: {
            ...smartEntry,
            date: smartEntry.date || new Date().toISOString().slice(0, 10),
            description: smartEntry.description || 
                        (smartEntry.type === 'sale' ? (smartEntry.party ? `Sale to ${smartEntry.party}` : 'Net Sale') :
                         smartEntry.type === 'expense' ? `${smartEntry.category || 'General'} expense` :
                         smartEntry.type === 'bill' ? `Bill from ${smartEntry.party}` : 'Payment'),
            paymentMode: smartEntry.paymentMode || 'cash'
          }
        });

        setIsLoading(false);
        return;
      }

      // Add initial streaming message
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      }]);
      
      if (!settings.lmStudioSettings.enabled) {
        setMessages(prev => prev.slice(0, -1).concat({
          type: 'assistant',
          content: 'LM Studio is disabled. Please enable it in settings to use AI features.',
          timestamp: new Date()
        }));
        setIsLoading(false);
        return;
      }
      
      if (!isConnected) {
        setMessages(prev => prev.slice(0, -1).concat({
          type: 'assistant',
          content: 'Unable to connect to LM Studio. Please check if LM Studio is running and try again.',
          timestamp: new Date()
        }));
        setIsLoading(false);
        return;
      }

      // Add bulk entry validation
      if (messageToSend.includes('|')) {
        const entries = messageToSend.split('\n').filter(line => line.trim());
        const validatedEntries: Array<{ entry: string; isValid: boolean; error?: string }> = [];

        for (const entry of entries) {
          const parts = entry.split('|').map(part => part.trim());
          if (parts.length >= 3) {
            const [date, amount, type, mode = 'cash', description = '', party = ''] = parts;
            
            // Validate party name if present
            let partyValidation = { isValid: true } as { isValid: boolean; error?: string };
            if (party) {
              partyValidation = validatePartyName(party);
            }

            validatedEntries.push({
              entry,
              isValid: partyValidation.isValid,
              error: partyValidation.isValid ? undefined : `Invalid party name "${party}": ${partyValidation.error}`
            });
          }
        }

        // If there are any invalid entries, show errors
        const invalidEntries = validatedEntries.filter(e => !e.isValid);
        if (invalidEntries.length > 0) {
          const errorMessage = `⚠️ Found ${invalidEntries.length} invalid entries:\n\n` +
            invalidEntries.map(e => `${e.entry}\n→ Error: ${e.error}`).join('\n\n') +
            '\n\nPlease fix these entries and try again.';

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: errorMessage,
            timestamp: new Date()
          }]);
          setIsLoading(false);
          return;
        }
      }

      // Modify sale handling to ask for confirmation
      const saleMatch = messageToSend.match(/(?:sale\s+)?(?:rs\.?|₹)?(\d+)(?:\s+(?:to\s+(\w+)|net|sale))?/i) ||
                       messageToSend.match(/sale\s+(?:rs\.?|₹)?(\d+)/i);
      
      // Modify expense handling to ask for confirmation
      const expenseMatch = messageToSend.match(/(?:rs\.?|₹)?(\d+)(?:\s+(\w+))?/i) ||
                         messageToSend.match(/expense\s+(?:rs\.?|₹)?(\d+)/i);

      // Modify bill handling to ask for confirmation
      const billMatch = messageToSend.match(/(\w+)\s+(\d+)\s+(\d{1,2}\/\d{1,2})\s+(?:gr|gst)\s*(\d+)?/i);
      
      // Add payment update pattern matching
      const paymentUpdateMatch = messageToSend.match(/(?:update|pay|mark|set)\s+(?:bill|payment)\s+(?:for\s+)?(\w+)\s+(?:rs\.?|₹)?(\d+)(?:\s+(?:as|to|with)\s+(cash|upi|bank\s*transfer))?/i);

      if (paymentUpdateMatch) {
        const [_, party, amount, paymentMode = 'cash'] = paymentUpdateMatch;
        try {
          const dbInstance = await db.init();
          // First find the bill
          const bill = await dbInstance.exec(`
            SELECT rowid, amount, date, description, gr_amount
            FROM transactions
            WHERE type = 'bill' 
            AND party = ? 
            AND amount = ?
            AND payment_mode = 'pending'
            ORDER BY date DESC
            LIMIT 1
          `, [party, amount]);

          if (!bill[0]?.values?.length) {
            setMessages(prev => [...prev, {
              type: 'assistant',
              content: `I couldn't find a pending bill for ${party} with amount ₹${amount}. Please check the details and try again.`,
              timestamp: new Date()
            }]);
            setIsLoading(false);
            return;
          }

          const billDetails = bill[0].values[0];
          const confirmationMsg = `Are you sure you want to mark this bill as paid?

Bill Details:
Party: ${party}
Amount: ₹${amount}
Date: ${billDetails[2]}
${billDetails[4] ? `GR Amount: ₹${billDetails[4]}` : ''}
Payment Mode: ${paymentMode}

Reply with "yes" to confirm or "no" to cancel.`;

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: confirmationMsg,
            timestamp: new Date()
          }]);

          // Store the pending update in state
          setPendingUpdate({
            type: 'payment_update',
            data: {
              rowid: billDetails[0],
              party,
              amount,
              paymentMode
            }
          });
          setIsLoading(false);
          return;
    } catch (error) {
          console.error('Error updating payment:', error);
          setMessages(prev => [...prev, {
          type: 'assistant',
            content: 'Sorry, I had trouble updating the payment status. Please try again.',
          timestamp: new Date()
          }]);
          setIsLoading(false);
          return;
        }
      }

      // Handle confirmation responses
      if (messageToSend.toLowerCase() === 'yes' && pendingUpdate) {
        try {
          const dbInstance = await db.init();
          let responseMessage = '';
          
          switch (pendingUpdate.type) {
            case 'payment_update':
              await dbInstance.exec(`
                UPDATE transactions
                SET payment_mode = ?,
                    payment_date = datetime('now')
                WHERE rowid = ?
              `, [pendingUpdate.data.paymentMode, pendingUpdate.data.rowid]);

              responseMessage = `✅ Payment status updated successfully!

Bill for ${pendingUpdate.data.party} (₹${pendingUpdate.data.amount}) has been marked as paid via ${pendingUpdate.data.paymentMode}.

Need to update another bill? Just let me know!`;
              break;

            case 'sale':
              await dbInstance.exec(`
                INSERT INTO transactions (type, amount, date, payment_mode, description, party)
                VALUES (?, ?, ?, ?, ?, ?)
              `, ['sale', pendingUpdate.data.amount, pendingUpdate.data.date, 
                  pendingUpdate.data.paymentMode, pendingUpdate.data.description, 
                  pendingUpdate.data.party || null]);

              const todaySales = await getTodaySales(dbInstance);
              responseMessage = `💰 Sale recorded successfully!\n\n${todaySales}`;
              break;

            case 'expense':
              await dbInstance.exec(`
                INSERT INTO transactions (type, amount, date, payment_mode, description, category)
                VALUES (?, ?, ?, ?, ?, ?)
              `, ['expense', pendingUpdate.data.amount, pendingUpdate.data.date,
                  pendingUpdate.data.paymentMode, pendingUpdate.data.description,
                  pendingUpdate.data.category]);

              const todayExpenses = await getTodayExpenses(dbInstance);
              responseMessage = `💸 Expense recorded successfully!\n\n${todayExpenses}`;
              break;

            case 'bill':
              await dbInstance.exec(`
                INSERT INTO transactions (type, amount, date, payment_mode, description, party, gr_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `, ['bill', pendingUpdate.data.amount, pendingUpdate.data.date,
                  'pending', pendingUpdate.data.description, pendingUpdate.data.party,
                  pendingUpdate.data.grAmount || null]);

              const todayBills = await getTodayBills(dbInstance);
              responseMessage = `📝 Bill recorded successfully!\n\n${todayBills}`;
              break;
          }

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: responseMessage,
            timestamp: new Date()
          }]);

          setPendingUpdate(null);
          await loadFinancialMetrics();
        } catch (error) {
          console.error('Error processing confirmation:', error);
          setMessages(prev => [...prev, {
            type: 'assistant',
            content: 'Sorry, I encountered an error while processing your confirmation. Please try again.',
            timestamp: new Date()
          }]);
        }
      setIsLoading(false);
        return;
      } else if (messageToSend.toLowerCase() === 'no' && pendingUpdate) {
        setMessages(prev => [...prev, {
          type: 'assistant',
          content: 'Operation cancelled. Let me know if you want to try again!',
          timestamp: new Date()
        }]);
        setPendingUpdate(null);
        setIsLoading(false);
        return;
      }

      // Modify sale handling to ask for confirmation
      if (saleMatch) {
        const amount = parseFloat(saleMatch[1]);
        const party = saleMatch[2] || '';
        const description = party ? `Sale to ${party}` : 'Net Sale';
        const date = new Date().toISOString().slice(0, 10);
        const paymentMode = messageToSend.match(/by\s+(cash|upi|bank\s*transfer)/i)?.[1]?.toLowerCase() || 'cash';

        const confirmationMsg = `Please confirm the sale details:

Amount: ₹${amount.toLocaleString()}
${party ? `Party: ${party}` : 'Type: Net Sale'}
Date: Today
Payment: ${paymentMode}

Reply with "yes" to confirm or "no" to cancel.`;

      setMessages(prev => [...prev, {
        type: 'assistant',
          content: confirmationMsg,
        timestamp: new Date()
      }]);

        setPendingUpdate({
          type: 'sale',
          data: { amount, party, description, date, paymentMode }
        });
        setIsLoading(false);
      }
      
      // Modify expense handling to ask for confirmation
      if (expenseMatch && !messageToSend.toLowerCase().includes('sale')) {
        const amount = parseFloat(expenseMatch[1]);
        const category = expenseMatch[2] || 'general';
        const date = new Date().toISOString().slice(0, 10);
        const paymentMode = messageToSend.match(/by\s+(cash|upi|bank\s*transfer)/i)?.[1]?.toLowerCase() || 'cash';
        const description = `${category.charAt(0).toUpperCase() + category.slice(1)} expense`;

        const confirmationMsg = `Please confirm the expense details:

Amount: ₹${amount.toLocaleString()}
Category: ${category.charAt(0).toUpperCase() + category.slice(1)}
Date: Today
Payment: ${paymentMode}

Reply with "yes" to confirm or "no" to cancel.`;

        setMessages(prev => [...prev, {
          type: 'assistant',
          content: confirmationMsg,
          timestamp: new Date()
        }]);

        setPendingUpdate({
          type: 'expense',
          data: { amount, category, date, paymentMode, description }
        });
        setIsLoading(false);
      }

      // Modify bill handling to ask for confirmation
      if (billMatch) {
        const [_, party, amount, date, grAmount] = billMatch;
        const description = `Bill from ${party}${grAmount ? ` (GR: ₹${grAmount})` : ''}`;

        const confirmationMsg = `Please confirm the bill details:

Party: ${party}
Amount: ₹${parseFloat(amount).toLocaleString()}
Date: ${date}
${grAmount ? `GR Amount: ₹${parseFloat(grAmount).toLocaleString()}` : ''}
Status: Pending

Reply with "yes" to confirm or "no" to cancel.`;

        setMessages(prev => [...prev, {
          type: 'assistant',
          content: confirmationMsg,
          timestamp: new Date()
        }]);

        setPendingUpdate({
          type: 'bill',
          data: { party, amount, date, grAmount, description }
        });
        setIsLoading(false);
      return;
    }
    
      // Initialize context
      let context: any = {};

      // Handle data entry instructions with amounts and dates
      const hasAmount = /\d+/.test(messageToSend);
      const hasDate = /(today|\d{1,2}\/\d{1,2})/.test(messageToSend);
      const hasBill = /(bill|number)/.test(messageToSend);
      const hasPayment = /(pay|payment)/.test(messageToSend);
      const hasSales = messageToSend.includes('sales') || /\d+\s*(net|\(m\))/.test(messageToSend.toUpperCase());
      const isCorrection = /correct|change|modify|wrong|edit/i.test(messageToSend);
      
      if ((hasAmount && (hasDate || hasBill || hasPayment || hasSales)) || isCorrection) {
        context.type = 'data_entry_instruction';
        context.features = {
          bulkEntry: {
            description: 'Add multiple transactions at once',
            path: '/bulk-entry'
          },
          sales: {
            description: 'Record new sales',
            path: '/sales'
          },
          expenses: {
            description: 'Record new expenses',
            path: '/expenses'
          },
          parties: {
            description: 'Add new manufacturers or parties',
            path: '/parties/add'
          }
        };
        // Extract current date for "today" references
        const now = new Date();
        context.systemDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/2025`;
        
        // Include previous messages for context in corrections
        const previousMessages = messages.slice(-4);
        const lastAssistantMessage = previousMessages.reverse().find((m: Message) => m.type === 'assistant');
        if (isCorrection && lastAssistantMessage) {
          context.previousEntries = lastAssistantMessage.content;
          context.isCorrection = true;
        }
      }
      
      // Handle greetings and general conversation
      const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
      if (greetings.some(greeting => messageToSend.includes(greeting))) {
        context.type = 'greeting';
        context.previousMessages = messages.slice(-3); // Get last 3 messages for context
      }

      // Handle sales queries
      else if (messageToSend.includes('sales') || messageToSend.includes('revenue')) {
        const dbInstance = await db.init();
        const salesData = await dbInstance.exec(`
          SELECT 
            strftime('%Y-%m', date) as month,
            SUM(amount) as total_sales,
            COUNT(*) as transaction_count
          FROM transactions
          WHERE type = 'sale'
          GROUP BY month
          ORDER BY month DESC
          LIMIT 6
        `);
        context.type = 'sales';
        context.sales = salesData[0]?.values || [];
      }

      // Handle expense queries
      else if (messageToSend.includes('expense') || messageToSend.includes('cost') || messageToSend.includes('spending')) {
        const dbInstance = await db.init();
        const expenseData = await dbInstance.exec(`
          SELECT 
            strftime('%Y-%m', date) as month,
            SUM(amount) as total_expenses,
            COUNT(*) as transaction_count
          FROM transactions
          WHERE type = 'expense'
          GROUP BY month
          ORDER BY month DESC
          LIMIT 6
        `);
        context.type = 'expenses';
        context.expenses = expenseData[0]?.values || [];
      }

      // Handle profit/margin queries
      else if (messageToSend.includes('profit') || messageToSend.includes('margin')) {
        const dbInstance = await db.init();
        const profitData = await dbInstance.exec(`
          SELECT 
            strftime('%Y-%m', date) as month,
            SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as sales,
            SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
            SUM(CASE WHEN type = 'sale' THEN amount ELSE -amount END) as profit
          FROM transactions
          GROUP BY month
          ORDER BY month DESC
          LIMIT 6
        `);
        context.type = 'profit';
        context.profitMargins = profitData[0]?.values || [];
      }

      // Handle recent entries query
      if (messageToSend.match(/what.*(?:entry|entries|transactions?).*(?:recent|last|latest)/i) || 
          messageToSend.match(/show.*(?:recent|last|latest).*(?:entry|entries|transactions?)/i) ||
          messageToSend.includes('what entry you put recently')) {
        const dbInstance = await db.init();
        const recentEntries = await dbInstance.exec(`
          SELECT 
            type,
            amount,
            date,
            payment_mode,
            description,
            datetime(created_at, 'localtime') as created_at
          FROM transactions
          ORDER BY created_at DESC
          LIMIT 5
        `);

        if (!recentEntries[0]?.values?.length) {
          const response = "I haven't recorded any entries yet. Would you like to add a new transaction?";
      setMessages(prev => [...prev, {
        type: 'assistant',
            content: response,
        timestamp: new Date()
      }]);
        } else {
          const entries = recentEntries[0].values;
          const response = `Here are the most recent entries I've recorded:

${entries.map((entry: any) => `• ${entry[0].toUpperCase()}: ₹${entry[1].toLocaleString()} on ${entry[2]} 
  Mode: ${entry[3]}
  Description: ${entry[4]}
  Added: ${new Date(entry[5]).toLocaleString()}`).join('\n\n')}

Would you like to add another entry?`;

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: response,
            timestamp: new Date()
          }]);
        }
        setIsLoading(false);
      return;
    }

      // If no specific context was gathered, get general financial overview
      if (Object.keys(context).length === 0) {
        const recommendations = await generateRecommendations();
        context = {
          type: 'general',
          ...recommendations
        };
      }

      // Use streaming response
      await streamResponse(messageToSend, context, (chunk: string) => {
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage.isStreaming) {
            lastMessage.content += chunk;
          }
          return newMessages;
        });
      });

      // Finalize the streaming message
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.isStreaming) {
          lastMessage.isStreaming = false;
        }
        return newMessages;
      });

    } catch (error) {
      console.error('Error handling message:', error);
      setMessages(prev => prev.slice(0, -1).concat({
        type: 'assistant',
        content: 'I apologize, but I encountered an error while processing your request. Please try again.',
      timestamp: new Date()
      }));
    } finally {
      setIsLoading(false);
    }
  };

  // Modify handleKeyPress to handle command palette navigation
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (showCommandPalette) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selectedCommand = filteredCommands[selectedCommandIndex];
        if (selectedCommand) {
          handleCommandSelect(selectedCommand);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandPalette(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Reset selected index when filtering commands
  useEffect(() => {
    setSelectedCommandIndex(0);
  }, [commandFilter]);

  const loadFinancialMetrics = async () => {
    const now = Date.now();
    if (now - metrics.lastUpdated < 30000) return;

    try {
      const dbInstance = await db.init();
      
      // Get current month and previous month
      const currentDate = new Date();
      const currentMonth = currentDate.toISOString().slice(0, 7);
      const lastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1).toISOString().slice(0, 7);

      // Fetch current month metrics
      const currentMonthData = await dbInstance.exec(`
        SELECT 
          SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as sales,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
        FROM transactions
        WHERE strftime('%Y-%m', date) = ?
      `, [currentMonth]);

      // Fetch last month metrics
      const lastMonthData = await dbInstance.exec(`
        SELECT 
          SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as sales,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
        FROM transactions
        WHERE strftime('%Y-%m', date) = ?
      `, [lastMonth]);

      // Calculate metrics
      const currentSales = currentMonthData[0]?.values[0][0] || 0;
      const currentExpenses = currentMonthData[0]?.values[0][1] || 0;
      const lastSales = lastMonthData[0]?.values[0][0] || 0;
      
      // Calculate growth
      const salesGrowth = lastSales ? ((currentSales - lastSales) / lastSales) * 100 : 0;
      
      // Calculate profit margin
      const profitMargin = currentSales ? ((currentSales - currentExpenses) / currentSales) * 100 : 0;
      
      // Calculate cash flow (net money movement)
      const cashFlow = currentSales - currentExpenses;

      setMetrics({
        salesGrowth,
        profitMargin,
        cashFlow,
        isLoading: false,
        lastUpdated: now
      });
    } catch (error) {
      console.error('Error loading financial metrics:', error);
      setMetrics(prev => ({ ...prev, isLoading: false }));
    }
  };

  const formatLastUpdated = () => {
    if (metrics.lastUpdated === 0) return '';
    const seconds = Math.floor((Date.now() - metrics.lastUpdated) / 1000);
    if (seconds < 60) return 'Updated just now';
    if (seconds < 3600) return `Updated ${Math.floor(seconds / 60)}m ago`;
    return `Updated ${Math.floor(seconds / 3600)}h ago`;
  };

  // Add loadModels function back
  const loadModels = async () => {
    if (!settings.lmStudioSettings.enabled) return;
    const models = await getAvailableModels();
    setAvailableModels(models);
  };

  // Add handleButtonClick function
  const handleButtonClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Handle input changes with command palette
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputMessage(value);
    
    // Show command palette when typing '/'
    if (value === '/') {
      setShowCommandPalette(true);
      setCommandFilter('');
    } else if (value.startsWith('/')) {
      setShowCommandPalette(true);
      setCommandFilter(value.slice(1));
    } else {
      setShowCommandPalette(false);
    }
  };

  // Handle command selection
  const handleCommandSelect = (command: Command) => {
    command.action();
    setInputMessage('');
    setShowCommandPalette(false);
  };

  // Close command palette when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (commandPaletteRef.current && !commandPaletteRef.current.contains(event.target as Node)) {
        setShowCommandPalette(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add specific command handler
  const handleSpecificCommand = async (commandType: string) => {
    setIsLoading(true);
    const dbInstance = await db.init();

    try {
      switch (commandType) {
        case 'bulk':
          const response = `🚀 Bulk Entry Mode Activated! 

Let's get this data party started! Here's how we can add multiple entries quickly:

1️⃣ Format: DATE | AMOUNT | TYPE | MODE | DESCRIPTION
Example: 
15/03/2024 | 5000 | sale | upi | Product A
15/03/2024 | 2000 | expense | cash | Office supplies

Just paste your entries in this format, one per line. I'll process them faster than a caffeinated accountant! 

Need a template? Just say "template" and I'll give you one to fill out.
Want to use Excel? Say "excel" and I'll show you how to import from a spreadsheet.

Your recent entries for reference:
${await getRecentEntries(dbInstance, 3)}

Ready when you are! 📝`;

      setMessages(prev => [...prev, {
        type: 'assistant',
        content: response,
        timestamp: new Date()
      }]);
          break;

        case 'sale':
          const recentSales = await getRecentEntries(dbInstance, 3, 'sale');
          const saleResponse = `💰 Let's record that sale! 

Quick formats I understand:
• "₹5000 today by UPI for Product X"
• "Sale ₹2500 cash for services"
• "Put ₹3000 sale for consulting"

Your recent sales:
${recentSales}

Pro tip: Add "urgent" or "priority" for high-value sales, and I'll flag them in the reports! 🌟

What are we selling today? 🎯`;

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: saleResponse,
            timestamp: new Date()
          }]);
          break;

        case 'expense':
          const expenseResponse = `💸 Time to track those expenses!

Quick formats I understand:
• "₹1000 today for office supplies"
• "Spent ₹500 on stationery"
• "Add expense ₹2000 for rent"

Categories available:
🏢 Office
📱 Technology
🚗 Transport
📦 Inventory
🍽️ Food & Beverages

Just tell me what you spent and where! For example:
"Expense ₹1500 for office category technology"

Your recent expenses:
${await getRecentEntries(dbInstance, 3, 'expense')}

Let's keep those expenses in check! 📊`;

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: expenseResponse,
            timestamp: new Date()
          }]);
          break;

        case 'party':
          const partyResponse = `🤝 New Party Registration

Let's add a new business contact! I'll need:
1. Party Name
2. Contact Type (supplier/customer/both)
3. Contact Details
4. Payment Terms (optional)

Format: "Add party: [Name], [Type], [Contact], [Terms]"
Example: "Add party: TechCorp, supplier, john@tech.com, Net 30"

Or just give me the name and we'll fill in the rest together!

Recent parties added:
${await getRecentParties(dbInstance)}

Ready to expand your network? 🌐`;

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: partyResponse,
            timestamp: new Date()
          }]);
          break;

        case 'delete':
          const lastEntry = await getLastEntry(dbInstance);
          if (!lastEntry) {
            setMessages(prev => [...prev, {
              type: 'assistant',
              content: "🤔 Hmm... I can't find any entries to delete. Are you sure there's something to remove?",
              timestamp: new Date()
            }]);
            break;
          }

          const deleteResponse = `🗑️ Ready to delete this entry?

${formatEntry(lastEntry)}

Just say "confirm delete" to remove it, or "cancel" to keep it.
(Don't worry, I keep backups... I learned that lesson the hard way! 😅)`;

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: deleteResponse,
            timestamp: new Date()
          }]);
          break;

        case 'recent':
          const recentResponse = `📋 Here's what's been happening:

${await getRecentEntries(dbInstance, 5)}

Want more details about any entry? Just ask!
Need to modify something? Use /delete or tell me what needs fixing.

Fun fact: Did you know your most active day for entries is ${await getMostActiveDay(dbInstance)}? 📊`;

          setMessages(prev => [...prev, {
            type: 'assistant',
            content: recentResponse,
            timestamp: new Date()
          }]);
          break;
      }
    } catch (error) {
      console.error('Error handling command:', error);
      setMessages(prev => [...prev, {
        type: 'assistant',
        content: '😅 Oops! Something went wrong. Let me grab a coffee and try again!',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions for formatting responses
  const getRecentEntries = async (dbInstance: any, limit: number, type?: string) => {
    const query = `
      SELECT 
        type,
        amount,
        date,
        payment_mode,
        description
      FROM transactions
      ${type ? 'WHERE type = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const params = type ? [type, limit] : [limit];
    const entries = await dbInstance.exec(query, params);

    if (!entries[0]?.values?.length) return "No entries found yet!";

    return entries[0].values
      .map((entry: any) => 
        `• ${entry[0].toUpperCase()}: ₹${entry[1].toLocaleString()} on ${entry[2]}\n  ${entry[4]} (via ${entry[3]})`
      )
      .join('\n\n');
  };

  const getRecentParties = async (dbInstance: any) => {
    // Implement party retrieval logic here
    return "Feature coming soon! 🚧";
  };

  const getLastEntry = async (dbInstance: any) => {
    const result = await dbInstance.exec(`
      SELECT 
        rowid,
        type,
        amount,
        date,
        payment_mode,
        description,
        created_at
      FROM transactions
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return result[0]?.values?.[0];
  };

  const formatEntry = (entry: any) => {
    if (!entry) return '';
    return `Type: ${entry[1].toUpperCase()}
Amount: ₹${entry[2].toLocaleString()}
Date: ${entry[3]}
Payment Mode: ${entry[4]}
Description: ${entry[5]}
Added: ${new Date(entry[6]).toLocaleString()}`;
  };

  const getMostActiveDay = async (dbInstance: any) => {
    const result = await dbInstance.exec(`
      SELECT 
        strftime('%A', date) as day,
        COUNT(*) as count
      FROM transactions
      GROUP BY day
      ORDER BY count DESC
      LIMIT 1
    `);
    return result[0]?.values?.[0]?.[0] || 'Not enough data yet!';
  };

  // Add new helper function for today's expenses
  const getTodayExpenses = async (dbInstance: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await dbInstance.exec(`
      SELECT 
        SUM(amount) as total,
        COUNT(*) as count,
        GROUP_CONCAT(amount || ' - ' || COALESCE(description, 'General Expense')) as details
      FROM transactions
      WHERE type = 'expense'
      AND date = ?
    `, [today]);

    if (!result[0]?.values?.length || !result[0].values[0][0]) {
      return "No other expenses recorded today.";
    }

    const [total, count, details] = result[0].values[0];
    const expenseList = details.split(',')
      .map((expense: string) => `• ₹${expense.trim()}`)
      .join('\n');

    return `Today's Expenses (${count}):
${expenseList}
───────────────
Total: ₹${total.toLocaleString()}`;
  };

  // Add new helper function for today's sales
  const getTodaySales = async (dbInstance: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await dbInstance.exec(`
      SELECT 
        SUM(amount) as total,
        COUNT(*) as count,
        GROUP_CONCAT(
          amount || 
          CASE 
            WHEN party IS NOT NULL THEN ' - To: ' || party
            ELSE ' - ' || description
          END ||
          ' (' || payment_mode || ')'
        ) as details
      FROM transactions
      WHERE type = 'sale'
      AND date = ?
    `, [today]);

    if (!result[0]?.values?.length || !result[0].values[0][0]) {
      return "No other sales recorded today.";
    }

    const [total, count, details] = result[0].values[0];
    const saleList = details.split(',')
      .map((sale: string) => `• ₹${sale.trim()}`)
      .join('\n');

    return `Today's Sales (${count}):
${saleList}
───────────────
Total: ₹${total.toLocaleString()}`;
  };

  // Add new helper function for today's bills
  const getTodayBills = async (dbInstance: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const result = await dbInstance.exec(`
      SELECT 
        SUM(amount) as total,
        COUNT(*) as count,
        GROUP_CONCAT(
          party || ': ₹' || amount || 
          CASE 
            WHEN gr_amount IS NOT NULL THEN ' (GR: ₹' || gr_amount || ')'
            ELSE ''
          END
        ) as details
      FROM transactions
      WHERE type = 'bill'
      AND date = ?
    `, [today]);

    if (!result[0]?.values?.length || !result[0].values[0][0]) {
      return "No other bills recorded today.";
    }

    const [total, count, details] = result[0].values[0];
    const billList = details.split(',')
      .map((bill: string) => `• ${bill.trim()}`)
      .join('\n');

    return `Today's Bills (${count}):
${billList}
───────────────
Total: ₹${total.toLocaleString()}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">AI Financial Assistant</h1>
          </div>
          <div className="flex items-center gap-2">
            <LMStudioSettings
              settings={settings.lmStudioSettings}
              onSave={(newSettings) => saveSettings({
                ...settings,
                lmStudioSettings: newSettings
              })}
            />
            <button
              onClick={handleButtonClick}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <Send className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Ask a Question
            </button>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Get AI-powered insights and recommendations based on your financial data
        </p>
        
        {/* Connection Status */}
        <div className={`mt-4 flex items-center gap-2 text-sm ${
          isConnected ? 'text-green-600' : 'text-red-600'
        }`}>
          <Server className="w-4 h-4" />
          <span>
            {isConnected ? 'Connected to LM Studio' : 'Not connected to LM Studio'}
          </span>
          {availableModels.length > 0 && (
            <span className="ml-2 text-gray-500">
              ({availableModels.length} models available)
            </span>
          )}
        </div>

        {!settings.lmStudioSettings.enabled && (
          <div className="flex items-start gap-2 text-sm text-yellow-700 bg-yellow-50 p-4 rounded-lg">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">LM Studio is disabled</p>
              <p className="mt-1">Enable LM Studio in settings to use AI features</p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Commands */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-2">
          {quickCommands.map((cmd, index) => (
            <button
              key={index}
              onClick={() => handleQuickCommand(cmd.command)}
              disabled={isLoading}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50"
            >
              {cmd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Toggle */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
        >
          <span className="font-medium text-gray-900">Financial Metrics</span>
          {showMetrics ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
        
        {showMetrics && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-blue-900">Sales Growth</h3>
                  <span className="text-xs text-gray-500">{formatLastUpdated()}</span>
                </div>
                <div className="mt-2 flex items-center">
                  {metrics.isLoading ? (
                  <span className="text-2xl font-bold text-blue-700">Loading...</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-blue-700">
                        {metrics.salesGrowth.toFixed(1)}%
                      </span>
                      <span className={`text-sm ${metrics.salesGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.salesGrowth >= 0 ? '↑' : '↓'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-green-900">Profit Margin</h3>
                  <span className="text-xs text-gray-500">{formatLastUpdated()}</span>
                </div>
                <div className="mt-2 flex items-center">
                  {metrics.isLoading ? (
                  <span className="text-2xl font-bold text-green-700">Loading...</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-green-700">
                        {metrics.profitMargin.toFixed(1)}%
                      </span>
                      <span className={`text-sm ${metrics.profitMargin >= 15 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {metrics.profitMargin >= 15 ? '✓' : '!'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                <h3 className="text-sm font-medium text-purple-900">Cash Flow</h3>
                  <span className="text-xs text-gray-500">{formatLastUpdated()}</span>
                </div>
                <div className="mt-2 flex items-center">
                  {metrics.isLoading ? (
                  <span className="text-2xl font-bold text-purple-700">Loading...</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-purple-700">
                        ₹{Math.abs(metrics.cashFlow).toLocaleString()}
                      </span>
                      <span className={`text-sm ${metrics.cashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.cashFlow >= 0 ? '↑' : '↓'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 h-[600px] flex flex-col">
        <div 
          ref={chatContainerRef}
          className="flex-1 p-6 space-y-4 overflow-y-auto scroll-smooth"
          style={{ scrollBehavior: 'smooth' }}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {message.content}
                </pre>
                <div className={`mt-2 text-xs ${
                  message.type === 'user' ? 'text-blue-200' : 'text-gray-500'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Chat Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <textarea
                value={inputMessage}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Type / for commands or ask a question..."
                className="w-full pr-12 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={handleButtonClick}
                disabled={!inputMessage.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>

              {/* Command Palette */}
              {showCommandPalette && (
                <div 
                  ref={commandPaletteRef}
                  className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto"
                >
                  {filteredCommands.map((cmd, index) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleCommandSelect(cmd)}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between ${
                        index === selectedCommandIndex ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className="font-medium text-gray-900">{cmd.label}</span>
                      <span className="text-sm text-gray-500">{cmd.description}</span>
                    </button>
                  ))}
                  {filteredCommands.length === 0 && (
                    <div className="px-4 py-2 text-gray-500">
                      No matching commands found
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Type / for commands, Enter to send, Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
};

// Add this at the end of your CSS or in your global styles
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out forwards;
  }
`;

export default AIChat;
