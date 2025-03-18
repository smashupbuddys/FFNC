import React from 'react';
import { TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';

interface InflationAnalysisProps {
  analysis: {
    effectiveInterestRate: number;
    absoluteGain: number;
    relativeGain: number;
    daysDelayed: number;
    recommendation: string;
  };
  type: 'credit-given' | 'credit-taken';
  inflationRate: number;
  alternateRate: number;
}

const InflationAnalysisCard: React.FC<InflationAnalysisProps> = ({
  analysis,
  type,
  inflationRate,
  alternateRate
}) => {
  const isPositiveGain = analysis.absoluteGain > 0;
  
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          {type === 'credit-given' ? 'Credit Given Analysis' : 'Credit Taken Analysis'}
        </h3>
        <div className={`p-3 rounded-full ${isPositiveGain ? 'bg-green-100' : 'bg-red-100'} transition-transform duration-300 hover:scale-110`}>
          {isPositiveGain ? (
            <TrendingUp className={`w-5 h-5 ${isPositiveGain ? 'text-green-600' : 'text-red-600'}`} />
          ) : (
            <TrendingDown className={`w-5 h-5 ${isPositiveGain ? 'text-green-600' : 'text-red-600'}`} />
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500">Effective Rate</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {Math.abs(analysis.effectiveInterestRate).toFixed(1)}%
              <span className="text-sm text-gray-500 ml-1 font-normal">per year</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Time Period</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">
              {analysis.daysDelayed}
              <span className="text-sm text-gray-500 ml-1 font-normal">days</span>
            </p>
          </div>
        </div>

        {/* Gain/Loss Analysis */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Absolute Impact</span>
              <span className={`text-sm font-semibold ${isPositiveGain ? 'text-green-600' : 'text-red-600'}`}>
                ₹{Math.abs(analysis.absoluteGain).toLocaleString()}
                {isPositiveGain ? ' gain' : ' loss'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Relative Impact</span>
              <span className={`text-sm font-semibold ${isPositiveGain ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(analysis.relativeGain).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Rates Comparison */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
          <div>
            <p className="text-sm text-gray-600">Inflation Rate</p>
            <p className="text-xl font-semibold text-blue-700 mt-1">{inflationRate}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              {type === 'credit-given' ? 'Lending Rate' : 'Growth Rate'}
            </p>
            <p className="text-xl font-semibold text-blue-700 mt-1">{alternateRate}%</p>
          </div>
        </div>

        {/* Recommendation */}
        <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm leading-relaxed text-yellow-800">{analysis.recommendation}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InflationAnalysisCard;
