import { AIMessage, LMStudioConfig } from '../types/ai';
import { generateId } from './fileUtils';

/**
 * Sends messages to LMStudio and processes the response
 */
export const sendToLMStudio = async (
  messages: AIMessage[],
  config: LMStudioConfig
): Promise<string> => {
  try {
    // Format messages for the API
    const formattedMessages = messages.slice(-config.contextSize).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Debug log
    console.log('Sending to LMStudio:', formattedMessages);
    
    // Make the API request
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'local-model',
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false
      }),
    });
    
    if (!response.ok) {
      throw new Error(`LMStudio API responded with ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling LMStudio API:', error);
    return 'Sorry, I encountered an error connecting to the AI service. Please try again later.';
  }
};

/**
 * Sends messages to LMStudio with streaming support
 */
export const streamFromLMStudio = async (
  messages: AIMessage[],
  config: LMStudioConfig,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void
): Promise<void> => {
  try {
    // Format messages for the API
    const formattedMessages = messages.slice(-config.contextSize).map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Debug log
    console.log('Streaming from LMStudio:', formattedMessages);
    
    // Make the API request with streaming enabled
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'local-model',
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true
      }),
    });
    
    if (!response.ok) {
      throw new Error(`LMStudio API responded with ${response.status}: ${await response.text()}`);
    }
    
    if (!response.body) {
      throw new Error('Response body is null');
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    // Process the stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      
      // Split the chunk by lines
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          
          if (data === '[DONE]') {
            // Stream is complete
            break;
          }
          
          try {
            const json = JSON.parse(data);
            if (json.choices && json.choices[0].delta.content) {
              const content = json.choices[0].delta.content;
              fullResponse += content;
              onChunk(content);
            }
          } catch (e) {
            console.error('Error parsing JSON from stream:', e);
          }
        }
      }
    }
    
    onComplete(fullResponse);
  } catch (error) {
    console.error('Error streaming from LMStudio API:', error);
    onChunk('\nSorry, I encountered an error connecting to the AI service. Please try again later.');
    onComplete('Sorry, I encountered an error connecting to the AI service. Please try again later.');
  }
};

/**
 * Extracts commands from AI response text
 */
export const extractCommands = (response: string): { commands: any[], cleanedResponse: string } => {
  const commandRegex = /```json\s*({[\s\S]*?})\s*```/g;
  const commands: any[] = [];
  
  // Extract commands and clean the response
  let cleanedResponse = response.replace(commandRegex, (match, jsonStr) => {
    try {
      const command = JSON.parse(jsonStr);
      commands.push(command);
      return ''; // Remove the command from the response
    } catch (e) {
      console.error('Error parsing JSON command:', e);
      return match; // Keep the match if parsing fails
    }
  }).trim();
  
  return { commands, cleanedResponse };
};

/**
 * Creates a new AI message
 */
export const createAIMessage = (role: 'user' | 'assistant', content: string): AIMessage => {
  return {
    id: generateId(),
    role,
    content,
    timestamp: new Date()
  };
};
