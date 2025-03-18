import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, IndianRupee, Users, FileSpreadsheet, Receipt, 
  CreditCard, UserCircle, Package, FileText, Target, Brain
} from 'lucide-react';

interface NavigationProps {
  isMobileMenuOpen: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ isMobileMenuOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/goals', label: 'Financial Goals', icon: Target },
    { path: '/ai-chat', label: 'AI Assistant', icon: Brain },
    { path: '/sales', label: 'Sales', icon: IndianRupee },
    { path: '/credit-sales', label: 'Lena Paisa', icon: CreditCard, badge: 'notifications' },
    { path: '/expenses', label: 'Expenses', icon: Receipt },
    { path: '/parties', label: 'Manufacturers', icon: Users },
    { path: '/staff', label: 'Staff', icon: UserCircle },
    { path: '/bulk-entry', label: 'Bulk Entry', icon: FileSpreadsheet },
    { path: '/pending-orders', label: 'Pending Orders', icon: Package },
    { path: '/report', label: 'Report', icon: FileText }
  ];

  return (
    <nav className={`
      border-b border-gray-200 bg-white
      ${isMobileMenuOpen ? 'block' : 'hidden lg:block'} 
      backdrop-blur-sm bg-white/90
    `}>
      <div className="max-w-[2000px] mx-auto px-4">
        <div className="flex overflow-x-auto scrollbar-hide space-x-2 py-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`
                  flex items-center px-4 py-2.5 rounded-xl whitespace-nowrap
                  transition-colors duration-200 relative shrink-0
                  ${isActive
                    ? 'text-blue-600 bg-blue-50 shadow-sm border border-blue-100'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 border border-transparent'
                  }
                `}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="ml-2 text-sm font-medium">{item.label}</span>
                {item.badge === 'notifications' && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
