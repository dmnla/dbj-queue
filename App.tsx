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
  removeMechanicFromCloud,
  addServiceToCloud,
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

  // Filter tickets based on current branch
  // Note: We sync ALL tickets but only display those matching the branch.
  const branchTickets = useMemo(() => {
    if (!currentBranch) return [];
    return tickets.filter(t => t.branch === currentBranch);
  }, [tickets, currentBranch]);

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
  const handleAddMechanic = (name: string) => addMechanicToCloud(name);
  const handleRemoveMechanic = (id: string) => removeMechanicFromCloud(id);
  const handleAddService = (name: string) => addServiceToCloud(name);
  const handleRemoveService = (id: string) => removeServiceFromCloud(id);

  if (!currentBranch) {
    return <BranchSelection onSelect={handleBranchSelect} />;
  }

  return (
    <Router>
      <Layout currentBranch={currentBranch} onSwitchBranch={handleSwitchBranch}>
        <Routes>
          <Route path="/" element={<Dashboard tickets={branchTickets} mechanics={mechanics} services={services} addTicket={addTicket} updateTicketStatus={updateTicketStatus} updateTicketServices={updateTicketServices} />} />
          <Route path="/mechanic" element={<MechanicMode tickets={branchTickets} mechanics={mechanics} services={services} updateTicketStatus={updateTicketStatus} updateTicketServices={updateTicketServices} />} />
          <Route path="/display" element={<CustomerDisplay tickets={branchTickets} branch={currentBranch} />} />
          <Route path="/reports" element={<Reports tickets={branchTickets} />} />
          <Route 
            path="/settings" 
            element={
              <Settings 
                mechanics={mechanics} 
                services={services} 
                onAddMechanic={handleAddMechanic}
                onRemoveMechanic={handleRemoveMechanic}
                onAddService={handleAddService}
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