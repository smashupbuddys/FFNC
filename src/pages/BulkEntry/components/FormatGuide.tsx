import React from 'react';
import { Info, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const FormatGuide: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-blue-900 hover:text-blue-700"
      >
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-500 shrink-0" />
          <span className="font-medium">Entry Format Guide</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-blue-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-blue-500" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4 text-sm text-blue-900">
          <div className="space-y-3">
            <div>
              <p className="font-medium mb-2">Sales:</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Cash: "1. 23500"</li>
                <li>Digital: "7. 21506 net"</li>
                <li>Credit: "20. 9300 (Maa)"</li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-2">Bills (Date Required):</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Full: "PendalKarigar (25/1/25) SV2029 73173 GR 302 GST"</li>
                <li>With Date: "SAJ (date: 13/12/24) 33201"</li>
                <li>Date format: DD/MM/YY</li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-2">Expenses (Optional Date):</p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>Basic: "Home 23988" or "Home 23988 (25/1/25)"</li>
                <li>With GST: "GP 94100 GST" or "GP 94100 GST (25/1/25)"</li>
                <li>Staff: "Alok Sal 30493" or "Alok Sal 30493 (25/1/25)"</li>
                <li>Party: "PBK 20000 Party GST" or "PBK 20000 Party GST (25/1/25)"</li>
                <li>Random: "Repair 5000", "Labour 2500 (25/1/25)", "Transport 3000 GST"</li>
                <li>Standard: "Petty 2737", "Food 3321", "Poly 5667"</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FormatGuide;
