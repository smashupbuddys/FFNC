import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Calendar, AlertCircle, CheckCircle2, Coins, X, Calculator, IndianRupee, PiggyBank, Building2 } from 'lucide-react';
import db from '../../lib/db';

interface Goal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'achieved' | 'at_risk';
  rentalIncome?: number;
  rentalStartDate?: string;
  completionDate?: string;
  linkedGoals?: string[];
  created_at: string;
  loanAmount?: number;
  interestRate?: number;
  loanTerm?: number;
}

const FinancialGoals: React.FC = () => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cashFlow, setCashFlow] = useState({
    monthlyIncome: 0,
    monthlyExpenses: 0,
    savingsPotential: 0
  });
  const [newGoal, setNewGoal] = useState({
    title: '',
    targetAmount: '',
    deadline: '',
    priority: 'medium' as const,
    useLoan: false,
    loanAmount: '',
    interestRate: '12', 
    loanTerm: '36',
    rentalIncome: '',
    rentalStartDate: '',
    linkedGoals: []
  });

  const [showCalculator, setShowCalculator] = useState(false);
  const [calculatorInputs, setCalculatorInputs] = useState({
    targetAmount: '',
    deadline: '',
    currentSavings: '',
    monthlyIncome: '',
    monthlyExpenses: '',
    interestRate: '12',
    inflationRate: '6',
    expectedReturn: '12'
  });

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [showRiskAnalysis, setShowRiskAnalysis] = useState(false);
  const [riskFactors, setRiskFactors] = useState({
    marketVolatility: 'medium',
    economicConditions: 'stable',
    businessCycle: 'growth'
  });

  useEffect(() => {
    loadGoals();
    analyzeCashFlow();
  }, []);

  const loadGoals = async () => {
    try {
      const dbInstance = await db.init();
      
      // Create goals table if it doesn't exist
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS financial_goals (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          target_amount DECIMAL(12,2) NOT NULL,
          current_amount DECIMAL(12,2) DEFAULT 0,
          deadline DATE NOT NULL,
          loan_amount DECIMAL(12,2),
          interest_rate DECIMAL(5,2),
          loan_term INTEGER,
          priority TEXT CHECK(priority IN ('high', 'medium', 'low')),
          status TEXT CHECK(status IN ('active', 'achieved', 'at_risk')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const result = dbInstance.exec(`
        SELECT * FROM financial_goals 
        ORDER BY 
          status DESC,
          CASE priority
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
          END,
          deadline
      `);

      if (result.length > 0) {
        const goalsData = result[0].values.map(row => ({
          id: row[0],
          title: row[1],
          targetAmount: row[2],
          currentAmount: row[3],
          deadline: row[4],
          priority: row[5],
          status: row[6],
          loanAmount: row[7],
          interestRate: row[8],
          loanTerm: row[9],
          created_at: row[7]
        }));
        setGoals(goalsData);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const analyzeCashFlow = async () => {
    try {
      const dbInstance = await db.init();
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const result = dbInstance.exec(`
        SELECT 
          COALESCE(SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
        FROM transactions 
        WHERE date BETWEEN ? AND ?
      `, [
        firstDayOfMonth.toISOString().split('T')[0],
        lastDayOfMonth.toISOString().split('T')[0]
      ]);

      if (result.length > 0) {
        const [income, expenses] = result[0].values[0];
        const savingsPotential = income - expenses;
        setCashFlow({
          monthlyIncome: income,
          monthlyExpenses: expenses,
          savingsPotential: savingsPotential
        });
      }
    } catch (error) {
      console.error('Error analyzing cash flow:', error);
    }
  };

  const handleAddGoal = async () => {
    if (!newGoal.title || !newGoal.targetAmount || !newGoal.deadline) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const dbInstance = await db.init();
      const id = Math.random().toString(36).substring(2, 15);

      // Calculate monthly savings needed
      const monthsToGoal = Math.ceil(
        (new Date(newGoal.deadline).getTime() - new Date().getTime()) / 
        (1000 * 60 * 60 * 24 * 30)
      );

      let monthlySavingsNeeded = parseFloat(newGoal.targetAmount) / monthsToGoal;
      let loanAmount = null;
      let interestRate = null;
      let loanTerm = null;

      // If using loan, calculate adjusted savings needed
      if (newGoal.useLoan) {
        loanAmount = parseFloat(newGoal.loanAmount);
        interestRate = parseFloat(newGoal.interestRate);
        loanTerm = parseInt(newGoal.loanTerm);

        // Calculate EMI
        const monthlyRate = interestRate / 12 / 100;
        const emi = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, loanTerm) / 
                   (Math.pow(1 + monthlyRate, loanTerm) - 1);

        // Adjust savings needed
        monthlySavingsNeeded = (parseFloat(newGoal.targetAmount) - loanAmount) / monthsToGoal + emi;
      }
      
      const status = monthlySavingsNeeded <= cashFlow.savingsPotential ? 'active' : 'at_risk';

      await dbInstance.run(`
        INSERT INTO financial_goals (
          id, title, target_amount, current_amount, deadline, 
          priority, status, loan_amount, interest_rate, loan_term, created_at
        ) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
        
        -- Insert rental income if specified
        INSERT INTO goal_rental_income (
          goal_id, monthly_amount, start_date
        ) VALUES (?, ?, ?);
        
        -- Insert linked goals
        INSERT INTO goal_dependencies (
          goal_id, dependent_goal_id
        ) VALUES ${newGoal.linkedGoals.map(() => '(?, ?)').join(', ')}
      `, [
        id,
        newGoal.title,
        parseFloat(newGoal.targetAmount),
        newGoal.deadline,
        newGoal.priority,
        status,
        loanAmount,
        interestRate,
        loanTerm,
        // Rental income params
        id,
        newGoal.rentalIncome || null,
        newGoal.rentalStartDate || null,
        // Linked goals params
        ...newGoal.linkedGoals.flatMap(goalId => [id, goalId])
      ]);

      setShowAddModal(false);
      setNewGoal({
        title: '',
        targetAmount: '',
        deadline: '',
        priority: 'medium',
        useLoan: false,
        loanAmount: '',
        interestRate: '12',
        loanTerm: '36'
      });
      await loadGoals();
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('Error adding goal. Please try again.');
    }
  };

  const calculateRecommendations = (inputs: typeof calculatorInputs) => {
    const {
      targetAmount,
      deadline,
      currentSavings,
      monthlyIncome, monthlyExpenses,
      interestRate, inflationRate, expectedReturn
    } = inputs;

    const amount = parseFloat(targetAmount);
    const months = Math.ceil(
      (new Date(deadline).getTime() - new Date().getTime()) /
      (1000 * 60 * 60 * 24 * 30)
    );
    const savings = parseFloat(currentSavings);
    const income = parseFloat(monthlyIncome);
    const expenses = parseFloat(monthlyExpenses);
    const rate = parseFloat(interestRate) / 100 / 12;
    const inflationAdjustedReturn = (parseFloat(expectedReturn) - parseFloat(inflationRate)) / 100 / 12;

    const monthlySavingCapacity = income - expenses;
    const remainingAmount = amount - savings;
    
    // Calculate inflation-adjusted required savings
    const inflationAdjustedAmount = amount * Math.pow(1 + parseFloat(inflationRate) / 100, months / 12);
    const requiredMonthlySavings = (inflationAdjustedAmount - savings) / months;

    let recommendations = [];

    // Pure savings approach
    recommendations.push({
      type: 'savings',
      monthlySavings: requiredMonthlySavings,
      inflationAdjustedTotal: inflationAdjustedAmount,
      feasibility: requiredMonthlySavings <= monthlySavingCapacity ? 'high' : 'low'
    });
    const investmentScenario = {
      type: 'investment',
      monthlySavings: requiredMonthlySavings * 0.8, // 20% less monthly savings needed
      expectedReturns: remainingAmount * inflationAdjustedReturn * months,
      feasibility: (requiredMonthlySavings * 0.8) <= monthlySavingCapacity ? 'high' : 'low'
    };
    recommendations.push(investmentScenario);

    // Loan + savings approach
    const loanScenarios = [0.3, 0.5, 0.7].map(ratio => {
      const loanAmount = remainingAmount * ratio;
      const emi = loanAmount * rate * Math.pow(1 + rate, 36) / (Math.pow(1 + rate, 36) - 1);
      const savingsNeeded = (remainingAmount - loanAmount) / months;
      
      return {
        type: 'hybrid',
        loanRatio: ratio * 100,
        loanAmount,
        emi,
        monthlySavings: savingsNeeded,
        totalMonthly: emi + savingsNeeded,
        feasibility: (emi + savingsNeeded) <= monthlySavingCapacity ? 'high' : 'low'
      };
    });

    return [...recommendations, ...loanScenarios];
  };

  const calculateRiskScore = (factors: typeof riskFactors) => {
    const scores = {
      marketVolatility: { high: 3, medium: 2, low: 1 },
      economicConditions: { unstable: 3, mixed: 2, stable: 1 },
      businessCycle: { recession: 3, stable: 2, growth: 1 }
    };

    const totalScore = 
      scores.marketVolatility[factors.marketVolatility as keyof typeof scores.marketVolatility] +
      scores.economicConditions[factors.economicConditions as keyof typeof scores.economicConditions] +
      scores.businessCycle[factors.businessCycle as keyof typeof scores.businessCycle];

    return {
      score: totalScore,
      level: totalScore <= 4 ? 'low' : totalScore <= 7 ? 'medium' : 'high',
      adjustedInterestRate: calculatorInputs.interestRate * (1 + (totalScore - 4) * 0.1)
    };
  };
  const getRecommendation = (goal: Goal) => {
    const monthlyNeeded = goal.targetAmount / 
      Math.max(1, Math.ceil(
        (new Date(goal.deadline).getTime() - new Date().getTime()) / 
        (1000 * 60 * 60 * 24 * 30)
      ));

    if (monthlyNeeded > cashFlow.savingsPotential) {
      return {
        type: 'warning',
        message: `Based on current cash flow, this goal might be challenging. Consider:
          • Extending the deadline
          • Reducing target amount
          • Finding additional income sources`
      };
    } else if (monthlyNeeded > cashFlow.savingsPotential * 0.7) {
      return {
        type: 'caution',
        message: 'This goal is achievable but will require strict financial discipline'
      };
    } else {
      return {
        type: 'success',
        message: 'This goal is well within your current saving capacity'
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Financial Goals</h2>
          <p className="mt-1 text-sm text-gray-500">Track and manage your financial objectives</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Target className="w-4 h-4 mr-2" />
          Set New Goal
        </button>
      </div>

      {/* Cash Flow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Income</p>
              <p className="mt-2 text-2xl font-semibold text-green-600">
                ₹{cashFlow.monthlyIncome.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Expenses</p>
              <p className="mt-2 text-2xl font-semibold text-red-600">
                ₹{cashFlow.monthlyExpenses.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <Coins className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Savings Potential</p>
              <p className="mt-2 text-2xl font-semibold text-blue-600">
                ₹{cashFlow.savingsPotential.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Goals List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map(goal => {
          const recommendation = getRecommendation(goal);
          const progress = (goal.currentAmount / goal.targetAmount) * 100;
          const daysLeft = Math.ceil(
            (new Date(goal.deadline).getTime() - new Date().getTime()) / 
            (1000 * 60 * 60 * 24)
          );

          return (
            <div key={goal.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{goal.title}</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Target: ₹{goal.targetAmount.toLocaleString()}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    goal.priority === 'high' 
                      ? 'bg-red-100 text-red-800'
                      : goal.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {goal.priority.charAt(0).toUpperCase() + goal.priority.slice(1)}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Progress</span>
                    <span className="font-medium text-gray-900">{progress.toFixed(1)}%</span>
                  </div>
                  <div className="mt-2 relative">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-1.5" />
                  {daysLeft > 0 
                    ? `${daysLeft} days left`
                    : 'Deadline passed'
                  }
                </div>

                <div className={`mt-4 p-3 rounded-lg text-sm ${
                  recommendation.type === 'warning'
                    ? 'bg-red-50 text-red-700'
                    : recommendation.type === 'caution'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-green-50 text-green-700'
                }`}>
                  <div className="flex items-start">
                    {recommendation.type === 'warning' ? (
                      <AlertCircle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
                    ) : recommendation.type === 'caution' ? (
                      <AlertCircle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
                    )}
                    <p>{recommendation.message}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Goal Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Set New Financial Goal</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="e.g., New Machine Purchase"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Target Amount
                </label>
                <div className="mt-1 relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">₹</span>
                  </div>
                  <input
                    type="number"
                    value={newGoal.targetAmount}
                    onChange={(e) => setNewGoal({ ...newGoal, targetAmount: e.target.value })}
                    className="block w-full pl-7 pr-12 rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Loan Options */}
              <div className="mt-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useLoan"
                    checked={newGoal.useLoan}
                    onChange={(e) => setNewGoal({ ...newGoal, useLoan: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useLoan" className="ml-2 block text-sm text-gray-900">
                    Include Loan in Planning
                  </label>
                </div>

                {newGoal.useLoan && (
                  <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Loan Amount
                      </label>
                      <div className="mt-1 relative rounded-lg shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 sm:text-sm">₹</span>
                        </div>
                        <input
                          type="number"
                          value={newGoal.loanAmount}
                          onChange={(e) => setNewGoal({ ...newGoal, loanAmount: e.target.value })}
                          className="block w-full pl-7 pr-12 rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Interest Rate (% per year)
                      </label>
                      <input
                        type="number"
                        value={newGoal.interestRate}
                        onChange={(e) => setNewGoal({ ...newGoal, interestRate: e.target.value })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="12.00"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Loan Term (months)
                      </label>
                      <input
                        type="number"
                        value={newGoal.loanTerm}
                        onChange={(e) => setNewGoal({ ...newGoal, loanTerm: e.target.value })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="36"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Target Date
                </label>
                <input
                  type="date"
                  value={newGoal.deadline}
                  onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Priority
                </label>
                <select
                  value={newGoal.priority}
                  onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value as 'high' | 'medium' | 'low' })}
                  className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleAddGoal}
                className="px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Set Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Calculator Modal */}
      <button
        onClick={() => setShowCalculator(true)}
        className="fixed bottom-6 right-6 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Calculator className="w-6 h-6" />
      </button>

      {showCalculator && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Goal Calculator</h3>
              <button
                onClick={() => setShowCalculator(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[calc(100vh-12rem)] overflow-y-auto">
              {/* Input Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Your Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Target Amount
                  </label>
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <IndianRupee className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={calculatorInputs.targetAmount}
                      onChange={(e) => setCalculatorInputs({
                        ...calculatorInputs,
                        targetAmount: e.target.value
                      })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter target amount"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Target Date
                  </label>
                  <input
                    type="date"
                    value={calculatorInputs.deadline}
                    onChange={(e) => setCalculatorInputs({
                      ...calculatorInputs,
                      deadline: e.target.value
                    })}
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Current Savings
                  </label>
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <PiggyBank className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={calculatorInputs.currentSavings}
                      onChange={(e) => setCalculatorInputs({
                        ...calculatorInputs,
                        currentSavings: e.target.value
                      })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter current savings"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Monthly Income
                  </label>
                  <input
                    type="number"
                    value={calculatorInputs.monthlyIncome}
                    onChange={(e) => setCalculatorInputs({
                      ...calculatorInputs,
                      monthlyIncome: e.target.value
                    })}
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter monthly income"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Monthly Expenses
                  </label>
                  <input
                    type="number"
                    value={calculatorInputs.monthlyExpenses}
                    onChange={(e) => setCalculatorInputs({
                      ...calculatorInputs,
                      monthlyExpenses: e.target.value
                    })}
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter monthly expenses"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Loan Interest Rate (% per year)
                  </label>
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building2 className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={calculatorInputs.interestRate}
                      onChange={(e) => {
                        setCalculatorInputs({
                          ...calculatorInputs,
                          interestRate: e.target.value
                        });
                      }}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter interest rate"
                      step="0.1"
                    />
                  </div>
                </div>

                {/* Advanced Options Toggle */}
                <button
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showAdvancedOptions ? 'Hide' : 'Show'} Advanced Options
                </button>

                {showAdvancedOptions && (
                  <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Inflation Rate (% per year)
                      </label>
                      <input
                        type="number"
                        value={calculatorInputs.inflationRate}
                        onChange={(e) => setCalculatorInputs({
                          ...calculatorInputs,
                          inflationRate: e.target.value
                        })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        step="0.1"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Expected Investment Return (% per year)
                      </label>
                      <input
                        type="number"
                        value={calculatorInputs.expectedReturn}
                        onChange={(e) => setCalculatorInputs({
                          ...calculatorInputs,
                          expectedReturn: e.target.value
                        })}
                        className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        step="0.1"
                      />
                    </div>

                    {/* Risk Analysis Section */}
                    <div className="mt-6">
                      <button
                        onClick={() => setShowRiskAnalysis(!showRiskAnalysis)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {showRiskAnalysis ? 'Hide' : 'Show'} Risk Analysis
                      </button>

                      {showRiskAnalysis && (
                        <div className="mt-4 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Market Volatility
                            </label>
                            <select
                              value={riskFactors.marketVolatility}
                              onChange={(e) => setRiskFactors({
                                ...riskFactors,
                                marketVolatility: e.target.value
                              })}
                              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Economic Conditions
                            </label>
                            <select
                              value={riskFactors.economicConditions}
                              onChange={(e) => setRiskFactors({
                                ...riskFactors,
                                economicConditions: e.target.value
                              })}
                              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                              <option value="stable">Stable</option>
                              <option value="mixed">Mixed</option>
                              <option value="unstable">Unstable</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700">
                              Business Cycle
                            </label>
                            <select
                              value={riskFactors.businessCycle}
                              onChange={(e) => setRiskFactors({
                                ...riskFactors,
                                businessCycle: e.target.value
                              })}
                              className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                              <option value="growth">Growth</option>
                              <option value="stable">Stable</option>
                              <option value="recession">Recession</option>
                            </select>
                          </div>

                          {/* Risk Analysis Results */}
                          {Object.values(riskFactors).every(Boolean) && (
                            <div className={`mt-4 p-4 rounded-lg ${
                              calculateRiskScore(riskFactors).level === 'low'
                                ? 'bg-green-50 border-green-200'
                                : calculateRiskScore(riskFactors).level === 'medium'
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <h6 className="font-medium text-gray-900">Risk Analysis</h6>
                              <div className="mt-2 space-y-1 text-sm">
                                <p>Risk Level: {calculateRiskScore(riskFactors).level}</p>
                                <p>Adjusted Interest Rate: {calculateRiskScore(riskFactors).adjustedInterestRate.toFixed(1)}%</p>
                                <p className="text-xs text-gray-500 mt-2">
                                  This analysis adjusts financial projections based on current market conditions
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendations Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Recommendations</h4>
                
                {Object.values(calculatorInputs).every(Boolean) && (
                  <div className="space-y-4">
                    {calculateRecommendations(calculatorInputs).map((rec, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg border ${
                          rec.feasibility === 'high'
                            ? 'bg-green-50 border-green-200'
                            : 'bg-yellow-50 border-yellow-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">
                            {rec.type === 'savings' ? 'Pure Savings Approach' : `${rec.loanRatio}% Loan + Savings`}
                          </h5>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            rec.feasibility === 'high'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {rec.feasibility === 'high' ? 'Recommended' : 'Challenging'}
                          </span>
                        </div>

                        {rec.type === 'savings' ? (
                          <p className="text-sm text-gray-600">
                            Required monthly savings: ₹{rec.monthlySavings.toLocaleString()}
                          </p>
                        ) : (
                          <div className="space-y-1 text-sm text-gray-600">
                            <p>Loan amount: ₹{rec.loanAmount.toLocaleString()}</p>
                            <p>Monthly EMI: ₹{rec.emi.toLocaleString()}</p>
                            <p>Additional monthly savings: ₹{rec.monthlySavings.toLocaleString()}</p>
                            <p className="font-medium">
                              Total monthly commitment: ₹{rec.totalMonthly.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Rental Income Section */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Expected Monthly Rental Income
                  </label>
                  <div className="mt-1 relative rounded-lg shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <IndianRupee className="w-4 h-4 text-gray-400" />
                    </div>
                    <input
                      type="number"
                      value={newGoal.rentalIncome}
                      onChange={(e) => setNewGoal({
                        ...newGoal,
                        rentalIncome: e.target.value
                      })}
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Enter expected rental income"
                    />
                  </div>
                </div>

                {newGoal.rentalIncome && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Rental Income Start Date
                    </label>
                    <input
                      type="date"
                      value={newGoal.rentalStartDate}
                      onChange={(e) => setNewGoal({
                        ...newGoal,
                        rentalStartDate: e.target.value
                      })}
                      className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                )}

                {/* Linked Goals Section */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Linked Goals
                  </label>
                  <select
                    multiple
                    value={newGoal.linkedGoals}
                    onChange={(e) => setNewGoal({
                      ...newGoal,
                      linkedGoals: Array.from(e.target.selectedOptions, option => option.value)
                    })}
                    className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {goals
                      .filter(g => g.status !== 'achieved')
                      .map(g => (
                        <option key={g.id} value={g.id}>
                          {g.title} (₹{g.targetAmount.toLocaleString()})
                        </option>
                      ))
                    }
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Hold Ctrl/Cmd to select multiple goals
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialGoals
