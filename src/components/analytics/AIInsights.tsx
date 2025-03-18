import React, { useState, useEffect } from 'react';
import { Brain, RefreshCw, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { generateRecommendations } from '../../lib/ai/analysis';
import { useSettings } from '../../hooks/useSettings';
import LMStudioSettings from '../LMStudioSettings';

const AIInsights: React.FC = () => {
  const [insights, setInsights] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const { settings, saveSettings } = useSettings();

  const loadInsights = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await generateRecommendations();
      setInsights(data);
    } catch (error) {
      console.error('Error loading AI insights:', error);
      setError('Failed to generate insights. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInsights();
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">AI Financial Analysis</h2>
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
              onClick={loadInsights}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Analyzing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        ) : insights ? (
          <div className="space-y-6">
            {/* Key Insights */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Key Insights</h3>
              <div className="bg-blue-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-sm text-blue-900 font-mono">
                  {insights.insights}
                </pre>
              </div>
            </div>

            {/* Risk Assessment */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Risk Assessment</h3>
              <div className="bg-yellow-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap text-sm text-yellow-900 font-mono">
                  {insights.riskAssessment}
                </pre>
              </div>
            </div>

            {/* Show/Hide Details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              {showDetails ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show Details
                </>
              )}
            </button>

            {/* Detailed Analysis */}
            {showDetails && (
              <div className="mt-4 space-y-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Analysis Details</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Generated at: {new Date(insights.timestamp).toLocaleString()}</p>
                    <p>Model: LM Studio Local</p>
                    <p>Analysis Type: Comprehensive Financial Review</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Data Sources</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                    <li>Transaction History</li>
                    <li>Cash Flow Analysis</li>
                    <li>Party Performance</li>
                    <li>Market Conditions</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No insights available. Click refresh to generate new analysis.
          </div>
        )}
      </div>
    </div>
  );
};

export default AIInsights;
