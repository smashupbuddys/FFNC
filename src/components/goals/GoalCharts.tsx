import React from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, Area, ComposedChart 
} from 'recharts';

interface GoalChartsProps {
  goal: {
    targetAmount: number;
    currentAmount: number;
    deadline: string;
    loanAmount?: number;
    interestRate?: number;
    loanTerm?: number;
    rentalIncome?: number;
  };
  projectedData: Array<{
    month: string;
    savings: number;
    loanPayment?: number;
    rentalIncome?: number;
    cumulativeSavings: number;
    remainingLoan?: number;
  }>;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

export const GoalCharts: React.FC<GoalChartsProps> = ({ goal, projectedData }) => {
  // Calculate total returns including rental income
  const calculateTotalReturns = () => {
    if (!goal.rentalIncome) return 0;
    const monthsToGoal = Math.ceil(
      (new Date(goal.deadline).getTime() - new Date().getTime()) / 
      (1000 * 60 * 60 * 24 * 30)
    );
    return goal.rentalIncome * monthsToGoal;
  };

  // Calculate loan metrics
  const calculateLoanMetrics = () => {
    if (!goal.loanAmount || !goal.interestRate || !goal.loanTerm) return null;

    const monthlyRate = (goal.interestRate / 100) / 12;
    const emi = goal.loanAmount * monthlyRate * Math.pow(1 + monthlyRate, goal.loanTerm) / 
               (Math.pow(1 + monthlyRate, goal.loanTerm) - 1);
    const totalInterest = (emi * goal.loanTerm) - goal.loanAmount;

    return {
      monthlyEMI: emi,
      totalInterest,
      totalPayment: emi * goal.loanTerm
    };
  };

  const loanMetrics = calculateLoanMetrics();
  const totalReturns = calculateTotalReturns();

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Progress Overview</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={projectedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value: any) => `₹${parseInt(value).toLocaleString()}`}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="cumulativeSavings"
                name="Total Progress"
                fill="#3B82F6"
                stroke="#3B82F6"
                fillOpacity={0.1}
              />
              <Bar
                dataKey="savings"
                name="Monthly Savings"
                fill="#10B981"
                radius={[4, 4, 0, 0]}
              />
              {goal.loanAmount && (
                <Bar
                  dataKey="loanPayment"
                  name="Loan EMI"
                  fill="#F59E0B"
                  radius={[4, 4, 0, 0]}
                />
              )}
              {goal.rentalIncome && (
                <Bar
                  dataKey="rentalIncome"
                  name="Rental Income"
                  fill="#8B5CF6"
                  radius={[4, 4, 0, 0]}
                />
              )}
              <Line
                type="monotone"
                dataKey="remainingLoan"
                name="Remaining Loan"
                stroke="#EF4444"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Financial Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Loan Analysis */}
        {loanMetrics && (
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Loan Analysis</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Principal', value: goal.loanAmount },
                      { name: 'Interest', value: loanMetrics.totalInterest }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {[0, 1].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => `₹${parseInt(value).toLocaleString()}`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Monthly EMI</p>
                <p className="text-lg font-semibold text-gray-900">
                  ₹{Math.round(loanMetrics.monthlyEMI).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Interest</p>
                <p className="text-lg font-semibold text-red-600">
                  ₹{Math.round(loanMetrics.totalInterest).toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Payment</p>
                <p className="text-lg font-semibold text-gray-900">
                  ₹{Math.round(loanMetrics.totalPayment).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Returns Analysis */}
        {goal.rentalIncome && (
          <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Returns Analysis</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any) => `₹${parseInt(value).toLocaleString()}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="rentalIncome"
                    name="Monthly Rental Income"
                    fill="#8B5CF6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Monthly Income</p>
                <p className="text-lg font-semibold text-purple-600">
                  ₹{goal.rentalIncome.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">Projected Total</p>
                <p className="text-lg font-semibold text-purple-600">
                  ₹{totalReturns.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
