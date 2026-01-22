import React, { useState, useEffect, useMemo } from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import MechanicMode from './pages/MechanicMode';
import CustomerDisplay from './pages/CustomerDisplay';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { Ticket, TicketStatus, MechanicDefinition, ServiceDefinition, Branch } from './types';
import { getTickets, saveTickets, getMechanics, saveMechanics, getServices, saveServices } from './services/ticketService';
import { MapPin } from 'lucide-react';

// New Branch Selection Component
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
    // Attempt to recover session branch
    return localStorage.getItem('daily_bike_selected_branch') as Branch | null;
  });

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [mechanics, setMechanics] = useState<MechanicDefinition[]>([]);
  const [services, setServices] = useState<ServiceDefinition[]>([]);

  useEffect(() => {
    setTickets(getTickets());
    setMechanics(getMechanics());
    setServices(getServices());
  }, []);

  useEffect(() => { if (tickets.length > 0) saveTickets(tickets); }, [tickets]);
  useEffect(() => { saveMechanics(mechanics); }, [mechanics]);
  useEffect(() => { saveServices(services); }, [services]);

  const handleBranchSelect = (branch: Branch) => {
    setCurrentBranch(branch);
    localStorage.setItem('daily_bike_selected_branch', branch);
  };

  const handleSwitchBranch = () => {
    setCurrentBranch(null);
    localStorage.removeItem('daily_bike_selected_branch');
  };

  // Filter tickets based on current branch
  const branchTickets = useMemo(() => {
    if (!currentBranch) return [];
    return tickets.filter(t => t.branch === currentBranch);
  }, [tickets, currentBranch]);

  const addTicket = (name: string, phone: string, unit: string, svcs: string[], notes: string) => {
    if (!currentBranch) return;
    
    // Generate simple ID (global incremental for now, but filtered by view)
    const newId = (Math.max(0, ...tickets.map(t => parseInt(t.id))) + 1).toString();
    
    const newTicket: Ticket = {
      id: newId, 
      branch: currentBranch, // Assign to current branch
      customerName: name, 
      unitSepeda: unit, 
      phone: phone, 
      serviceTypes: svcs,
      mechanic: null, 
      status: 'waiting', 
      notes: notes,
      timestamps: { arrival: new Date().toISOString(), called: null, ready: null, finished: null }
    };
    setTickets([...tickets, newTicket]);
  };

  const updateTicketStatus = (id: string, status: TicketStatus, mechanic?: string, notes?: string, reason?: string) => {
    setTickets(prev => prev.map(t => {
      if (t.id === id) {
        const ts = { ...t.timestamps };
        if (status === 'active' && t.status === 'waiting') ts.called = new Date().toISOString();
        if (status === 'ready') ts.ready = new Date().toISOString();
        if (status === 'done') ts.finished = new Date().toISOString();
        return { 
            ...t, status, 
            mechanic: mechanic ?? t.mechanic, 
            notes: notes ?? t.notes, 
            cancellationReason: reason ?? t.cancellationReason,
            timestamps: ts
        };
      }
      return t;
    }));
  };

  const updateTicketServices = (id: string, serviceTypes: string[]) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, serviceTypes } : t));
  };

  if (!currentBranch) {
    return <BranchSelection onSelect={handleBranchSelect} />;
  }

  // Using MemoryRouter prevents 'Location.assign' errors in restricted blob/iframe environments
  // while still maintaining SPA navigation behavior.
  return (
    <Router>
      <Layout currentBranch={currentBranch} onSwitchBranch={handleSwitchBranch}>
        <Routes>
          <Route path="/" element={<Dashboard tickets={branchTickets} mechanics={mechanics} services={services} addTicket={addTicket} updateTicketStatus={updateTicketStatus} updateTicketServices={updateTicketServices} />} />
          <Route path="/mechanic" element={<MechanicMode tickets={branchTickets} mechanics={mechanics} services={services} updateTicketStatus={updateTicketStatus} updateTicketServices={updateTicketServices} />} />
          <Route path="/display" element={<CustomerDisplay tickets={branchTickets} branch={currentBranch} />} />
          <Route path="/reports" element={<Reports tickets={branchTickets} />} />
          <Route path="/settings" element={<Settings mechanics={mechanics} setMechanics={setMechanics} services={services} setServices={setServices} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;