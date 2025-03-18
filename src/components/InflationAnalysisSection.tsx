import React, { useState } from 'react';
import { calculateInflationImpact, calculateCreditBuyerROI } from '../utils/inflationCalculator';
import InflationAnalysisCard from './InflationAnalysisCard';
import InflationRateSettings from './InflationRateSettings';
import { useSettings } from '../hooks/useSettings';
import { ChevronLeft, ChevronRight, TrendingUp, X } from 'lucide-react';

interface InflationAnalysisSectionProps {
  amount: number;
  startDate: string;
  endDate?: string;
  type: 'credit-given' | 'credit-taken';
}

const InflationAnalysisSection: React.FC<InflationAnalysisSectionProps> = ({
  amount,
  startDate,
  endDate = new Date().toISOString().split('T')[0],
  type
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { settings, isLoading, saveSettings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return <div className="animate-pulse bg-gray-100 h-32 rounded-xl"></div>;
  }

  const analysis = type === 'credit-given'
    ? calculateInflationImpact(
        amount,
        startDate,
        endDate,
        settings.inflationRate,
        settings.alternativeLendingRate
      )
    : calculateCreditBuyerROI(
        amount,
        startDate,
        endDate,
        settings.inflationRate,
        settings.businessGrowthRate
      );

  return (
    <div className="fixed right-0 top-0 bottom-0 z-40 flex items-center">
      {/* Reveal Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-l-xl shadow-md
          hover:bg-gray-50 transition-all duration-300 relative z-50
          ${isOpen ? 'translate-x-2' : ''}
        `}
      >
        {!isOpen && (
          <>
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </>
        )}
      </button>

      {/* Sliding Panel */}
      <div className={`
        fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-2xl
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Inflation Impact Analysis
            </h3>
            <div className="flex items-center gap-2">
              <InflationRateSettings
                inflationRate={settings.inflationRate}
                alternativeLendingRate={settings.alternativeLendingRate}
                businessGrowthRate={settings.businessGrowthRate}
                onSave={saveSettings}
              />
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
          <InflationAnalysisCard
            analysis={analysis}
            type={type}
            inflationRate={settings.inflationRate}
            alternateRate={
              type === 'credit-given'
                ? settings.alternativeLendingRate
                : settings.businessGrowthRate
            }
          />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InflationAnalysisSection;
