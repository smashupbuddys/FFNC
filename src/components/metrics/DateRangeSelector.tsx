import React from 'react';
import { Calendar, Filter } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';

interface DateRangeSelectorProps {
  timeRange: 'today' | 'week' | 'month' | 'year' | 'custom';
  startDate: string;
  endDate: string;
  onTimeRangeChange: (range: 'today' | 'week' | 'month' | 'year' | 'custom') => void;
  onDateChange: (start: string, end: string) => void;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  timeRange,
  startDate,
  endDate,
  onTimeRangeChange,
  onDateChange
}) => {
  const handlePresetSelect = (preset: 'today' | 'week' | 'month' | 'year' | 'custom') => {
    const now = new Date();
    let start = new Date();
    let end = now;

    switch (preset) {
      case 'today':
        start = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        start = subDays(now, 7);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'year':
        start = startOfYear(now);
        break;
      case 'custom':
        return; // Don't change dates for custom range
    }

    onTimeRangeChange(preset);
    onDateChange(
      format(start, 'yyyy-MM-dd'),
      format(end, 'yyyy-MM-dd')
    );
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'Last 7 Days' },
          { value: 'month', label: 'This Month' },
          { value: 'year', label: 'This Year' },
          { value: 'custom', label: 'Custom' }
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => handlePresetSelect(option.value as any)}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-200
              ${timeRange === option.value
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
              }
            `}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {timeRange === 'custom' && (
        <div className="flex gap-2 items-center">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              className="pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <span className="text-gray-500">to</span>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              className="pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;
