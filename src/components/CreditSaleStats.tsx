import React from 'react';
import { IndianRupee, Users, Clock, AlertTriangle } from 'lucide-react';

interface CreditSaleStats {
  totalCredit: number;
  totalPaid: number;
  totalPending: number;
  activeCustomers: number;
  overduePayments: number;
  averagePaymentTime: number;
}

interface CreditSaleStatsProps {
  stats: CreditSaleStats;
}

const CreditSaleStats: React.FC<CreditSaleStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Credit */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Credit Given</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">
              ₹{stats.totalCredit.toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">
            <IndianRupee className="w-6 h-6 text-blue-600" />
          </div>
        </div>
        <div className="mt-4 flex justify-between text-sm">
          <span className="text-gray-500">Active Customers</span>
          <span className="font-medium text-gray-900">{stats.activeCustomers}</span>
        </div>
      </div>

      {/* Payment Status */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Collected</p>
            <p className="mt-2 text-2xl font-semibold text-green-600">
              ₹{stats.totalPaid.toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-green-100 rounded-full">
            <IndianRupee className="w-6 h-6 text-green-600" />
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-600 rounded-full"
              style={{ 
                width: `${(stats.totalPaid / stats.totalCredit) * 100}%` 
              }}
            />
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-500">Collection Rate</span>
            <span className="font-medium text-gray-900">
              {((stats.totalPaid / stats.totalCredit) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Pending Amount */}
      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Pending</p>
            <p className="mt-2 text-2xl font-semibold text-red-600">
              ₹{stats.totalPending.toLocaleString()}
            </p>
          </div>
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
        </div>
        <div className="mt-4 flex justify-between text-sm">
          <span className="text-gray-500">Overdue Payments</span>
          <span className="font-medium text-red-600">{stats.overduePayments}</span>
        </div>
      </div>
    </div>
  );
};

export default CreditSaleStats;
