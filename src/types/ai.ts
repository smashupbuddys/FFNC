export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
}

export interface AICommand {
  name: string;
  description: string;
  execute: (params?: any) => Promise<string>;
}

export interface LMStudioConfig {
  apiUrl: string;
  enabled: boolean;
  contextSize: number;  // Number of previous messages to include as context
}
