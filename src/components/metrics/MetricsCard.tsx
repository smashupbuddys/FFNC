import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { SparkLineChart } from './SparkLineChart';

interface MetricsCardProps {
  title: string;
  amount: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'neutral';
  theme: 'red' | 'green' | 'blue' | 'purple';
  subtitle?: string;
  breakdown?: { label: string; value: number }[];
  sparklineData?: number[];
}

const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  amount,
  percentageChange,
  trend,
  theme,
  subtitle,
  breakdown,
  sparklineData
}) => {
  const themeColors = {
    red: 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100',
    green: 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100',
    blue: 'bg-gradient-to-br from-blue-50 to-sky-50 border-blue-100',
    purple: 'bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100'
  };

  const textColors = {
    red: 'text-red-700',
    green: 'text-green-700',
    blue: 'text-blue-700',
    purple: 'text-purple-700'
  };

  const iconColors = {
    red: 'bg-red-100 text-red-600',
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600'
  };

  return (
    <div className={`rounded-xl border p-5 ${themeColors[theme]} backdrop-blur-sm shadow-sm hover:shadow transition-all duration-300`}>
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium opacity-75">{title}</h3>
          <div className="mt-2 flex items-baseline">
            <p className={`text-2xl font-semibold ${textColors[theme]}`}>
              ₹{amount.toLocaleString()}
            </p>
            <p className={`ml-2 text-sm flex items-center ${
              trend === 'up' ? 'text-green-600' : 
              trend === 'down' ? 'text-red-600' : 
              'text-gray-500'
            }`}>
              {trend === 'up' ? <ArrowUp className="w-4 h-4" /> : 
               trend === 'down' ? <ArrowDown className="w-4 h-4" /> : null}
              {Math.abs(percentageChange).toFixed(1)}%
            </p>
          </div>
          {subtitle && (
            <p className="mt-1 text-sm opacity-75">{subtitle}</p>
          )}
        </div>
        {sparklineData && (
          <div className="w-24 h-12">
            <SparkLineChart data={sparklineData} color={theme} />
          </div>
        )}
      </div>
      {breakdown && (
        <div className="mt-4 space-y-1 pt-3 border-t border-gray-200">
          {breakdown.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="opacity-75">{item.label}</span>
              <span className="font-medium">₹{item.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MetricsCard;
