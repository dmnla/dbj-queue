
import React from 'react';
import { Ticket } from '../types';
import { User, Phone, Wrench, AlertCircle, Bike, Ban, UserCog, StickyNote, Edit, Clock, Link2 } from 'lucide-react';
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
  onReconcile?: (ticket: Ticket) => void;
  compact?: boolean;
  customActions?: React.ReactNode;
  locked?: boolean;
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
  onReconcile,
  compact = false,
  customActions,
  locked = false
}) => {
  const getStatusColor = () => {
    switch (ticket.status) {
      case 'waiting': return 'border-l-4 border-gray-400';
      case 'active': return 'border-l-4 border-blue-500';
      case 'pending': return 'border-l-4 border-orange-500';
      case 'ready': return 'border-l-4 border-emerald-500';
      case 'taken': return 'border-l-4 border-purple-500';
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
      case 'taken': return 'Follow Up';
      case 'done': return 'Selesai';
      default: return status;
    }
  };

  const canEdit = ticket.status === 'waiting' || ticket.status === 'active' || ticket.status === 'pending';
  
  // Use ticketNumber for display if available, otherwise fallback to ID
  const displayId = ticket.ticketNumber ? `#${ticket.ticketNumber}` : `#${ticket.id.slice(-4)}`;
  const isLongId = displayId.length > 6;

  const formatDateTimeDisplay = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    const formatted = formatTime(dateString); // "DD/MM/YYYY HH:MM"
    if (formatted === "-") return "-";
    const parts = formatted.split(' ');
    if (parts.length < 2) return formatted;
    const dateParts = parts[0].split('/'); // ["DD", "MM", "YYYY"]
    if (dateParts.length < 2) return formatted;
    const dayMonth = `${dateParts[0]}/${dateParts[1]}`;
    return `${dayMonth} ${parts[1]}`;
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-3 sm:p-4 ${getStatusColor()} flex flex-col gap-3 relative overflow-hidden h-full ${locked ? 'opacity-65 bg-slate-50 border-slate-200/60 pointer-events-none select-none shadow-none hover:shadow-none' : ''}`}>
      
      {/* Header Row */}
      <div className="flex justify-between items-center gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden flex-wrap">
            <span className={`font-mono font-black text-slate-400 tracking-tighter truncate ${isLongId ? 'text-lg' : 'text-2xl'}`}>
              {displayId}
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tight whitespace-nowrap ${
            ticket.status === 'active' ? 'bg-blue-100 text-blue-800' :
            ticket.status === 'pending' ? 'bg-orange-100 text-orange-800' :
            ticket.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
            ticket.status === 'taken' ? 'bg-purple-100 text-purple-800' :
            ticket.status === 'done' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
            }`}>
            {getStatusLabel(ticket.status)}
            </span>
            {locked && (
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-500 border border-slate-300 uppercase tracking-widest text-[9px] flex items-center gap-1">
                🔒 Terkunci
              </span>
            )}
            {!locked && !ticket.dealposOrderId && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-tight whitespace-nowrap">
                Manual Card
              </span>
            )}
            {!locked && ticket.dealposOrderId && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 uppercase tracking-tight whitespace-nowrap">
                DealPOS {(() => {
                  const num = ticket.dealposOrderNumber;
                  const id = ticket.dealposOrderId;
                  if (num && String(num).trim()) {
                    const val = String(num).trim();
                    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || val.length > 20;
                    if (!isGuid) return val.replace(/^#+/, "");
                  }
                  if (id && String(id).trim()) {
                    const val = String(id).trim();
                    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || val.length > 20;
                    if (!isGuid) return val.replace(/^#+/, "");
                  }
                  return "Terhubung";
                })()}
              </span>
            )}

        </div>
        
        {/* Top Right Action Buttons - Compact Icons */}
        <div className="flex gap-1 shrink-0">
            {!ticket.dealposOrderId && onReconcile && (
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onReconcile(ticket); }}
                    className="w-8 h-8 flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-full border border-amber-200 transition-colors"
                    title="Hubungkan ke DealPOS (Reconcile)"
                >
                    <Link2 size={16} />
                </button>
            )}
            {canEdit && onEditServices && (
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEditServices(ticket); }}
                    className="w-8 h-8 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full border border-blue-200 transition-colors"
                    title="Edit Services"
                >
                    <Edit size={16} />
                </button>
            )}
            {(ticket.status === 'waiting' || ticket.status === 'active') && onCancel && (
                <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onCancel(ticket); }}
                    className="w-8 h-8 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-600 rounded-full border border-red-200 transition-colors"
                    title="Batalkan"
                >
                    <Ban size={16} />
                </button>
            )}
        </div>
      </div>

      {/* Customer Info */}
      <div className="border-b border-slate-100 pb-2">
        <h3 className="font-black text-base text-slate-800 flex items-start gap-2 leading-tight">
          <User size={16} className="text-slate-300 flex-shrink-0 mt-0.5" />
          <span className="line-clamp-1 break-all">{ticket.customerName}</span>
          {ticket.notes && ticket.notes.includes('[GARANSI]') && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-black tracking-widest uppercase shrink-0">GARANSI</span>
          )}
        </h3>
        <p className="text-sm font-bold text-blue-600 flex items-center gap-2 mt-1 uppercase italic">
          <Bike size={14} className="text-orange-500 flex-shrink-0" />
          <span className="line-clamp-1 break-all">{ticket.unitSepeda}</span>
        </p>
        {!compact && ticket.phone && (
          <p className="text-[10px] text-slate-400 flex items-center gap-2 mt-1 ml-6">
            <Phone size={10} /> {ticket.phone}
          </p>
        )}
      </div>

      {/* Dynamic Flags Badges */}
      {ticket.flags && Array.isArray(ticket.flags) && ticket.flags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1">
          {ticket.flags.map((f, index) => {
            const flag = f as string;
            let label = flag;
            let theme = "bg-rose-100 text-rose-800 border-rose-200";
            
            if (flag === "TELAT_UPDATE" || flag === "TELAT_UPDATE_ANTRIAN") {
              label = "⚠️ TELAT UPDATE ANTRIAN";
              theme = "bg-red-50 text-red-700 border-red-200 animate-pulse";
            } else if (flag === "LATE_FOLLOW_UP" || flag === "TELAT_FOLLOW_UP") {
              label = "⏳ LATE FOLLOW UP (>5 hari)";
              theme = "bg-amber-50 text-amber-700 border-amber-200";
            } else if (flag === "RESI_HILANG") {
              label = "🏷️ RESI HILANG";
              theme = "bg-purple-50 text-purple-700 border-purple-200";
            } else if (flag === "TELAT_SELESAI") {
              label = "⏱️ TELAT SELESAI";
              theme = "bg-rose-50 text-rose-700 border-rose-200";
            } else if (flag === "ANOMALI_DURASI_SERVICE") {
              label = "🛑 DURASI ANOMALI (<5m)";
              theme = "bg-red-100 text-red-800 border-red-300";
            } else if (flag === "TIKET_TERLEWAT") {
              label = "🌙 TIKET TERLEWAT";
              theme = "bg-indigo-50 text-indigo-700 border-indigo-200";
            }

            return (
              <span
                key={index}
                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${theme}`}
                title="Flag Operasional"
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Services List */}
      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex-1">
        <div className="text-[9px] font-black text-slate-400 uppercase mb-1 flex items-center gap-1">
            <Wrench size={10} /> Layanan:
        </div>
        <div className="flex flex-wrap gap-1">
            {ticket.serviceTypes.map((svc, idx) => (
                <span key={idx} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
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
                        className="text-[9px] font-black bg-white border border-blue-200 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-50 flex items-center gap-1 uppercase"
                    >
                        <UserCog size={10} /> Ganti
                    </button>
               )}
            </div>
        )}
      </div>

       {ticket.notes && (
        <div className={`flex items-start gap-2 text-[10px] p-2 rounded border leading-snug ${ticket.status === 'pending' ? 'bg-orange-50 border-orange-100 text-orange-700' : 'bg-yellow-50 border-yellow-100 text-slate-600'}`}>
          {ticket.status === 'pending' ? <AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> : <StickyNote size={12} className="mt-0.5 flex-shrink-0 text-yellow-600" />}
          <span className="italic font-medium line-clamp-2">"{ticket.notes}"</span>
        </div>
      )}

      {/* Timestamps Restored */}
      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-1">
        <div className="flex items-center gap-1" title="Jam Kedatangan">
            <Clock size={10} />
            <span>{formatDateTimeDisplay(ticket.timestamps.arrival)}</span>
        </div>
        {ticket.timestamps.called && (
             <div className="flex items-center gap-1 text-blue-500" title="Jam Mulai">
                <span>→ {formatDateTimeDisplay(ticket.timestamps.called)}</span>
            </div>
        )}
        {ticket.timestamps.ready && (
             <div className="flex items-center gap-1 text-emerald-500" title="Jam Selesai">
                <span>→ {formatDateTimeDisplay(ticket.timestamps.ready)}</span>
            </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="pt-1 mt-auto">
        {customActions ? (
          <div className="flex flex-col gap-2">
            {customActions}
          </div>
        ) : (
          <div className="flex gap-2">
            {onSecondaryAction && secondaryActionLabel && (
             <button
             type="button"
             onClick={(e) => { e.stopPropagation(); onSecondaryAction(ticket); }}
             className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-[10px] font-black py-2 rounded-lg transition-all uppercase shadow-sm whitespace-nowrap"
           >
             {secondaryActionLabel}
           </button>
          )}
          
          {onAction && actionLabel && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction(ticket); }}
              className={`flex-1 text-white text-xs font-black py-2.5 px-2 rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wide whitespace-nowrap ${
                  actionLabel.includes('MULAI') || actionLabel.includes('PROSES') ? 'bg-green-600 hover:bg-green-700' : 
                  actionLabel.includes('SELESAI') || actionLabel.includes('DIAMBIL') ? 'bg-slate-900 hover:bg-black' :
                  actionLabel.includes('LANJUT') ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-slate-800 hover:bg-slate-900'
              }`}
            >
              {actionLabel}
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default TicketCard;
