import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string;
  delta?: {
    value: string;
    type: 'increase' | 'decrease' | 'pending';
  };
}

const StatCard: React.FC<StatCardProps> = ({ label, value, delta }) => {
  return (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow transition-all duration-300">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
      {delta && (
        <div className="mt-2 flex items-center">
          {delta.type === 'increase' ? (
            <div className="p-1 rounded-full bg-green-100">
              <ArrowUpRight className="w-4 h-4 text-green-500" />
            </div>
          ) : delta.type === 'decrease' ? (
            <div className="p-1 rounded-full bg-red-100">
              <ArrowDownRight className="w-4 h-4 text-red-500" />
            </div>
          ) : null}
          <span
            className={`ml-2 text-sm font-medium ${
              delta.type === 'increase'
                ? 'text-green-600'
                : delta.type === 'decrease'
                ? 'text-red-600'
                : 'text-gray-600'
            }`}
          >
            {delta.value}
          </span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
