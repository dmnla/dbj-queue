import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, MonitorPlay, FileBarChart, Bike, Settings, Wrench, MapPin, Warehouse } from 'lucide-react';
import { Branch } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentBranch: Branch;
  onSwitchBranch: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentBranch, onSwitchBranch }) => {
  const location = useLocation();
  const isDisplayMode = location.pathname === '/display';

  if (isDisplayMode) {
    return <>{children}</>;
  }

  const isMK = currentBranch === 'mk';
  const branchColor = isMK ? 'text-blue-400' : 'text-emerald-400';
  const branchBg = isMK ? 'bg-blue-900' : 'bg-emerald-900';
  const branchLabel = isMK ? 'Muara Karang' : 'PIK 2';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 relative">
      {/* Sidebar - Optimized for Mobile (Top Bar) and Desktop (Side Bar) */}
      <aside className="bg-brand-dark text-white w-full md:w-64 flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-700 z-50 sticky top-0 md:h-screen md:sticky md:left-0">
        <div className="p-4 md:p-6 flex items-center justify-between md:justify-start md:space-x-3 border-b border-slate-700 bg-brand-dark z-50">
          <div className="flex items-center space-x-3">
            <Bike className={`w-6 h-6 md:w-8 md:h-8 ${branchColor}`} />
            <div>
              <h1 className="font-black text-sm md:text-lg leading-tight uppercase tracking-tighter italic">Daily Bike</h1>
              <p className={`text-[10px] font-bold ${branchColor} uppercase tracking-wider flex items-center gap-1`}>
                <MapPin size={10} /> {branchLabel}
              </p>
            </div>
          </div>
        </div>
        
        {/* Navigation - Horizontal scroll on mobile, Vertical on desktop */}
        <nav className="flex md:flex-col overflow-x-auto no-scrollbar md:overflow-x-visible p-2 md:p-4 md:space-y-2 flex-1 bg-brand-dark">
          <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Admin" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} />
          <NavItem to="/mechanic" icon={<Wrench size={18} />} label="Mekanik" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} />
          
          {/* STORAGE MODE - ONLY FOR PIK */}
          {!isMK && (
            <NavItem to="/storage" icon={<Warehouse size={18} />} label="Storage" branchColorClass="bg-purple-600" />
          )}

          <NavItem to="/display" icon={<MonitorPlay size={18} />} label="Layar TV" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} />
          <NavItem to="/reports" icon={<FileBarChart size={18} />} label="Laporan" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} />
          <div className="hidden md:block pt-4 mt-4 border-t border-slate-700">
             <div className="px-4 py-2">
                 <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">System</p>
                 <NavItem to="/settings" icon={<Settings size={18} />} label="Pengaturan" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} />
                 <button onClick={onSwitchBranch} className="w-full mt-2 text-left flex items-center space-x-2 md:space-x-3 px-3 md:px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm md:text-base font-bold uppercase tracking-tight transition-all cursor-pointer z-50 relative">
                    <MapPin size={18} />
                    <span>Ganti Cabang</span>
                 </button>
             </div>
          </div>
          {/* Settings for mobile at the end of scroll */}
          <div className="md:hidden flex flex-shrink-0">
            <NavItem to="/settings" icon={<Settings size={18} />} label="Settings" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} />
            <button onClick={onSwitchBranch} className="flex items-center space-x-2 px-3 py-2 text-slate-400 hover:text-white rounded-lg text-sm font-bold uppercase tracking-tight whitespace-nowrap cursor-pointer">
               <MapPin size={18} />
               <span>Cabang</span>
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden min-w-0">
        {/* Branch Banner for clear visibility */}
        <div className={`${branchBg} text-white px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-center shadow-inner sticky top-0 z-40 md:relative`}>
            System Active: {branchLabel}
        </div>
        <div className="min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ to, icon, label, branchColorClass }: { to: string; icon: React.ReactNode; label: string, branchColorClass: string }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center space-x-2 md:space-x-3 px-3 md:px-4 py-2 md:py-3 rounded-lg transition-all whitespace-nowrap text-sm md:text-base font-bold uppercase tracking-tight cursor-pointer relative z-50 ${
        isActive ? `${branchColorClass} text-white shadow-lg` : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`
    }
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

export default Layout;