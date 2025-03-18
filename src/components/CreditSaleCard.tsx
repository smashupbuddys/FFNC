import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IndianRupee, Calendar, Clock, ArrowUpRight } from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';

interface CreditSaleCardProps {
  id: string;
  customerName: string;
  amount: number;
  paidAmount: number;
  date: string;
  paymentFrequency?: 'daily' | 'weekly' | 'monthly';
  nextPaymentDate?: string;
  description?: string;
}

const CreditSaleCard: React.FC<CreditSaleCardProps> = ({
  id,
  customerName,
  amount,
  paidAmount,
  date,
  paymentFrequency,
  nextPaymentDate,
  description
}) => {
  const navigate = useNavigate();
  const remainingAmount = amount - paidAmount;
  const percentagePaid = (paidAmount / amount) * 100;

  const getPaymentStatus = () => {
    if (!nextPaymentDate) return 'not-scheduled';
    const today = new Date();
    const paymentDate = new Date(nextPaymentDate);
    
    if (isAfter(today, addDays(paymentDate, 1))) {
      return 'overdue';
    } else if (isAfter(today, paymentDate)) {
      return 'due-today';
    } else if (isBefore(today, paymentDate)) {
      return 'upcoming';
    }
    return 'not-scheduled';
  };

  const paymentStatus = getPaymentStatus();

  const statusColors = {
    'overdue': 'bg-red-100 text-red-800',
    'due-today': 'bg-yellow-100 text-yellow-800',
    'upcoming': 'bg-blue-100 text-blue-800',
    'not-scheduled': 'bg-gray-100 text-gray-800'
  };

  const statusText = {
    'overdue': 'Payment Overdue',
    'due-today': 'Due Today',
    'upcoming': 'Next Payment',
    'not-scheduled': 'Not Scheduled'
  };

  return (
    <div 
      onClick={() => navigate(`/credit-sales/${id}`)}
      className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{customerName}</h3>
          <p className="text-sm text-gray-500 mt-1">
            <Calendar className="w-4 h-4 inline-block mr-1" />
            {format(new Date(date), 'dd MMM yyyy')}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-lg font-semibold text-gray-900">₹{amount.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Total Amount</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Payment Progress</span>
          <span className="font-medium text-gray-900">{percentagePaid.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${percentagePaid}%` }}
          />
        </div>
      </div>

      {/* Payment Details */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500">Paid Amount</p>
          <p className="text-base font-medium text-green-600">₹{paidAmount.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Remaining</p>
          <p className="text-base font-medium text-red-600">₹{remainingAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Payment Schedule */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center">
          <Clock className="w-4 h-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-600 capitalize">
            {paymentFrequency || 'Not Set'} Payments
          </span>
        </div>
        {nextPaymentDate && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[paymentStatus]}`}>
            {statusText[paymentStatus]}
          </span>
        )}
      </div>

      {description && (
        <div className="mt-4 text-sm text-gray-600 border-t border-gray-100 pt-4">
          {description}
        </div>
      )}
    </div>
  );
};

export default CreditSaleCard;
