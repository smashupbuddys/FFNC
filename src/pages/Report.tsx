import React, { useState, useEffect } from 'react';
import { generateEnhancedReport } from '../utils/reportGenerator';
import { Download, TrendingUp, TrendingDown, IndianRupee, Users, FileText, Calendar } from 'lucide-react';
import { generatePDF } from '../utils/pdfGenerator';

const Report: React.FC = () => {
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      const data = await generateEnhancedReport();
      setReportData(data);
    } catch (error) {
      console.error('Error loading report data:', error);
      alert('Error loading report data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = async () => {
    try {
      setIsGenerating(true);
      await generatePDF();
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Error exporting report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading report data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Report</h1>
            <p className="text-gray-500 mt-1">Comprehensive analysis of your business performance</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-10 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm text-sm"
              />
            </div>
            <button
              onClick={handleExportReport}
              disabled={isGenerating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-2" />
              {isGenerating ? 'Generating...' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* Sales and Expenses Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Sales and Expenses Summary</h2>
          </div>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-l-lg">Month</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expenses</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-r-lg">Net Profit</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.sales.map((row: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row[0]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">₹{row[1].toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">₹{row[2].toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">₹{(row[1] - row[2]).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bills Paid and Received per Party */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Party-wise Transaction Summary</h2>
          </div>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-l-lg">Month</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bills</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payments</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-r-lg">Balance</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.partyBills.map((row: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row[0]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row[1]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">₹{row[2].toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">₹{row[3].toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      row[2] - row[3] > 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      ₹{Math.abs(row[2] - row[3]).toLocaleString()}
                      {row[2] - row[3] !== 0 && (
                        <span className="ml-1">{row[2] - row[3] > 0 ? 'DR' : 'CR'}</span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total Purchase per Party per Month */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <IndianRupee className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Monthly Purchase Analysis</h2>
          </div>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-l-lg">Month</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-r-lg">Purchase Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.partyPurchases.map((row: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row[0]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row[1]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">₹{row[2].toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Pending Forecasting */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-medium text-gray-900">Credit Pending Forecast</h2>
          </div>
        </div>
        <div className="overflow-x-auto p-6">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-l-lg">Month</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pending Credit</th>
                <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-r-lg">Trend</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reportData.creditPending.map((row: any, index: number, arr: any[]) => {
                const prevAmount = index > 0 ? arr[index - 1][1] : row[1];
                const trend = row[1] - prevAmount;
                return (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row[0]}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">₹{row[1].toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {trend !== 0 && (
                        <>
                          {trend > 0 ? (
                            <TrendingUp className="w-4 h-4 text-red-500 mr-2" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-green-500 mr-2" />
                          )}
                          <span className={trend > 0 ? 'text-red-600' : 'text-green-600'}>
                            {Math.abs(trend).toLocaleString()}
                          </span>
                        </>
                      )}
                      {trend === 0 && (
                        <span className="text-gray-500">No change</span>
                      )}
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Report;
