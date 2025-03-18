import React, { useState } from 'react';
import { Settings, X, Brain, Server, Thermometer, Hash } from 'lucide-react';

interface LMStudioSettingsProps {
  settings: {
    baseUrl: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
  };
  onSave: (settings: {
    baseUrl: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
  }) => void;
}

const LMStudioSettings: React.FC<LMStudioSettingsProps> = ({
  settings,
  onSave
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onSave(localSettings);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <div
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 cursor-pointer"
      >
        <Brain className="w-4 h-4 mr-2 text-blue-600" />
        <span>AI Settings</span>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9998] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200 relative z-[9999]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">LM Studio Settings</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-500 p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={localSettings.enabled}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    enabled: e.target.checked
                  })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Enable LM Studio
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Base URL
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Server className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={localSettings.baseUrl}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      baseUrl: e.target.value
                    })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="http://localhost:1234/v1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Model Name
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Brain className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={localSettings.modelName}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      modelName: e.target.value
                    })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="local-model"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Temperature
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Thermometer className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localSettings.temperature}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      temperature: parseFloat(e.target.value)
                    })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Controls randomness (0.0 to 2.0)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Tokens
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Hash className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={localSettings.maxTokens}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      maxTokens: parseInt(e.target.value)
                    })}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Maximum length of generated responses
                </p>
              </div>

              <div className="pt-6 border-t mt-6">
                <button
                  onClick={handleSave}
                  className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LMStudioSettings;
