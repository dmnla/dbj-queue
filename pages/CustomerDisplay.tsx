import React from 'react';
import { Ticket, Branch } from '../types';
import { Clock, Wrench, PackageCheck, AlertCircle, MapPin } from 'lucide-react';

interface CustomerDisplayProps {
  tickets: Ticket[];
  branch: Branch;
}

const CustomerDisplay: React.FC<CustomerDisplayProps> = ({ tickets, branch }) => {
  const activeTickets = tickets.filter(t => t.status === 'active');
  const pendingTickets = tickets.filter(t => t.status === 'pending');
  const waitingTickets = tickets.filter(t => t.status === 'waiting');
  const readyTickets = tickets.filter(t => t.status === 'ready');

  const branchName = branch === 'mk' ? 'Muara Karang' : 'PIK 2';
  const accentColor = branch === 'mk' ? 'text-blue-500' : 'text-emerald-500';
  const accentBorder = branch === 'mk' ? 'border-blue-500' : 'border-emerald-500';

  return (
    <div className="h-screen bg-slate-900 text-white p-3 flex flex-col overflow-hidden">
      
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900 mb-2">
         <div className="flex items-center gap-4">
             <div className={`w-4 h-4 rounded-full ${branch === 'mk' ? 'bg-blue-500 shadow-[0_0_15px_blue]' : 'bg-emerald-500 shadow-[0_0_15px_emerald]'} animate-pulse`}></div>
             <div>
                <h1 className="text-2xl font-black tracking-[0.1em] uppercase text-slate-100 italic leading-none">Daily Bike</h1>
                <p className={`text-sm font-bold uppercase tracking-widest ${accentColor} flex items-center gap-1`}>
                    <MapPin size={12} /> {branchName}
                </p>
             </div>
         </div>
         <div className="text-slate-400 font-mono font-medium text-xl">
             {new Date().toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit'})}
         </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-10 gap-4 overflow-hidden">
        
        {/* Left Column: Active & Pending */}
        <div className="col-span-7 flex flex-col gap-4 h-full">
            {/* IN PROGRESS */}
            <div className={`flex-1 flex flex-col bg-slate-800/50 rounded-3xl border-2 ${branch === 'mk' ? 'border-blue-900/50' : 'border-emerald-900/50'} p-5`}>
                <div className={`flex items-center gap-3 ${accentColor} uppercase tracking-wider font-black text-lg mb-4`}>
                    <Wrench size={24} /> Sedang Dikerjakan (In Progress)
                </div>
                
                <div className="flex-1 grid grid-cols-2 gap-4 overflow-y-auto content-start pr-2">
                    {activeTickets.length === 0 && (
                        <div className="col-span-2 flex flex-col items-center justify-center text-slate-600 h-full border-4 border-dashed border-slate-800 rounded-3xl italic gap-4">
                            <Wrench size={48} className="opacity-20" />
                            <span className="text-xl font-bold uppercase">Mekanik Standby</span>
                        </div>
                    )}
                    {activeTickets.map(ticket => (
                        <div key={ticket.id} className={`bg-slate-800 border-l-[12px] ${accentBorder} rounded-r-2xl p-6 shadow-2xl flex flex-col relative overflow-hidden group`}>
                            <div className="flex justify-between items-start mb-3 z-10">
                                <span className={`${branch === 'mk' ? 'bg-blue-600' : 'bg-emerald-600'} text-white px-5 py-2 rounded-xl text-2xl font-black shadow-lg`}>#{ticket.id}</span>
                                <span className={`${branch === 'mk' ? 'text-blue-200 bg-blue-900/50 border-blue-500/30' : 'text-emerald-200 bg-emerald-900/50 border-emerald-500/30'} font-bold px-4 py-1 rounded-full border text-sm uppercase tracking-wider`}>{ticket.mechanic}</span>
                            </div>
                            <div className="mt-auto z-10">
                                <h2 className="text-4xl font-black text-white line-clamp-2 leading-tight mb-1">{ticket.customerName}</h2>
                                <p className={`text-2xl ${branch === 'mk' ? 'text-blue-300' : 'text-emerald-300'} font-bold mb-4 uppercase italic`}>{ticket.unitSepeda}</p>
                                <div className="pt-4 border-t border-slate-700/50 text-slate-400 text-lg font-medium italic">
                                    {ticket.serviceTypes.join(', ')}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* PENDING (Tertunda) - FIXED SIZE */}
            {pendingTickets.length > 0 && (
                <div className="h-1/3 bg-slate-900/80 rounded-3xl border-2 border-orange-500/30 p-5 flex flex-col">
                    <div className="flex items-center gap-2 text-orange-400 uppercase tracking-wider font-black text-lg mb-3">
                        <AlertCircle size={24} /> Pengerjaan Tertunda (Pending)
                    </div>
                    <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pr-2">
                        {pendingTickets.map(ticket => (
                            <div key={ticket.id} className="bg-orange-950/20 border-2 border-orange-500/20 rounded-2xl p-4 flex flex-row justify-between items-center shadow-lg">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                         <span className="font-mono font-black text-2xl text-orange-500 bg-orange-950/50 px-2 rounded">#{ticket.id}</span>
                                         <span className="font-black text-xl text-white line-clamp-1">{ticket.customerName}</span>
                                    </div>
                                    <p className="text-orange-200 font-bold text-sm uppercase mb-2">{ticket.unitSepeda}</p>
                                    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2">
                                        <p className="text-sm font-bold text-orange-300 italic flex items-start gap-1">
                                            <AlertCircle size={14} className="mt-0.5 shrink-0" /> "{ticket.notes}"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Right Column */}
        <div className="col-span-3 flex flex-col gap-4 h-full">
            <div className="flex-1 bg-emerald-900/10 border-2 border-emerald-500/30 rounded-3xl p-5 flex flex-col overflow-hidden">
                <h2 className="text-emerald-400 font-black flex items-center gap-2 mb-5 uppercase tracking-wide text-lg shrink-0">
                    <PackageCheck size={24} /> Siap Diambil
                </h2>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {readyTickets.map(ticket => (
                        <div key={ticket.id} className="bg-emerald-950/40 p-5 rounded-2xl border-l-8 border-emerald-500 shadow-lg">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-black text-white text-2xl line-clamp-1">{ticket.customerName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="text-base font-bold text-emerald-200/80 uppercase">{ticket.unitSepeda}</p>
                                <span className="font-mono text-2xl font-black text-emerald-500">#{ticket.id}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 bg-slate-800/50 rounded-3xl border-2 border-slate-700 p-5 flex flex-col overflow-hidden">
                 <h2 className="text-slate-300 font-black flex items-center gap-2 mb-5 uppercase tracking-wide text-lg shrink-0">
                    <Clock size={24} /> Antrian Masuk
                </h2>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {waitingTickets.map((ticket, index) => (
                        <div key={ticket.id} className="bg-slate-700/40 p-4 rounded-xl flex items-center justify-between border-b border-slate-700">
                             <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-black text-slate-300 shadow-inner">{index + 1}</div>
                                <div>
                                    <p className="font-bold text-slate-200 text-lg">{ticket.customerName}</p>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{ticket.unitSepeda}</p>
                                </div>
                            </div>
                            <span className="font-mono text-xl font-black text-slate-600">#{ticket.id}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDisplay;