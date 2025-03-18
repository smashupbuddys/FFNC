import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ComposedChart
} from 'recharts';
import { 
  IndianRupee, TrendingUp, TrendingDown, Calendar, Download,
  Bell, CheckCircle2, Filter, RefreshCw
} from 'lucide-react';
import AIInsights from '../components/analytics/AIInsights';
import db from '../lib/db';
import { generatePDF } from '../utils/pdfGenerator';
import MetricsCard from '../components/metrics/MetricsCard';
import { generateFinancialInsights } from '../lib/ai/analysis';

const COLORS = ['#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#FF9500', '#6366F1'];

const Dashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'year'>('month');
  const [growthRates, setGrowthRates] = useState<any>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [insights, setInsights] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
    // Mock notifications - in a real app, fetch these from the database
    setNotifications([
      { id: '1', message: 'Credit payment due for Customer A', is_read: false, created_at: new Date().toISOString() },
      { id: '2', message: 'Low inventory alert: Item XYZ', is_read: false, created_at: new Date().toISOString() }
    ]);
  }, [timeRange]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const dbInstance = await db.init();

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      switch (timeRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
      }

      // Format dates for SQL
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = new Date().toISOString().split('T')[0];

      // Fetch transactions
      const result = dbInstance.exec(`
        SELECT 
          date,
          SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as sales,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
          SUM(CASE 
            WHEN type = 'sale' THEN amount 
            WHEN type = 'expense' THEN -amount 
            ELSE 0 
          END) as profit
        FROM transactions 
        WHERE date BETWEEN ? AND ?
        GROUP BY date
        ORDER BY date
      `, [startDateStr, endDateStr]);

      // Fetch payment distribution
      const paymentResult = dbInstance.exec(`
        SELECT 
          COALESCE(payment_mode, 'unknown') as name,
          SUM(amount) as amount
        FROM transactions 
        WHERE type = 'sale' AND date BETWEEN ? AND ?
        GROUP BY payment_mode
      `, [startDateStr, endDateStr]);

      // Calculate summary
      const summaryResult = dbInstance.exec(`
        SELECT 
          SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as totalSales,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpenses,
          SUM(CASE 
            WHEN type = 'sale' THEN amount 
            WHEN type = 'expense' THEN -amount 
            ELSE 0 
          END) as totalProfit
        FROM transactions 
        WHERE date BETWEEN ? AND ?
      `, [startDateStr, endDateStr]);

      // Calculate growth rates
      const previousPeriodResult = dbInstance.exec(`
        SELECT 
          SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as prevSales,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as prevExpenses,
          SUM(CASE 
            WHEN type = 'sale' THEN amount 
            WHEN type = 'expense' THEN -amount 
            ELSE 0 
          END) as prevProfit
        FROM transactions 
        WHERE date BETWEEN ? AND ?
      `, [
        new Date(startDate.getTime() - (startDate.getTime() - now.getTime())).toISOString().split('T')[0],
        startDateStr
      ]);

      // Process the results
      const daily = result[0]?.values.map((row: any) => ({
        date: row[0],
        sales: row[1] || 0,
        expenses: row[2] || 0,
        profit: row[3] || 0
      })) || [];

      const payments = paymentResult[0]?.values.map((row: any) => ({
        name: row[0],
        amount: row[1] || 0
      })) || [];

      const summary = {
        totalSales: summaryResult[0]?.values[0][0] || 0,
        totalExpenses: summaryResult[0]?.values[0][1] || 0,
        totalProfit: summaryResult[0]?.values[0][2] || 0
      };

      const prevPeriod = {
        sales: previousPeriodResult[0]?.values[0][0] || 0,
        expenses: previousPeriodResult[0]?.values[0][1] || 0,
        profit: previousPeriodResult[0]?.values[0][2] || 0
      };

      // Calculate growth rates
      const calculateGrowthRate = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
      };

      const growth = {
        sales: calculateGrowthRate(summary.totalSales, prevPeriod.sales),
        expenses: calculateGrowthRate(summary.totalExpenses, prevPeriod.expenses),
        profit: calculateGrowthRate(summary.totalProfit, prevPeriod.profit)
      };

      // Load AI insights
      const financialInsights = await generateFinancialInsights();
      setInsights(financialInsights);

      setData({ daily, payments, summary });
      setGrowthRates(growth);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      if (!data) throw new Error('Data not loaded');
      setIsGeneratingPDF(true);
      await generatePDF(data, growthRates);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleMarkAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? {...n, is_read: true} : n)
    );
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 w-full max-w-4xl bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const profitMargin = data.summary.totalSales > 0 
    ? ((data.summary.totalSales - data.summary.totalExpenses) / data.summary.totalSales) * 100
    : 0;
  const netCashflow = data.summary.totalSales - data.summary.totalExpenses;

  return (
    <div className="space-y-4 p-4">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="rounded-lg border-gray-300 text-sm"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
        </div>
        <button
          onClick={handleExportPDF}
          disabled={isGeneratingPDF}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricsCard
          title="Sales Growth"
          amount={data.summary.totalSales}
          percentageChange={growthRates.sales}
          trend={growthRates.sales >= 0 ? 'up' : 'down'}
          theme="green"
          sparklineData={data.daily.map((d: any) => d.sales)}
        />
        <MetricsCard
          title="Expenses"
          amount={data.summary.totalExpenses}
          percentageChange={growthRates.expenses}
          trend={growthRates.expenses >= 0 ? 'up' : 'down'}
          theme="red"
          sparklineData={data.daily.map((d: any) => d.expenses)}
        />
        <MetricsCard
          title="Net Profit"
          amount={Math.abs(data.summary.totalProfit)}
          percentageChange={growthRates.profit}
          trend={growthRates.profit >= 0 ? 'up' : 'down'}
          theme="blue"
          subtitle={`${profitMargin.toFixed(1)}% margin`}
          sparklineData={data.daily.map((d: any) => d.profit)}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Daily Transactions Chart */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-base font-medium text-gray-900 mb-3">Daily Transactions</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => `₹${parseInt(value).toLocaleString()}`}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="sales" name="Sales" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Profit/Loss"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Distribution */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <h3 className="text-base font-medium text-gray-900 mb-3">Payment Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.payments}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#10B981"
                  label={({ name, percent }: { name: string; percent: number }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {data.payments.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => `₹${parseInt(value).toLocaleString()}`}
                  contentStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insights Panel */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-medium text-gray-900">AI Insights</h3>
            <button
              onClick={loadDashboardData}
              className="p-1.5 text-gray-400 hover:text-gray-500"
              title="Refresh Insights"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-600 max-h-48 overflow-y-auto">
              {insights || 'Loading insights...'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
