
import React, { useState, useMemo } from 'react';
import { Ticket, KpiData, MechanicDefinition, ServiceDefinition, Customer } from '../types';
import TicketCard from '../components/TicketCard';
import { CreateTicketModal, AssignMechanicModal, PendingModal, CancelModal, EditServicesModal } from '../components/Modals';
import { Plus, Users, Clock, PlayCircle, CheckCircle, PackageCheck, Ban } from 'lucide-react';

interface DashboardProps {
  tickets: Ticket[];
  mechanics: MechanicDefinition[];
  services: ServiceDefinition[];
  customers: Customer[];
  addTicket: (name: string, phone: string, unit: string, svcs: string[], notes: string, customerId?: string) => void;
  updateTicketStatus: (id: string, status: any, mechanic?: string, notes?: string, reason?: string) => void;
  updateTicketServices: (id: string, serviceTypes: string[]) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ tickets, mechanics, services, customers, addTicket, updateTicketStatus, updateTicketServices }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [assignModalData, setAssignModalData] = useState<{ isOpen: boolean; ticket: Ticket | null }>({ isOpen: false, ticket: null });
  const [pendingModalData, setPendingModalData] = useState<{ isOpen: boolean; ticket: Ticket | null }>({ isOpen: false, ticket: null });
  const [cancelModalData, setCancelModalData] = useState<{ isOpen: boolean; ticket: Ticket | null }>({ isOpen: false, ticket: null });
  const [editModalData, setEditModalData] = useState<{ isOpen: boolean; ticket: Ticket | null }>({ isOpen: false, ticket: null });

  // --- KPI LOGIC CORRECTION ---
  const kpi = useMemo(() => {
    const todayStr = new Date().toDateString();
    
    // 1. LIVE STATUS (Current Active Inventory)
    // These do NOT reset daily. They show what is physically in the shop RIGHT NOW.
    const waiting = tickets.filter(t => t.status === 'waiting').length;
    const inProgress = tickets.filter(t => t.status === 'active' || t.status === 'pending').length;
    const ready = tickets.filter(t => t.status === 'ready').length;

    // 2. DAILY PERFORMANCE (Reset Daily)
    // Only counts items that were finalized TODAY.
    const finishedToday = tickets.filter(t => 
      t.status === 'done' && 
      t.timestamps.finished && 
      new Date(t.timestamps.finished).toDateString() === todayStr
    ).length;

    const cancelledToday = tickets.filter(t => 
      t.status === 'cancelled' && 
      // Fallback to arrival time if finished time isn't set for cancellations
      ((t.timestamps.finished && new Date(t.timestamps.finished).toDateString() === todayStr) || 
       (!t.timestamps.finished && new Date(t.timestamps.arrival).toDateString() === todayStr))
    ).length;

    // Total handled today = Current Active + Done Today + Cancelled Today
    // This gives a sense of "Total Daily Volume"
    const total = waiting + inProgress + ready + finishedToday + cancelledToday;

    return { total, waiting, inProgress, ready, finished: finishedToday, cancelled: cancelledToday };
  }, [tickets]);

  // Filter lists for columns (Show ALL tickets in these states, regardless of date)
  const waitingTickets = tickets.filter(t => t.status === 'waiting');
  const activeTickets = tickets.filter(t => t.status === 'active' || t.status === 'pending');
  const readyTickets = tickets.filter(t => t.status === 'ready');
  
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-800 uppercase tracking-tight italic">Dashboard Admin</h2>
          <p className="text-sm text-slate-500 font-bold">Kelola operasional harian bengkel</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-black shadow-lg active:scale-95 transition-all text-xs md:text-sm"
        >
          <Plus size={18} />
          Tambah Pelanggan
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <KpiCard title="Total Vol." value={kpi.total} icon={<Users size={16} className="text-purple-500" />} />
        <KpiCard title="Antri (Live)" value={kpi.waiting} icon={<Clock size={16} className="text-gray-500" />} />
        <KpiCard title="Kerja (Live)" value={kpi.inProgress} icon={<PlayCircle size={16} className="text-blue-500" />} />
        <KpiCard title="Siap (Live)" value={kpi.ready} icon={<PackageCheck size={16} className="text-emerald-500" />} />
        <KpiCard title="Selesai (Hari Ini)" value={kpi.finished} icon={<CheckCircle size={16} className="text-green-500" />} />
        <KpiCard title="Batal (Hari Ini)" value={kpi.cancelled} icon={<Ban size={16} className="text-red-500" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Waiting */}
        <Column title="Menunggu" color="bg-gray-400" count={waitingTickets.length}>
            {waitingTickets.map(t => (
                <TicketCard key={t.id} ticket={t} actionLabel="Proses" onAction={() => setAssignModalData({isOpen:true, ticket:t})} onCancel={() => setCancelModalData({isOpen:true, ticket:t})} onEditServices={() => setEditModalData({isOpen:true, ticket:t})} />
            ))}
        </Column>

        {/* Active */}
        <Column title="Dikerjakan" color="bg-blue-500" count={activeTickets.length} bg="bg-blue-50/50">
            {activeTickets.map(t => (
                <TicketCard 
                    key={t.id} ticket={t} 
                    actionLabel={t.status === 'pending' ? "Lanjutkan" : "Selesai"} 
                    onAction={() => updateTicketStatus(t.id, t.status === 'pending' ? 'active' : 'ready')}
                    secondaryActionLabel={t.status === 'active' ? "Tunda" : undefined}
                    onSecondaryAction={() => setPendingModalData({isOpen:true, ticket:t})}
                    onCancel={() => setCancelModalData({isOpen:true, ticket:t})}
                    onChangeMechanic={() => setAssignModalData({isOpen:true, ticket:t})}
                    onEditServices={() => setEditModalData({isOpen:true, ticket:t})}
                />
            ))}
        </Column>

        {/* Ready */}
        <Column title="Siap Diambil" color="bg-emerald-500" count={readyTickets.length} bg="bg-emerald-50/50">
            {readyTickets.map(t => (
                <TicketCard key={t.id} ticket={t} actionLabel="Unit Diambil" onAction={() => updateTicketStatus(t.id, 'done')} />
            ))}
        </Column>
      </div>

      {/* Modals */}
      <CreateTicketModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        services={services} 
        customers={customers} 
        onAdd={addTicket} 
      />
      <AssignMechanicModal isOpen={assignModalData.isOpen} onClose={() => setAssignModalData({isOpen:false, ticket:null})} ticket={assignModalData.ticket} mechanics={mechanics} onAssign={(id:any, m:any) => updateTicketStatus(id, 'active', m)} />
      <PendingModal isOpen={pendingModalData.isOpen} onClose={() => setPendingModalData({isOpen:false, ticket:null})} ticket={pendingModalData.ticket} onConfirm={(id:any, r:any) => updateTicketStatus(id, 'pending', undefined, r)} />
      <CancelModal isOpen={cancelModalData.isOpen} onClose={() => setCancelModalData({isOpen:false, ticket:null})} ticket={cancelModalData.ticket} onConfirm={(id:any, r:any) => updateTicketStatus(id, 'cancelled', undefined, undefined, r)} />
      <EditServicesModal isOpen={editModalData.isOpen} onClose={() => setEditModalData({isOpen:false, ticket:null})} ticket={editModalData.ticket} services={services} onUpdate={updateTicketServices} />
    </div>
  );
};

const KpiCard = ({ title, value, icon }: any) => (
    <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col justify-between h-20 md:h-24 transition-transform hover:-translate-y-1">
        <div className="flex justify-between items-start"><p className="text-slate-400 text-[9px] md:text-[10px] font-black uppercase tracking-widest">{title}</p>{icon}</div>
        <p className="text-xl md:text-2xl font-black text-slate-800">{value}</p>
    </div>
);

const Column = ({ title, color, count, children, bg = "bg-slate-100/50" }: any) => (
    <div className={`${bg} p-3 md:p-4 rounded-2xl border-2 border-slate-100`}>
        <h3 className="text-base md:text-lg font-black text-slate-700 mb-4 flex items-center gap-2 uppercase tracking-tight italic">
            <span className={`w-3 h-3 rounded-full ${color} shadow-sm`}></span>{title}
            <span className="ml-auto bg-white border px-2.5 py-0.5 rounded-lg text-xs font-black shadow-sm">{count}</span>
        </h3>
        <div className="space-y-4">
            {count === 0 ? <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl text-sm italic font-bold uppercase tracking-widest">Kosong</div> : children}
        </div>
    </div>
);

export default Dashboard;
