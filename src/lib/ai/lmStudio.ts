import OpenAI from 'openai';
import { getSettings } from '../db/settings';

let openaiClient: OpenAI | null = null;

export const initializeLLM = async () => {
  const settings = await getSettings();
  const { baseUrl, enabled } = settings.lmStudioSettings;

  if (!enabled) {
    openaiClient = null;
    return null;
  }

  openaiClient = new OpenAI({
    baseURL: baseUrl,
    apiKey: 'lm-studio', // LM Studio doesn't require a real API key
    dangerouslyAllowBrowser: true // Allow client-side usage
  });

  return openaiClient;
};

export const getAvailableModels = async (): Promise<string[]> => {
  try {
    if (!openaiClient) {
      await initializeLLM();
    }
    if (!openaiClient) return [];
    
    const response = await openaiClient.models.list();
    return response.data.map(model => model.id);
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
};

export const checkLMStudioConnection = async (): Promise<boolean> => {
  try {
    const models = await getAvailableModels();
    return models.length > 0;
  } catch (error) {
    console.error('Error checking LM Studio connection:', error);
    return false;
  }
};

export const generateResponse = async (
  prompt: string,
  context: { [key: string]: any }
): Promise<string> => {
  const settings = await getSettings();
  if (!settings.lmStudioSettings.enabled) {
    throw new Error('LM Studio is not initialized or disabled');
  }
  
  if (!openaiClient) {
    await initializeLLM();
  }
  if (!openaiClient) {
    throw new Error('Failed to initialize OpenAI client');
  }

  try {
    let systemMessage = '';
    const currentYear = '2025';
    
    // Set appropriate system message based on context type
    switch (context.type) {
      case 'data_entry_instruction':
        systemMessage = `You are a specialized financial data entry assistant for an Indian business. Follow these rules:

1. STRICT DUPLICATE CHECKING before proceeding:
   - Check for same amount + date combination for each party
   - Check for duplicate bill numbers for the same party
   - If potential duplicate found, show warning:
     "⚠️ WARNING: Possible duplicate entry detected:
      Existing entry: [show existing entry details]
      New entry: [show new entry details]
      Are you absolutely sure you want to proceed?"
   - Require explicit "yes" or "confirm" response for duplicates

2. ALWAYS ask for confirmation in two steps:
   First confirmation:
   - Summarize all entries in ₹ (INR)
   - Ask "Are these entries correct? Please verify:"
   
   Second confirmation (only after first is confirmed):
   - "I'll now process these entries. Please confirm one final time by typing 'proceed' or 'confirm'"
   - For duplicates, require "yes, proceed with duplicates" explicitly

3. Date handling:
   - For entries marked "today", use: ${context.systemDate}
   - For specific dates like "20/09", use that date with year 2025
   - Always confirm the date format: DD/MM/2025

4. Amount formatting:
   - Always use ₹ symbol for Indian Rupees
   - Format large amounts with commas (e.g., ₹1,00,000)
   - Regular sales: Mark as "Net Sale"
   - Manufacturer sales: Mark with "(M)" suffix
   - Party bills: Include bill number and date
   - Payments: Include recipient and date

5. Direct to correct entry page:
   - Sales entries → Sales page (/sales)
   - Party bills → Bulk Entry page (/bulk-entry)
   - Payments → Expenses page (/expenses)

6. Structure each entry like this:
   Entry Type: [Sale/Bill/Payment]
   Amount: ₹[amount in INR]
   Date: [formatted date]
   Additional Info: [bill number/party name/etc]
   Entry Page: [relevant page path]
   Duplicate Check: [Yes/No, if Yes show existing entry]

7. After final confirmation, provide a summary:
   "✅ Entries ready for processing:
   [list all entries with page locations]"`;
        break;
      case 'greeting':
        systemMessage = `You are a friendly and professional AI financial assistant. Be conversational but focused on helping with financial tasks. If the user seems new, briefly mention you can help with financial analysis, data entry, and business insights.`;
        break;
      case 'data_entry':
        systemMessage = `You are a helpful AI assistant that guides users with data entry tasks. Explain the available features clearly and provide step-by-step instructions. When relevant, mention the specific pages (like Bulk Entry, Sales, Expenses) where users can perform these tasks.`;
        break;
      case 'sales':
        systemMessage = `You are a financial analysis AI assistant focused on sales performance. Analyze sales trends, identify patterns, and provide actionable insights.`;
        break;
      case 'expenses':
        systemMessage = `You are a financial analysis AI assistant focused on expense management. Analyze expense patterns, identify areas for optimization, and provide cost-saving recommendations.`;
        break;
      case 'profit':
        systemMessage = `You are a financial analysis AI assistant focused on profitability analysis. Calculate and explain profit margins, suggest improvements, and provide actionable recommendations.`;
        break;
      default:
        systemMessage = `You are a comprehensive financial analysis AI assistant. Analyze data and provide insights focusing on business performance, risks, and opportunities.`;
    }

    const completion = await openaiClient.chat.completions.create({
      model: settings.lmStudioSettings.modelName,
      messages: [
        {
          role: 'system',
          content: systemMessage
        },
        {
          role: 'user',
          content: `Context: ${JSON.stringify({ ...context, currentYear })}\n\nQuestion: ${prompt}`
        }
      ],
      temperature: settings.lmStudioSettings.temperature,
      max_tokens: settings.lmStudioSettings.maxTokens
    });

    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('Error generating response:', error);
    throw error;
  }
};

export const streamResponse = async (
  message: string,
  context: any,
  onChunk: (chunk: string) => void
): Promise<void> => {
  try {
    const settings = await getSettings();
    const response = await fetch(`${settings.lmStudioSettings.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI financial assistant. Context: ${JSON.stringify(context)}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        model: settings.lmStudioSettings.modelName,
        stream: true // Enable streaming
      })
    });

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the chunk and split by lines
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            console.error('Error parsing chunk:', e);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error in streamResponse:', error);
    throw error;
  }
};
