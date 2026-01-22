import React, { useState, useMemo } from 'react';
import { Ticket, MechanicDefinition, ServiceDefinition } from '../types';
import TicketCard from '../components/TicketCard';
import { PendingModal, EditServicesModal, AssignMechanicModal } from '../components/Modals';
import { Wrench, CheckCircle, PackageCheck, PlayCircle, Layers, AlertCircle } from 'lucide-react';

interface MechanicModeProps {
  tickets: Ticket[];
  mechanics: MechanicDefinition[];
  services: ServiceDefinition[];
  updateTicketStatus: (id: string, status: any, mechanic?: string, notes?: string) => void;
  updateTicketServices: (id: string, serviceTypes: string[]) => void;
}

const MechanicMode: React.FC<MechanicModeProps> = ({ 
    tickets, 
    mechanics, 
    services, 
    updateTicketStatus,
    updateTicketServices 
}) => {
  const [pendingModal, setPendingModal] = useState<{ isOpen: boolean; ticket: Ticket | null }>({ isOpen: false, ticket: null });
  const [editModal, setEditModal] = useState<{ isOpen: boolean; ticket: Ticket | null }>({ isOpen: false, ticket: null });
  const [assignModal, setAssignModal] = useState<{ isOpen: boolean; ticket: Ticket | null }>({ isOpen: false, ticket: null });

  const ongoingTickets = useMemo(() => {
    return tickets.filter(t => t.status === 'waiting' || t.status === 'active' || t.status === 'pending')
      .sort((a, b) => {
        const order = { active: 0, pending: 1, waiting: 2 };
        return order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
      });
  }, [tickets]);

  const handleStart = (ticket: Ticket) => setAssignModal({ isOpen: true, ticket });
  const handleFinish = (ticket: Ticket) => updateTicketStatus(ticket.id, 'ready');
  const handleResume = (ticket: Ticket) => updateTicketStatus(ticket.id, 'active');
  const handlePending = (ticket: Ticket) => setPendingModal({ isOpen: true, ticket });
  const handleEdit = (ticket: Ticket) => setEditModal({ isOpen: true, ticket });
  const handleChangeMechanic = (ticket: Ticket) => setAssignModal({ isOpen: true, ticket });

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8 pb-32">
      
      {/* Header View */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border-2 border-slate-100 gap-4">
        <div className="flex items-center gap-3 md:gap-5 w-full sm:w-auto">
            <div className="bg-orange-100 p-3 md:p-4 rounded-xl md:rounded-2xl text-orange-600 shrink-0">
                <Wrench size={24} className="md:w-8 md:h-8" />
            </div>
            <div>
                <h1 className="text-xl md:text-3xl font-black text-slate-800 uppercase tracking-tighter italic">MODE MEKANIK</h1>
                <p className="text-[10px] md:text-xs text-slate-500 font-bold flex items-center gap-1">
                    <Layers size={12} /> Antrian Aktif Bengkel
                </p>
            </div>
        </div>
        <div className="bg-slate-100 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl border-2 border-slate-200 w-full sm:w-auto text-center">
            <span className="text-xl md:text-2xl font-black text-slate-700">{ongoingTickets.length}</span>
            <span className="ml-2 text-[10px] font-black text-slate-400 uppercase">Unit Sedang Antri</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {ongoingTickets.length === 0 ? (
            <div className="col-span-full text-center py-20 md:py-32 bg-white rounded-[2rem] border-4 border-dashed border-slate-200">
                <CheckCircle size={60} className="mx-auto mb-6 text-slate-200" />
                <h3 className="text-xl md:text-2xl font-black text-slate-300 uppercase italic">Bengkel Tenang</h3>
                <p className="text-slate-400 font-bold mt-2 text-sm">Tidak ada pengerjaan aktif saat ini.</p>
            </div>
        ) : (
            ongoingTickets.map(ticket => (
                <div key={ticket.id} className="bg-white rounded-2xl md:rounded-[2rem] shadow-xl border-2 border-slate-100 p-5 md:p-8 flex flex-col gap-4 md:gap-6 relative overflow-hidden transition-all hover:border-blue-200">
                    
                    {/* Corner Tag */}
                    <div className={`absolute top-0 right-0 px-4 md:px-8 py-1.5 md:py-2 rounded-bl-2xl md:rounded-bl-3xl font-black text-[9px] md:text-xs uppercase tracking-widest text-white shadow-md z-20 ${
                        ticket.status === 'active' ? 'bg-blue-600' :
                        ticket.status === 'pending' ? 'bg-orange-500' : 'bg-slate-400'
                    }`}>
                        {ticket.status === 'active' ? 'Dikerjakan' :
                         ticket.status === 'pending' ? 'Tunda' : 'Antri'}
                    </div>

                    {/* Customer Info Box */}
                    <div className="flex flex-col gap-1 pr-12 md:pr-0">
                        <div className="flex items-center gap-2 md:gap-3">
                            <span className="font-mono text-2xl md:text-4xl font-black text-slate-300">#{ticket.id}</span>
                            <h3 className="text-xl md:text-3xl font-black text-slate-800 line-clamp-1 break-words">{ticket.customerName}</h3>
                        </div>
                        <p className="text-sm md:text-xl font-extrabold text-blue-600 italic uppercase tracking-tighter break-words">{ticket.unitSepeda}</p>
                    </div>

                    {/* Service Summary */}
                    <div className="bg-slate-50 p-3 md:p-5 rounded-xl md:rounded-2xl border-2 border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                             <Wrench size={10} /> Daftar Layanan
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {ticket.serviceTypes.map((svc, i) => (
                                <span key={i} className="bg-white border-2 border-slate-200 text-slate-800 text-[10px] md:text-sm font-black px-2 md:px-4 py-1 rounded-lg md:rounded-xl shadow-sm">
                                    {svc}
                                </span>
                            ))}
                        </div>
                        {ticket.mechanic && (
                             <div className="mt-3 pt-2 border-t border-slate-200 flex justify-between items-center">
                                <p className="text-[10px] md:text-xs font-black text-slate-500">Mekanik: <span className="text-blue-700">{ticket.mechanic}</span></p>
                                <button 
                                    onClick={() => handleChangeMechanic(ticket)}
                                    className="text-[9px] font-black text-blue-500 border-2 border-blue-100 px-2 py-1 rounded-lg hover:bg-blue-50 uppercase"
                                >
                                    Ganti
                                </button>
                             </div>
                        )}
                    </div>

                    {/* BIG ACTIONS - Optimized for mobile stacking */}
                    <div className="grid grid-cols-1 gap-3 mt-auto">
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            {ticket.status === 'waiting' && (
                                <button 
                                    onClick={() => handleStart(ticket)}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white p-4 md:p-6 rounded-xl md:rounded-2xl font-black text-base md:text-xl uppercase italic tracking-wider flex items-center justify-center gap-2 md:gap-3 shadow-lg shadow-green-200 transition-all active:scale-95"
                                >
                                    <PlayCircle size={24} className="md:w-7 md:h-7" />
                                    MULAI KERJA
                                </button>
                            )}
                            
                            {ticket.status === 'active' && (
                                <>
                                    <button 
                                        onClick={() => handlePending(ticket)}
                                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white p-4 md:p-6 rounded-xl md:rounded-2xl font-black text-base md:text-xl uppercase italic tracking-wider flex items-center justify-center gap-2 md:gap-3 shadow-lg transition-all active:scale-95"
                                    >
                                        <AlertCircle size={24} className="md:w-7 md:h-7" />
                                        TUNDA
                                    </button>
                                    <button 
                                        onClick={() => handleFinish(ticket)}
                                        className="flex-[1.5] bg-green-600 hover:bg-green-700 text-white p-4 md:p-6 rounded-xl md:rounded-2xl font-black text-base md:text-xl uppercase italic tracking-wider flex items-center justify-center gap-2 md:gap-3 shadow-xl shadow-green-200 transition-all active:scale-95 border-b-4 md:border-b-8 border-green-800"
                                    >
                                        <PackageCheck size={24} className="md:w-7 md:h-7" />
                                        SELESAI
                                    </button>
                                </>
                            )}

                            {ticket.status === 'pending' && (
                                <button 
                                    onClick={() => handleResume(ticket)}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-4 md:p-6 rounded-xl md:rounded-2xl font-black text-base md:text-xl uppercase italic tracking-wider flex items-center justify-center gap-2 md:gap-3 shadow-lg shadow-blue-200 transition-all active:scale-95"
                                >
                                    <PlayCircle size={24} className="md:w-7 md:h-7" />
                                    LANJUTKAN
                                </button>
                            )}
                        </div>

                        <button 
                            onClick={() => handleEdit(ticket)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 p-3 md:p-4 rounded-lg md:rounded-xl font-black text-[10px] md:text-sm uppercase tracking-widest flex items-center justify-center gap-2 border-2 border-slate-200 transition-all active:scale-95"
                        >
                            <Wrench size={16} />
                            + TAMBAH / GANTI SERVIS
                        </button>
                    </div>

                    {ticket.notes && (
                        <div className="mt-2 bg-yellow-50 p-3 rounded-xl border-l-4 border-yellow-400 text-slate-700 italic text-[11px] md:text-sm font-bold flex gap-2 items-center">
                            <Layers size={14} className="text-yellow-600 flex-shrink-0" />
                            "{ticket.notes}"
                        </div>
                    )}
                </div>
            ))
        )}
      </div>

      <PendingModal 
        isOpen={pendingModal.isOpen} 
        onClose={() => setPendingModal({ isOpen: false, ticket: null })}
        ticket={pendingModal.ticket}
        onConfirm={(id: string, reason: string) => updateTicketStatus(id, 'pending', undefined, reason)}
      />

      <EditServicesModal 
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, ticket: null })}
        ticket={editModal.ticket}
        services={services}
        onUpdate={updateTicketServices}
      />

      <AssignMechanicModal 
        isOpen={assignModal.isOpen}
        onClose={() => setAssignModal({ isOpen: false, ticket: null })}
        ticket={assignModal.ticket}
        mechanics={mechanics}
        onAssign={(id: string, mechanic: string) => updateTicketStatus(id, 'active', mechanic)}
      />
    </div>
  );
};

export default MechanicMode;