import db from '../db'; 
import { getSettings } from '../db/settings';
import OpenAI from 'openai';

const generateAIResponse = async (prompt: string): Promise<string> => {
  try {
    const settings = await getSettings();
    const { baseUrl, modelName, temperature, maxTokens, enabled } = settings.lmStudioSettings;

    if (!enabled) {
      throw new Error('LM Studio is not enabled. Please enable it in settings.');
    }

    const openai = new OpenAI({
      baseURL: baseUrl,
      apiKey: 'lm-studio',
      dangerouslyAllowBrowser: true
    });

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { 
          role: 'system', 
          content: 'You are a financial analysis AI assistant. Analyze data and provide insights.' 
        },
        { 
          role: 'user', 
          content: prompt 
        }
      ],
      temperature,
      max_tokens: maxTokens
    });

    return completion.choices[0].message.content || '';
  } catch (error) {
    console.error('Error getting AI response:', error); 
    throw error;
  }
};

interface PaymentMode {
  mode: string;
  amount: number;
  count: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  count: number;
}

export const generateFinancialInsights = async () => {
  try {
    const dbInstance = await db.init();
    
    // Get current date and calculate date ranges
    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const lastMonth = new Date(now.setMonth(now.getMonth() - 1)).toISOString().slice(0, 7);
    const lastYear = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().slice(0, 7);

    // Fetch current month metrics
    const currentMonthMetrics = await dbInstance.exec(`
      SELECT 
        SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as sales,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN type = 'sale' AND payment_mode = 'credit' THEN amount ELSE 0 END) as credit_sales,
        COUNT(DISTINCT CASE WHEN type = 'sale' THEN party_id END) as active_customers,
        COUNT(DISTINCT CASE WHEN type = 'bill' THEN party_id END) as active_suppliers
      FROM transactions
      WHERE strftime('%Y-%m', date) = ?
    `, [currentMonth]);

    // Fetch last month metrics for comparison
    const lastMonthMetrics = await dbInstance.exec(`
      SELECT 
        SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as sales,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE strftime('%Y-%m', date) = ?
    `, [lastMonth]);

    // Fetch last year same month for YoY comparison
    const lastYearMetrics = await dbInstance.exec(`
      SELECT 
        SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as sales,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE strftime('%Y-%m', date) = ?
    `, [lastYear]);

    // Get top 5 expense categories
    const topExpenses = await dbInstance.exec(`
      SELECT 
        expense_category,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE type = 'expense'
      AND strftime('%Y-%m', date) = ?
      GROUP BY expense_category
      ORDER BY total_amount DESC
      LIMIT 5
    `, [currentMonth]);

    // Get payment mode distribution
    const paymentModes = await dbInstance.exec(`
      SELECT 
        payment_mode,
        SUM(amount) as total_amount,
        COUNT(*) as transaction_count
      FROM transactions
      WHERE type = 'sale'
      AND strftime('%Y-%m', date) = ?
      GROUP BY payment_mode
    `, [currentMonth]);

    // Calculate key metrics
    const current = currentMonthMetrics[0]?.values[0] || [];
    const lastM = lastMonthMetrics[0]?.values[0] || [];
    const lastY = lastYearMetrics[0]?.values[0] || [];

    const metrics = {
      currentMonth: {
        sales: current[0] || 0,
        expenses: current[1] || 0,
        creditSales: current[2] || 0,
        activeCustomers: current[3] || 0,
        activeSuppliers: current[4] || 0,
        profit: (current[0] || 0) - (current[1] || 0),
        profitMargin: current[0] ? ((current[0] - current[1]) / current[0] * 100) : 0
      },
      monthOverMonth: {
        salesGrowth: lastM[0] ? ((current[0] - lastM[0]) / lastM[0] * 100) : 0,
        expenseGrowth: lastM[1] ? ((current[1] - lastM[1]) / lastM[1] * 100) : 0,
        profitGrowth: lastM[0] ? (((current[0] - current[1]) - (lastM[0] - lastM[1])) / (lastM[0] - lastM[1]) * 100) : 0
      },
      yearOverYear: {
        salesGrowth: lastY[0] ? ((current[0] - lastY[0]) / lastY[0] * 100) : 0,
        expenseGrowth: lastY[1] ? ((current[1] - lastY[1]) / lastY[1] * 100) : 0,
        profitGrowth: lastY[0] ? (((current[0] - current[1]) - (lastY[0] - lastY[1])) / (lastY[0] - lastY[1]) * 100) : 0
      },
      topExpenses: topExpenses[0]?.values.map((row: any) => ({
        category: row[0],
        amount: row[1],
        count: row[2]
      })) || [],
      paymentModes: paymentModes[0]?.values.map((row: any) => ({
        mode: row[0],
        amount: row[1],
        count: row[2]
      })) || []
    };

    // Generate insights based on actual data
    let insights = '';

    // 1. Overall Performance
    insights += `📊 Monthly Performance Summary:\n\n`;
    insights += `Sales: ₹${metrics.currentMonth.sales.toLocaleString()}\n`;
    insights += `Expenses: ₹${metrics.currentMonth.expenses.toLocaleString()}\n`;
    insights += `Profit: ₹${metrics.currentMonth.profit.toLocaleString()} (${metrics.currentMonth.profitMargin.toFixed(1)}% margin)\n\n`;

    // 2. Growth Analysis
    insights += `📈 Growth Analysis:\n\n`;
    insights += `Month-over-Month:\n`;
    insights += `- Sales: ${metrics.monthOverMonth.salesGrowth > 0 ? '↑' : '↓'} ${Math.abs(metrics.monthOverMonth.salesGrowth).toFixed(1)}%\n`;
    insights += `- Expenses: ${metrics.monthOverMonth.expenseGrowth > 0 ? '↑' : '↓'} ${Math.abs(metrics.monthOverMonth.expenseGrowth).toFixed(1)}%\n`;
    insights += `- Profit: ${metrics.monthOverMonth.profitGrowth > 0 ? '↑' : '↓'} ${Math.abs(metrics.monthOverMonth.profitGrowth).toFixed(1)}%\n\n`;

    insights += `Year-over-Year:\n`;
    insights += `- Sales: ${metrics.yearOverYear.salesGrowth > 0 ? '↑' : '↓'} ${Math.abs(metrics.yearOverYear.salesGrowth).toFixed(1)}%\n`;
    insights += `- Expenses: ${metrics.yearOverYear.expenseGrowth > 0 ? '↑' : '↓'} ${Math.abs(metrics.yearOverYear.expenseGrowth).toFixed(1)}%\n`;
    insights += `- Profit: ${metrics.yearOverYear.profitGrowth > 0 ? '↑' : '↓'} ${Math.abs(metrics.yearOverYear.profitGrowth).toFixed(1)}%\n\n`;

    // 3. Key Observations
    insights += `🔍 Key Observations:\n\n`;
    
    // Sales Mix
    const creditPercentage = (metrics.currentMonth.creditSales / metrics.currentMonth.sales * 100) || 0;
    insights += `Credit Sales: ${creditPercentage.toFixed(1)}% of total sales\n`;
    
    // Payment Modes
    insights += `Payment Distribution:\n`;
    metrics.paymentModes.forEach((mode: PaymentMode) => {
      const percentage = (mode.amount / metrics.currentMonth.sales * 100) || 0;
      insights += `- ${mode.mode}: ${percentage.toFixed(1)}%\n`;
    });
    
    // Top Expenses
    insights += `\nMajor Expense Categories:\n`;
    metrics.topExpenses.forEach((exp: ExpenseCategory) => {
      const percentage = (exp.amount / metrics.currentMonth.expenses * 100) || 0;
      insights += `- ${exp.category}: ₹${exp.amount.toLocaleString()} (${percentage.toFixed(1)}%)\n`;
    });

    // 4. Actionable Recommendations
    insights += `\n💡 Recommendations:\n\n`;
    
    // Sales recommendations
    if (metrics.monthOverMonth.salesGrowth < 0) {
      insights += `Sales Strategy:\n`;
      insights += `- Investigate the ${Math.abs(metrics.monthOverMonth.salesGrowth).toFixed(1)}% sales decline\n`;
      insights += `- Focus on customer retention and reactivation\n`;
    }
    
    // Credit management
    if (creditPercentage > 30) {
      insights += `Credit Management:\n`;
      insights += `- Review credit policy as credit sales are ${creditPercentage.toFixed(1)}% of total sales\n`;
      insights += `- Implement stronger collection measures\n`;
    }
    
    // Expense management
    if (metrics.monthOverMonth.expenseGrowth > metrics.monthOverMonth.salesGrowth) {
      insights += `Expense Control:\n`;
      insights += `- Expenses growing faster than sales (${metrics.monthOverMonth.expenseGrowth.toFixed(1)}% vs ${metrics.monthOverMonth.salesGrowth.toFixed(1)}%)\n`;
      insights += `- Review and optimize top expense categories\n`;
    }

    // 5. Business Health Indicators
    insights += `\n🏢 Business Health Indicators:\n\n`;
    insights += `- Active Customers: ${metrics.currentMonth.activeCustomers}\n`;
    insights += `- Active Suppliers: ${metrics.currentMonth.activeSuppliers}\n`;
    insights += `- Average Transaction Size: ₹${(metrics.currentMonth.sales / metrics.paymentModes.reduce((sum: number, mode: PaymentMode) => sum + mode.count, 0)).toFixed(0)}\n`;

    return insights;

  } catch (error) {
    console.error('Error generating financial insights:', error);
    throw error;
  }
};

