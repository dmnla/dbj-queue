import React, { useState, useEffect, useMemo } from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MechanicMode from './pages/MechanicMode';
import CustomerDisplay from './pages/CustomerDisplay';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { Ticket, TicketStatus, MechanicDefinition, ServiceDefinition, Branch } from './types';
import { 
  subscribeToTickets, 
  subscribeToMechanics, 
  subscribeToServices,
  addTicketToCloud,
  updateTicketStatusInCloud,
  updateTicketServicesInCloud,
  addMechanicToCloud,
  updateMechanicInCloud,
  removeMechanicFromCloud,
  addServiceToCloud,
  updateServiceInCloud,
  removeServiceFromCloud
} from './services/ticketService';
import { MapPin } from 'lucide-react';

// Branch Selection Component
const BranchSelection = ({ onSelect }: { onSelect: (b: Branch) => void }) => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="col-span-full text-center mb-4">
        <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">Daily Bike Jakarta</h1>
        <p className="text-slate-400 text-lg">Pilih Lokasi Cabang / Branch Location</p>
      </div>
      
      <button 
        onClick={() => onSelect('mk')}
        className="group relative bg-blue-600 hover:bg-blue-500 rounded-3xl p-10 flex flex-col items-center justify-center gap-6 transition-all hover:scale-[1.02] shadow-2xl border-4 border-blue-400/30"
      >
        <div className="bg-white/20 p-6 rounded-full text-white group-hover:scale-110 transition-transform">
           <MapPin size={48} />
        </div>
        <div className="text-center">
            <h2 className="text-3xl font-black text-white uppercase tracking-wider">Muara Karang</h2>
            <p className="text-blue-200 font-bold mt-2">Pusat / Main Branch</p>
        </div>
      </button>

      <button 
        onClick={() => onSelect('pik')}
        className="group relative bg-emerald-600 hover:bg-emerald-500 rounded-3xl p-10 flex flex-col items-center justify-center gap-6 transition-all hover:scale-[1.02] shadow-2xl border-4 border-emerald-400/30"
      >
         <div className="bg-white/20 p-6 rounded-full text-white group-hover:scale-110 transition-transform">
           <MapPin size={48} />
        </div>
        <div className="text-center">
            <h2 className="text-3xl font-black text-white uppercase tracking-wider">PIK 2</h2>
            <p className="text-emerald-200 font-bold mt-2">Cabang Baru / New Branch</p>
        </div>
      </button>
    </div>
  </div>
);

function App() {
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(() => {
    return localStorage.getItem('daily_bike_selected_branch') as Branch | null;
  });

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mechanics, setMechanics] = useState<MechanicDefinition[]>([]);
  const [services, setServices] = useState<ServiceDefinition[]>([]);

  // Real-time subscriptions to Firestore
  useEffect(() => {
    const unsubscribeTickets = subscribeToTickets((updatedTickets) => {
      setTickets(updatedTickets);
    });
    const unsubscribeMechanics = subscribeToMechanics((updatedMechanics) => {
      setMechanics(updatedMechanics);
    });
    const unsubscribeServices = subscribeToServices((updatedServices) => {
      setServices(updatedServices);
    });

    return () => {
      unsubscribeTickets();
      unsubscribeMechanics();
      unsubscribeServices();
    };
  }, []);

  const handleBranchSelect = (branch: Branch) => {
    setCurrentBranch(branch);
    localStorage.setItem('daily_bike_selected_branch', branch);
  };

  const handleSwitchBranch = () => {
    setCurrentBranch(null);
    localStorage.removeItem('daily_bike_selected_branch');
  };

  // --- Filtering Logic ---
  
  // 1. Filter tickets: only show tickets belonging to current branch
  const branchTickets = useMemo(() => {
    if (!currentBranch) return [];
    return tickets.filter(t => t.branch === currentBranch);
  }, [tickets, currentBranch]);

  // 2. Filter Mechanics: only show mechanics assigned to current branch (or both)
  const branchMechanics = useMemo(() => {
    if (!currentBranch) return [];
    return mechanics.filter(m => m.branches.includes(currentBranch));
  }, [mechanics, currentBranch]);

  // 3. Filter Services: only show services available in current branch (or both)
  const branchServices = useMemo(() => {
    if (!currentBranch) return [];
    return services.filter(s => s.branches.includes(currentBranch));
  }, [services, currentBranch]);


  const addTicket = (name: string, phone: string, unit: string, svcs: string[], notes: string) => {
    if (!currentBranch) return;
    addTicketToCloud(currentBranch, name, phone, unit, svcs, notes);
  };

  const updateTicketStatus = (id: string, status: TicketStatus, mechanic?: string, notes?: string, reason?: string) => {
    const ticketToUpdate = tickets.find(t => t.id === id);
    if (!ticketToUpdate) return;
    updateTicketStatusInCloud(id, ticketToUpdate, status, mechanic, notes, reason);
  };

  const updateTicketServices = (id: string, serviceTypes: string[]) => {
    updateTicketServicesInCloud(id, serviceTypes);
  };

  // Settings Handlers
  const handleAddMechanic = (name: string, branches: Branch[]) => addMechanicToCloud(name, branches);
  const handleUpdateMechanic = (id: string, name: string, branches: Branch[]) => updateMechanicInCloud(id, name, branches);
  const handleRemoveMechanic = (id: string) => removeMechanicFromCloud(id);
  
  const handleAddService = (name: string, branches: Branch[]) => addServiceToCloud(name, branches);
  const handleUpdateService = (id: string, name: string, branches: Branch[]) => updateServiceInCloud(id, name, branches);
  const handleRemoveService = (id: string) => removeServiceFromCloud(id);

  if (!currentBranch) {
    return <BranchSelection onSelect={handleBranchSelect} />;
  }

  return (
    <Router>
      <Layout currentBranch={currentBranch} onSwitchBranch={handleSwitchBranch}>
        <Routes>
          <Route path="/" element={<Dashboard tickets={branchTickets} mechanics={branchMechanics} services={branchServices} addTicket={addTicket} updateTicketStatus={updateTicketStatus} updateTicketServices={updateTicketServices} />} />
          <Route path="/mechanic" element={<MechanicMode tickets={branchTickets} mechanics={branchMechanics} services={branchServices} updateTicketStatus={updateTicketStatus} updateTicketServices={updateTicketServices} />} />
          <Route path="/display" element={<CustomerDisplay tickets={branchTickets} branch={currentBranch} />} />
          <Route path="/reports" element={<Reports tickets={branchTickets} />} />
          <Route 
            path="/settings" 
            element={
              <Settings 
                mechanics={mechanics} // Settings sees ALL mechanics to manage them
                services={services}   // Settings sees ALL services to manage them
                onAddMechanic={handleAddMechanic}
                onUpdateMechanic={handleUpdateMechanic}
                onRemoveMechanic={handleRemoveMechanic}
                onAddService={handleAddService}
                onUpdateService={handleUpdateService}
                onRemoveService={handleRemoveService}
              />
            } 
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;