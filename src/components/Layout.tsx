import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Menu, Database, X, Settings, LayoutDashboard, IndianRupee, 
  CreditCard, Receipt, Users, UserCircle, FileSpreadsheet, 
  Package, FileText, Bell 
} from 'lucide-react';
import BackupRestore from './BackupRestore';
import Navigation from './Navigation';
import DatabaseMerge from './DatabaseMerge';
import InflationRateSettings from './InflationRateSettings';
import { useSettings } from '../hooks/useSettings';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const { settings, saveSettings } = useSettings();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);
    return `${weekday}, ${day}/${month}/${year}`;
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-[40] backdrop-blur-sm bg-white/90">
        <div className="max-w-[2000px] mx-auto">
          {/* Top Bar */}
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                Finance System
              </h1>
            </div>
            
            <div className="flex items-center gap-4">
              <InflationRateSettings
                inflationRate={settings.inflationRate}
                alternativeLendingRate={settings.alternativeLendingRate}
                businessGrowthRate={settings.businessGrowthRate}
                lmStudioSettings={settings.lmStudioSettings}
                onSave={saveSettings}
              />
              
              <button
                onClick={() => setShowMergeModal(true)} 
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                <Database className="w-4 h-4 mr-2" />
                Merge DB
              </button>
              
              <BackupRestore />
              
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <Navigation isMobileMenuOpen={isMobileMenuOpen} />
        </div>
      </header>

      {/* Database Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Merge Database</h2>
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <DatabaseMerge />
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-[2000px] w-full mx-auto relative z-[30]">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white relative z-[40]">
        <div className="max-w-[2000px] mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm">
            <div className="font-medium text-gray-700">{formatDate(currentDateTime)}</div>
            <div className="mt-1 sm:mt-0 font-medium text-blue-600">{formatTime(currentDateTime)}</div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
