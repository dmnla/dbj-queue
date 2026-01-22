import React from 'react';
import { Ticket } from '../types';
import { Clock, User, Phone, Wrench, AlertCircle, Bike, Ban, UserCog, StickyNote, Edit, PlayCircle, CheckCircle } from 'lucide-react';
import { formatTime } from '../services/ticketService';

interface TicketCardProps {
  ticket: Ticket;
  onAction?: (ticket: Ticket) => void;
  actionLabel?: string;
  onSecondaryAction?: (ticket: Ticket) => void;
  secondaryActionLabel?: string;
  onCancel?: (ticket: Ticket) => void;
  onChangeMechanic?: (ticket: Ticket) => void;
  onEditServices?: (ticket: Ticket) => void;
  compact?: boolean;
}

const TicketCard: React.FC<TicketCardProps> = ({ 
  ticket, 
  onAction, 
  actionLabel,
  onSecondaryAction,
  secondaryActionLabel,
  onCancel,
  onChangeMechanic,
  onEditServices,
  compact = false
}) => {
  const getStatusColor = () => {
    switch (ticket.status) {
      case 'waiting': return 'border-l-4 border-gray-400';
      case 'active': return 'border-l-4 border-blue-500';
      case 'pending': return 'border-l-4 border-orange-500';
      case 'ready': return 'border-l-4 border-emerald-500';
      case 'done': return 'border-l-4 border-green-700';
      default: return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting': return 'Menunggu';
      case 'active': return 'Dikerjakan';
      case 'pending': return 'Tertunda';
      case 'ready': return 'Siap Diambil';
      case 'done': return 'Selesai';
      default: return status;
    }
  };

  const canEdit = ticket.status === 'waiting' || ticket.status === 'active' || ticket.status === 'pending';

  return (
    <div className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 ${getStatusColor()} flex flex-col gap-3 relative overflow-hidden`}>
      
      {/* Header */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-mono text-lg sm:text-xl font-black text-slate-400">#{ticket.id}</span>
            <span className={`text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
            ticket.status === 'active' ? 'bg-blue-100 text-blue-800' :
            ticket.status === 'pending' ? 'bg-orange-100 text-orange-800' :
            ticket.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
            ticket.status === 'done' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
            }`}>
            {getStatusLabel(ticket.status)}
            </span>
        </div>
        
        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
            {canEdit && onEditServices && (
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditServices(ticket); }}
                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded border border-blue-100 transition-colors z-10"
                    title="Edit Services"
                >
                    <Edit size={14} />
                </button>
            )}
            {(ticket.status === 'waiting' || ticket.status === 'active') && onCancel && (
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCancel(ticket); }}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded border border-red-100 transition-colors z-10"
                    title="Batalkan"
                >
                    <Ban size={14} />
                </button>
            )}
        </div>
      </div>

      {/* Customer Info */}
      <div className="border-b border-slate-100 pb-2">
        <h3 className="font-black text-base sm:text-lg text-slate-800 flex items-center gap-2 leading-tight break-words">
          <User size={16} className="text-slate-300 flex-shrink-0" />
          {ticket.customerName}
        </h3>
        <p className="text-xs sm:text-sm font-bold text-blue-600 flex items-center gap-2 mt-1 uppercase italic break-words">
          <Bike size={14} className="text-orange-500 flex-shrink-0" />
          {ticket.unitSepeda}
        </p>
        {!compact && ticket.phone && (
          <p className="text-[10px] text-slate-400 flex items-center gap-2 mt-1 ml-6">
            <Phone size={10} /> {ticket.phone}
          </p>
        )}
      </div>

      {/* Services List */}
      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
        <div className="text-[9px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
            <Wrench size={10} /> Layanan:
        </div>
        <div className="flex flex-wrap gap-1">
            {ticket.serviceTypes.map((svc, idx) => (
                <span key={idx} className="bg-white border border-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                    {svc}
                </span>
            ))}
        </div>
        
        {ticket.mechanic && (
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
               <div className="text-[10px] font-bold text-slate-500">
                    Mekanik: <span className="text-blue-700">{ticket.mechanic}</span>
               </div>
               {ticket.status === 'active' && onChangeMechanic && (
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onChangeMechanic(ticket); }}
                        className="text-[9px] font-black bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50 flex items-center gap-1 z-10 uppercase"
                    >
                        <UserCog size={10} /> Ganti
                    </button>
               )}
            </div>
        )}
      </div>

       {ticket.notes && (
        <div className={`flex items-start gap-2 text-[11px] p-2 rounded border leading-snug ${ticket.status === 'pending' ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-yellow-50 border-yellow-100 text-slate-600'}`}>
          {ticket.status === 'pending' ? <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> : <StickyNote size={14} className="mt-0.5 flex-shrink-0 text-yellow-600" />}
          <span className="italic font-medium">"{ticket.notes}"</span>
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 flex flex-col sm:flex-row gap-2 mt-auto">
        {onAction && actionLabel && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAction(ticket); }}
            className={`flex-1 text-white text-xs font-black py-3 px-3 rounded-xl transition-all shadow-md active:scale-95 z-10 flex items-center justify-center gap-2 uppercase tracking-widest ${
                actionLabel.includes('MULAI') || actionLabel.includes('PROSES') ? 'bg-green-600 hover:bg-green-700' : 
                actionLabel.includes('SELESAI') || actionLabel.includes('DIAMBIL') ? 'bg-slate-900 hover:bg-black' :
                actionLabel.includes('LANJUT') ? 'bg-blue-600 hover:bg-blue-700' :
                'bg-slate-800 hover:bg-slate-900'
            }`}
          >
            {actionLabel}
          </button>
        )}
        {onSecondaryAction && secondaryActionLabel && (
           <button
           type="button"
           onClick={(e) => { e.stopPropagation(); onSecondaryAction(ticket); }}
           className="flex-1 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black py-3 px-3 rounded-xl transition-all active:scale-95 z-10 uppercase tracking-widest shadow-sm"
         >
           {secondaryActionLabel}
         </button>
        )}
      </div>
    </div>
  );
};

export default TicketCard;