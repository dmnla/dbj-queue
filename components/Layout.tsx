import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, MonitorPlay, FileBarChart, Bike, Settings, Wrench, MapPin, Warehouse, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Branch } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentBranch: Branch;
  onSwitchBranch: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, currentBranch, onSwitchBranch }) => {
  const location = useLocation();
  const isDisplayMode = location.pathname === '/display';

  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const toggleSidebar = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    localStorage.setItem('sidebar-collapsed', String(newCollapsed));
  };

  if (isDisplayMode) {
    return <>{children}</>;
  }

  const isMK = currentBranch === 'mk';
  const branchColor = isMK ? 'text-blue-400' : 'text-emerald-400';
  const branchBg = isMK ? 'bg-blue-900' : 'bg-emerald-900';
  const branchLabel = isMK ? 'Muara Karang' : 'PIK 2';

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 relative">
      {/* Sidebar - Collapsible on Desktop and Top Navigation on Mobile */}
      <aside className={`bg-brand-dark text-white flex-shrink-0 flex flex-col border-b md:border-b-0 md:border-r border-slate-700 z-50 sticky top-0 md:h-screen md:sticky md:left-0 transition-all duration-300 w-full ${isCollapsed ? 'md:w-20' : 'md:w-64'}`}>
        <div className="p-4 md:p-5 flex items-center justify-between border-b border-slate-700 bg-brand-dark z-50">
          <div className="flex items-center space-x-3 overflow-hidden">
            <Bike className={`w-6 h-6 md:w-8 md:h-8 flex-shrink-0 ${branchColor}`} />
            {!isCollapsed && (
              <div className="transition-all duration-300 opacity-100 whitespace-nowrap animate-fade-in">
                <h1 className="font-black text-sm md:text-lg leading-tight uppercase tracking-tighter italic">Daily Bike</h1>
                <p className={`text-[10px] font-bold ${branchColor} uppercase tracking-wider flex items-center gap-1`}>
                  <MapPin size={10} /> {branchLabel}
                </p>
              </div>
            )}
          </div>
          {/* Collapse Toggle Button - Desktop Only */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex items-center justify-center p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        
        {/* Navigation - Horizontal scroll on mobile, Vertical on desktop */}
        <nav className={`flex md:flex-col overflow-x-auto no-scrollbar md:overflow-x-visible p-2 md:p-4 md:space-y-2 flex-1 bg-brand-dark transition-all ${isCollapsed ? 'md:p-3 md:items-center' : ''}`}>
          <NavItem to="/" icon={<LayoutDashboard size={18} />} label="Admin" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} isCollapsed={isCollapsed} />
          <NavItem to="/mechanic" icon={<Wrench size={18} />} label="Mekanik" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} isCollapsed={isCollapsed} />
          
          {/* STORAGE MODE - ONLY FOR PIK */}
          {!isMK && (
            <NavItem to="/storage" icon={<Warehouse size={18} />} label="Storage" branchColorClass="bg-purple-600" isCollapsed={isCollapsed} />
          )}

          <NavItem to="/display" icon={<MonitorPlay size={18} />} label="Layar TV" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} isCollapsed={isCollapsed} />
          <NavItem to="/reports" icon={<FileBarChart size={18} />} label="Laporan" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} isCollapsed={isCollapsed} />
          <NavItem to="/performance" icon={<TrendingUp size={18} />} label="Performa" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} isCollapsed={isCollapsed} />
          <div className="hidden md:block pt-4 mt-4 border-t border-slate-700 w-full">
             <div className="px-1 md:px-2">
                 {!isCollapsed && <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 px-2">System</p>}
                 <NavItem to="/settings" icon={<Settings size={18} />} label="Pengaturan" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} isCollapsed={isCollapsed} />
                 <button 
                  onClick={onSwitchBranch} 
                  title={isCollapsed ? "Ganti Cabang" : ""}
                  className={`w-full mt-2 text-left flex items-center px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm md:text-base font-bold uppercase tracking-tight transition-all cursor-pointer z-50 relative ${isCollapsed ? 'md:justify-center md:px-0 w-10 h-10 mx-auto' : 'space-x-3'}`}
                 >
                    <MapPin size={18} />
                    {!isCollapsed && <span>Ganti Cabang</span>}
                 </button>
             </div>
          </div>
          {/* Settings for mobile at the end of scroll */}
          <div className="md:hidden flex flex-shrink-0">
            <NavItem to="/settings" icon={<Settings size={18} />} label="Settings" branchColorClass={isMK ? 'bg-blue-600' : 'bg-emerald-600'} isCollapsed={isCollapsed} />
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

const NavItem = ({ to, icon, label, branchColorClass, isCollapsed }: { to: string; icon: React.ReactNode; label: string, branchColorClass: string, isCollapsed?: boolean }) => (
  <NavLink
    to={to}
    title={isCollapsed ? label : ""}
    className={({ isActive }) =>
      `flex items-center rounded-lg transition-all whitespace-nowrap text-sm md:text-base font-bold uppercase tracking-tight cursor-pointer relative z-50 ${
        isActive ? `${branchColorClass} text-white shadow-lg` : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      } ${isCollapsed ? 'md:px-0 md:justify-center w-10 h-10' : 'px-3 md:px-4 py-2 md:py-3 space-x-2 md:space-x-3'}`
    }
  >
    {icon}
    {!isCollapsed && <span>{label}</span>}
    {/* Always show on mobile even if collapsed state is yes (as collapse is desktop-only) */}
    {isCollapsed && <span className="md:hidden">{label}</span>}
  </NavLink>
);

export default Layout;