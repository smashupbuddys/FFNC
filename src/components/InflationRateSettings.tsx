import React, { useState } from 'react';
import { Settings, X, Brain, Server, Thermometer, Hash } from 'lucide-react';

interface InflationRateSettingsProps {
  inflationRate: number;
  alternativeLendingRate: number;
  businessGrowthRate: number;
  lmStudioSettings: {
    baseUrl: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
  };
  onSave: (rates: {
    inflationRate: number;
    alternativeLendingRate: number;
    businessGrowthRate: number;
    lmStudioSettings: {
      baseUrl: string;
      modelName: string;
      temperature: number;
      maxTokens: number;
      enabled: boolean;
    };
  }) => void;
}

const InflationRateSettings: React.FC<InflationRateSettingsProps> = ({
  inflationRate,
  alternativeLendingRate,
  businessGrowthRate,
  lmStudioSettings,
  onSave
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rates, setRates] = useState({
    inflationRate,
    alternativeLendingRate,
    businessGrowthRate,
    lmStudioSettings
  });

  const handleSave = () => {
    onSave(rates);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <div
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 cursor-pointer"
      >
        <Settings className="w-4 h-4 mr-2 text-blue-600" />
        <span>Rate Settings</span>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9998] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200 relative z-[9999]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Rate Settings</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-500 p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Annual Inflation Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={rates.inflationRate}
                  onChange={(e) => setRates(prev => ({
                    ...rates,
                    inflationRate: parseFloat(e.target.value)
                  }))}
                  className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Current inflation rate in the economy
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Alternative Lending Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={rates.alternativeLendingRate}
                  onChange={(e) => setRates({
                    ...rates,
                    alternativeLendingRate: parseFloat(e.target.value)
                  })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors duration-200"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Rate at which you could lend money elsewhere
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Business Growth Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={rates.businessGrowthRate}
                  onChange={(e) => setRates({
                    ...rates,
                    businessGrowthRate: parseFloat(e.target.value)
                  })}
                  className="mt-1 block w-full border border-gray-300 rounded-lg shadow-sm py-2.5 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors duration-200"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Expected annual growth rate of your business
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

export default InflationRateSettings;
