import React from 'react';
import { SalesAnalysis } from '../../types/sales';
import { IndianRupee, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SalesSummaryProps {
  analysis: SalesAnalysis;
  totalSales: number;
  previousPeriodAnalysis?: SalesAnalysis;
  periodTitle?: string;
}

const SalesSummary: React.FC<SalesSummaryProps> = ({
  analysis,
  totalSales,
  previousPeriodAnalysis,
  periodTitle = 'Current Period'
}) => {
  // Calculate total for previous period if available
  const previousTotal = previousPeriodAnalysis
    ? previousPeriodAnalysis.cash.total + previousPeriodAnalysis.digital.total + previousPeriodAnalysis.credit.total
    : 0;
  
  // Calculate percentage change
  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };
  
  const totalChange = previousTotal ? calculateChange(analysis.cash.total + analysis.digital.total + analysis.credit.total, previousTotal) : 0;
  const cashChange = previousPeriodAnalysis ? calculateChange(analysis.cash.total, previousPeriodAnalysis.cash.total) : 0;
  const digitalChange = previousPeriodAnalysis ? calculateChange(analysis.digital.total, previousPeriodAnalysis.digital.total) : 0;
  const creditChange = previousPeriodAnalysis ? calculateChange(analysis.credit.total, previousPeriodAnalysis.credit.total) : 0;

  // Helper function to render change indicator
  const renderChangeIndicator = (change: number) => {
    if (change === 0) return null;
    
    return change > 0 ? (
      <div className="flex items-center text-green-600 text-xs">
        <ArrowUpRight className="h-3 w-3 mr-1" />
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    ) : (
      <div className="flex items-center text-red-600 text-xs">
        <ArrowDownRight className="h-3 w-3 mr-1" />
        <span>{Math.abs(change).toFixed(1)}%</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">{periodTitle} Summary</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sales</p>
              <p className="text-xl font-semibold flex items-center">
                <IndianRupee className="h-4 w-4 mr-1" />
                {(analysis.cash.total + analysis.digital.total + analysis.credit.total).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-600 mt-1">{totalSales} transactions</p>
            </div>
            
            {previousPeriodAnalysis && renderChangeIndicator(totalChange)}
          </div>
        </div>
        
        {/* Cash Sales */}
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cash</p>
              <p className="text-xl font-semibold flex items-center text-green-700">
                <IndianRupee className="h-4 w-4 mr-1" />
                {analysis.cash.total.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-600 mt-1">{analysis.cash.count} transactions</p>
            </div>
            
            {previousPeriodAnalysis && renderChangeIndicator(cashChange)}
          </div>
        </div>
        
        {/* Digital Sales */}
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Digital</p>
              <p className="text-xl font-semibold flex items-center text-blue-700">
                <IndianRupee className="h-4 w-4 mr-1" />
                {analysis.digital.total.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-600 mt-1">{analysis.digital.count} transactions</p>
            </div>
            
            {previousPeriodAnalysis && renderChangeIndicator(digitalChange)}
          </div>
        </div>
        
        {/* Credit Sales */}
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Credit</p>
              <p className="text-xl font-semibold flex items-center text-orange-700">
                <IndianRupee className="h-4 w-4 mr-1" />
                {analysis.credit.total.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-gray-600 mt-1">{analysis.credit.count} transactions</p>
            </div>
            
            {previousPeriodAnalysis && renderChangeIndicator(creditChange)}
          </div>
        </div>
      </div>
      
      {/* Percentage distribution */}
      <div className="mt-6">
        <div className="h-2 flex rounded-full overflow-hidden">
          <div 
            className="bg-green-500" 
            style={{ 
              width: `${analysis.cash.total / (analysis.cash.total + analysis.digital.total + analysis.credit.total) * 100}%` 
            }}
          />
          <div 
            className="bg-blue-500" 
            style={{ 
              width: `${analysis.digital.total / (analysis.cash.total + analysis.digital.total + analysis.credit.total) * 100}%` 
            }}
          />
          <div 
            className="bg-orange-500" 
            style={{ 
              width: `${analysis.credit.total / (analysis.cash.total + analysis.digital.total + analysis.credit.total) * 100}%` 
            }}
          />
        </div>
        
        <div className="flex justify-between mt-1 text-xs text-gray-600">
          <span>Cash: {((analysis.cash.total / (analysis.cash.total + analysis.digital.total + analysis.credit.total)) * 100).toFixed(1)}%</span>
          <span>Digital: {((analysis.digital.total / (analysis.cash.total + analysis.digital.total + analysis.credit.total)) * 100).toFixed(1)}%</span>
          <span>Credit: {((analysis.credit.total / (analysis.cash.total + analysis.digital.total + analysis.credit.total)) * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SalesSummary);
