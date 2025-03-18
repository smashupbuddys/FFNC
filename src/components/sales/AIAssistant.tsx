import React, { useState } from 'react';
import { AIMessage, LMStudioConfig } from '../../types/ai';
import { MessageSquare, Minimize, Maximize, X, Send } from 'react-feather';

interface AIAssistantProps {
  onClose: () => void;
  lmStudioConfig: LMStudioConfig;
  aiMessages: AIMessage[];
  setAIMessages: React.Dispatch<React.SetStateAction<AIMessage[]>>;
  onSubmit: (message: string) => Promise<void>;
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({
  onClose,
  lmStudioConfig,
  aiMessages,
  onSubmit,
  minimized,
  setMinimized
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) {
      return;
    }
    
    setIsLoading(true);
    await onSubmit(inputValue);
    setInputValue('');
    setIsLoading(false);
  };

  return (
    <div className={`bg-white rounded-lg shadow-xl flex flex-col transition-all duration-300 ease-in-out
                   ${minimized ? 'w-64 h-12' : 'w-96 h-[32rem]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between bg-indigo-600 text-white p-3 rounded-t-lg">
        <div className="flex items-center">
          <MessageSquare className="h-5 w-5 mr-2" />
          <h3 className="font-medium">Sales Assistant</h3>
          {lmStudioConfig.enabled && (
            <span className="ml-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
              LMStudio
            </span>
          )}
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={() => setMinimized(!minimized)} 
            className="text-white/80 hover:text-white transition-colors"
          >
            {minimized ? <Maximize className="h-4 w-4" /> : <Minimize className="h-4 w-4" />}
          </button>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      {/* Message list (hidden when minimized) */}
      {!minimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {aiMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-4">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-indigo-300" />
              <p>Send a message to get started.</p>
            </div>
          ) : (
            aiMessages.map((message) => (
              <div 
                key={message.id} 
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user' 
                      ? 'bg-indigo-100 text-indigo-900' 
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {message.content}
                    {message.isStreaming && <span className="animate-pulse">▋</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
      
      {/* Input form (hidden when minimized) */}
      {!minimized && (
        <form onSubmit={handleSubmit} className="border-t p-3 flex items-end">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 resize-none border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className={`ml-2 p-2 rounded-lg ${
              isLoading || !inputValue.trim()
                ? 'bg-gray-200 text-gray-400'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      )}
    </div>
  );
};

export default AIAssistant;