export const assessFinancialRisk = async () => {
  try {
    const dbInstance = await db.init();
    
    // Get current metrics
    const currentMetrics = await dbInstance.exec(`
      SELECT 
        SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END) as total_sales,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
        COUNT(DISTINCT party_id) as active_parties
      FROM transactions
      WHERE date >= date('now', '-30 days')
    `);

    // Format data for AI analysis
    const metricsData = {
      sales: currentMetrics[0]?.values[0][0] || 0,
      expenses: currentMetrics[0]?.values[0][1] || 0,
      activeParties: currentMetrics[0]?.values[0][2] || 0
    };

    // Generate AI assessment
    const prompt = `
      Assess the financial risk based on these metrics:
      ${JSON.stringify(metricsData, null, 2)}
      
      Provide:
      1. Risk level assessment
      2. Key risk factors
      3. Mitigation strategies
      4. Recommendations
    `;

    const assessment = await generateAIResponse(prompt);
    return assessment;

  } catch (error) {
    console.error('Error assessing financial risk:', error);
    return analyzeRiskMetrics(currentMetrics[0]?.values || []);
  }
};

export const generateRecommendations = async () => {
  try {
    const insights = await generateFinancialInsights();
    const riskAssessment = await assessFinancialRisk();

    return {
      insights,
      riskAssessment,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
};

// Fallback analysis functions
function analyzeTransactionData(data: any[]) {
  let insights = '';
  
  if (data.length === 0) {
    return 'No transaction data available for analysis.';
  }

  // Calculate trends
  const totalSales = data.reduce((sum, row) => sum + (row[1] || 0), 0);
  const totalExpenses = data.reduce((sum, row) => sum + (row[2] || 0), 0);
  const netProfit = totalSales - totalExpenses;
  const profitMargin = (netProfit / totalSales) * 100;

  insights += `Financial Summary:\n`;
  insights += `- Total Sales: ₹${totalSales.toLocaleString()}\n`;
  insights += `- Total Expenses: ₹${totalExpenses.toLocaleString()}\n`;
  insights += `- Net Profit: ₹${netProfit.toLocaleString()}\n`;
  insights += `- Profit Margin: ${profitMargin.toFixed(1)}%\n\n`;

  // Analyze trends
  const monthlyTrend = calculateMonthlyTrend(data);
  insights += `Trend Analysis:\n${monthlyTrend}\n`;

  return insights;
}

function analyzeRiskMetrics(data: any[]) {
  if (data.length === 0) {
    return 'No data available for risk assessment.';
  }

  const [totalSales, totalExpenses, activeParties] = data[0];
  let assessment = '';

  // Calculate risk indicators
  const profitMargin = ((totalSales - totalExpenses) / totalSales) * 100;
  const riskLevel = getRiskLevel(profitMargin, activeParties);

  assessment += `Risk Assessment:\n`;
  assessment += `- Risk Level: ${riskLevel}\n`;
  assessment += `- Profit Margin: ${profitMargin.toFixed(1)}%\n`;
  assessment += `- Active Parties: ${activeParties}\n\n`;

  // Add recommendations
  assessment += generateRiskRecommendations(riskLevel, profitMargin, activeParties);

  return assessment;
}

function calculateMonthlyTrend(data: any[]) {
  if (data.length < 2) return 'Insufficient data for trend analysis.';

  const trend = data.map((row, i) => {
    if (i === 0) return null;
    const currentSales = row[1] || 0;
    const previousSales = data[i - 1][1] || 0;
    const change = ((currentSales - previousSales) / previousSales) * 100;
    return { month: row[0], change };
  }).filter(t => t !== null);

  let trendAnalysis = 'Monthly Sales Trends:\n';
  trend.forEach(t => {
    trendAnalysis += `- ${t.month}: ${t.change > 0 ? '↑' : '↓'} ${Math.abs(t.change).toFixed(1)}%\n`;
  });

  return trendAnalysis;
}

function getRiskLevel(profitMargin: number, activeParties: number): string {
  if (profitMargin < 0) return 'High Risk';
  if (profitMargin < 10) return 'Medium Risk';
  if (activeParties < 5) return 'Medium Risk';
  return 'Low Risk';
}

function generateRiskRecommendations(
  riskLevel: string,
  profitMargin: number,
  activeParties: number
): string {
  let recommendations = 'Recommendations:\n';

  if (riskLevel === 'High Risk') {
    recommendations += '- Urgent: Review pricing strategy\n';
    recommendations += '- Implement cost reduction measures\n';
    recommendations += '- Consider diversifying customer base\n';
  } else if (riskLevel === 'Medium Risk') {
    recommendations += '- Monitor cash flow closely\n';
    recommendations += '- Focus on customer retention\n';
    recommendations += '- Look for efficiency improvements\n';
  } else {
    recommendations += '- Maintain current strategies\n';
    recommendations += '- Consider expansion opportunities\n';
    recommendations += '- Build emergency reserves\n';
  }

  return recommendations;
}
