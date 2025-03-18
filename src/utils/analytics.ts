import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import db from '../lib/db';

interface AnalyticsData {
  trends: {
    sales: number[];
    expenses: number[];
    profit: number[];
    dates: string[];
  };
  predictions: {
    nextMonth: {
      sales: number;
      expenses: number;
      profit: number;
    };
    confidence: number;
  };
  patterns: {
    peakDays: string[];
    lowDays: string[];
    averageTransaction: number;
  };
  inventory: {
    turnoverRate: number;
    fastMoving: string[];
    slowMoving: string[];
  };
}

export const generateAnalytics = async (startDate: string, endDate: string): Promise<AnalyticsData> => {
  const dbInstance = await db.init();
  
  // Get historical data
  const result = await dbInstance.exec(`
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
  `, [startDate, endDate]);

  const trends = {
    sales: [],
    expenses: [],
    profit: [],
    dates: []
  };

  if (result.length > 0) {
    result[0].values.forEach((row: any[]) => {
      trends.dates.push(row[0]);
      trends.sales.push(row[1] || 0);
      trends.expenses.push(row[2] || 0);
      trends.profit.push(row[3] || 0);
    });
  }

  // Calculate predictions using simple moving average
  const predictions = calculatePredictions(trends);

  // Analyze patterns
  const patterns = await analyzePatterns(dbInstance, startDate, endDate);

  // Analyze inventory
  const inventory = await analyzeInventory(dbInstance, startDate, endDate);

  return {
    trends,
    predictions,
    patterns,
    inventory
  };
};

const calculatePredictions = (trends: any) => {
  const windowSize = 7; // 7-day moving average
  const salesMA = calculateMovingAverage(trends.sales, windowSize);
  const expensesMA = calculateMovingAverage(trends.expenses, windowSize);
  const profitMA = calculateMovingAverage(trends.profit, windowSize);

  return {
    nextMonth: {
      sales: Math.round(salesMA[salesMA.length - 1] * 30), // Projected monthly
      expenses: Math.round(expensesMA[expensesMA.length - 1] * 30),
      profit: Math.round(profitMA[profitMA.length - 1] * 30)
    },
    confidence: calculateConfidence(trends.sales, salesMA)
  };
};

const calculateMovingAverage = (data: number[], window: number): number[] => {
  const result = [];
  for (let i = window - 1; i < data.length; i++) {
    const sum = data.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
    result.push(sum / window);
  }
  return result;
};

const calculateConfidence = (actual: number[], predicted: number[]): number => {
  // Calculate R-squared value
  const actualMean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const totalSS = actual.reduce((a, b) => a + Math.pow(b - actualMean, 2), 0);
  const residualSS = actual.slice(predicted.length * -1).reduce((a, b, i) => 
    a + Math.pow(b - predicted[i], 2), 0
  );
  return Math.max(0, Math.min(100, (1 - residualSS / totalSS) * 100));
};

const analyzePatterns = async (dbInstance: any, startDate: string, endDate: string) => {
  const result = await dbInstance.exec(`
    SELECT 
      strftime('%w', date) as day_of_week,
      AVG(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as avg_sales
    FROM transactions 
    WHERE date BETWEEN ? AND ?
    GROUP BY day_of_week
    ORDER BY avg_sales DESC
  `, [startDate, endDate]);

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const avgTransaction = await dbInstance.exec(`
    SELECT AVG(amount) FROM transactions 
    WHERE type = 'sale' AND date BETWEEN ? AND ?
  `, [startDate, endDate]);

  return {
    peakDays: result[0].values.slice(0, 2).map((row: any[]) => daysOfWeek[row[0]]),
    lowDays: result[0].values.slice(-2).map((row: any[]) => daysOfWeek[row[0]]),
    averageTransaction: Math.round(avgTransaction[0].values[0][0] || 0)
  };
};

const analyzeInventory = async (dbInstance: any, startDate: string, endDate: string) => {
  // This is a placeholder - in a real system, you'd have inventory tracking
  return {
    turnoverRate: 0,
    fastMoving: [],
    slowMoving: []
  };
};

export const generateReport = async (
  startDate: string, 
  endDate: string,
  format: 'pdf' | 'excel' = 'pdf'
) => {
  const analytics = await generateAnalytics(startDate, endDate);
  
  // Implementation for report generation would go here
  // This would use the analytics data to create comprehensive reports
  // in the requested format
};
