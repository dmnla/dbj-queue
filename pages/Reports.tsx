
import React, { useState, useMemo } from 'react';
import { Ticket } from '../types';
import { formatTime } from '../services/ticketService';
import { Download, Search, Filter, ArrowUpDown, ChevronUp, ChevronDown, Copy, Calendar, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ReportsProps {
  tickets: Ticket[];
}

type SortKey = 'id' | 'customerName' | 'unitSepeda' | 'status' | 'arrival' | 'called' | 'ready' | 'finished';

const Reports: React.FC<ReportsProps> = ({ tickets }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mechanicFilter, setMechanicFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [sortKey, setSortKey] = useState<SortKey>('arrival');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const uniqueMechanics = useMemo(() => Array.from(new Set(tickets.map(t => t.mechanic).filter(Boolean))), [tickets]);

  const filteredAndSortedTickets = useMemo(() => {
    return tickets
      .filter(t => {
        const lowerSearch = searchTerm.toLowerCase();
        // SEARCH LOGIC UPDATED: Now checks ID, Customer Name, and Unit Sepeda
        const matchesSearch = 
            t.customerName.toLowerCase().includes(lowerSearch) || 
            t.id.includes(lowerSearch) ||
            t.unitSepeda.toLowerCase().includes(lowerSearch);
            
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        const matchesMechanic = mechanicFilter === 'all' || t.mechanic === mechanicFilter;
        let matchesDate = true;
        if (startDate || endDate) {
            const ticketDate = new Date(t.timestamps.arrival).setHours(0,0,0,0);
            const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
            const end = endDate ? new Date(endDate).setHours(0,0,0,0) : null;
            if (start && ticketDate < start) matchesDate = false;
            if (end && ticketDate > end) matchesDate = false;
        }
        return matchesSearch && matchesStatus && matchesMechanic && matchesDate;
      })
      .sort((a, b) => {
        let valA: any;
        let valB: any;

        if (['arrival', 'called', 'ready', 'finished'].includes(sortKey)) {
          valA = a.timestamps[sortKey as keyof typeof a.timestamps] ? new Date(a.timestamps[sortKey as keyof typeof a.timestamps]!).getTime() : 0;
          valB = b.timestamps[sortKey as keyof typeof b.timestamps] ? new Date(b.timestamps[sortKey as keyof typeof b.timestamps]!).getTime() : 0;
        } else {
          valA = a[sortKey as keyof Ticket];
          valB = b[sortKey as keyof Ticket];
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [tickets, searchTerm, statusFilter, mechanicFilter, startDate, endDate, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const exportToExcel = () => {
    // Uses the EXACT data currently visible in the UI (filtered and sorted)
    const data = filteredAndSortedTickets.map(t => ({
      'ID Tiket': `#${t.id}`,
      'Nama Pelanggan': t.customerName,
      'Unit Sepeda': t.unitSepeda,
      'Layanan': t.serviceTypes.join(', '),
      'Mekanik': t.mechanic || '-',
      'Status': t.status.toUpperCase(),
      'Waktu Datang': formatTime(t.timestamps.arrival),
      'Mulai Kerja': formatTime(t.timestamps.called),
      'Siap Diambil': formatTime(t.timestamps.ready),
      'Unit Diambil': formatTime(t.timestamps.finished),
      'Catatan': t.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Bengkel");
    XLSX.writeFile(wb, `Laporan_Bengkel_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const copyToWhatsApp = () => {
    const today = new Date().toDateString();
    
    // Copy logic: Only active tickets OR tickets arrived/finished today
    const relevantTickets = filteredAndSortedTickets.filter(t => {
      const isToday = new Date(t.timestamps.arrival).toDateString() === today || 
                      (t.timestamps.finished && new Date(t.timestamps.finished).toDateString() === today);
      const isActive = ['waiting', 'active', 'pending', 'ready'].includes(t.status);
      return isToday || isActive;
    });

    const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    const waiting = relevantTickets.filter(t => t.status === 'waiting');
    const active = relevantTickets.filter(t => t.status === 'active');
    const pending = relevantTickets.filter(t => t.status === 'pending');
    const ready = relevantTickets.filter(t => t.status === 'ready');
    const finished = relevantTickets.filter(t => t.status === 'done');
    
    const formatLine = (t: Ticket) => `- [${t.id}] ${t.customerName} - ${t.unitSepeda} - (${t.serviceTypes.join(', ')})`;
    
    let text = `*LAPORAN BENGKEL DAILY BIKE*\n_${dateStr}_\n\n`;
    
    if (active.length) text += `*SEDANG DIKERJAKAN:*\n${active.map(formatLine).join('\n')}\n\n`;
    if (pending.length) text += `*TERTUNDA (PENDING):*\n${pending.map(formatLine).join('\n')}\n\n`;
    if (ready.length) text += `*SIAP DIAMBIL:*\n${ready.map(formatLine).join('\n')}\n\n`;
    if (waiting.length) text += `*ANTRIAN MENUNGGU:*\n${waiting.map(formatLine).join('\n')}\n\n`;
    if (finished.length) text += `*SELESAI HARI INI:*\n${finished.map(formatLine).join('\n')}\n\n`;
    
    if (relevantTickets.length === 0) text += "_Tidak ada aktivitas tiket hari ini._";

    navigator.clipboard.writeText(text).then(() => alert("Teks Laporan Hari Ini disalin ke Clipboard!"));
  };

  const inputStyle = "p-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold transition-all shadow-sm";

  const SortIcon = ({ currentKey }: { currentKey: SortKey }) => {
    if (sortKey !== currentKey) return <ArrowUpDown size={14} className="text-slate-300 ml-2" />;
    return sortOrder === 'asc' ? <ChevronUp size={14} className="text-blue-600 ml-2" /> : <ChevronDown size={14} className="text-blue-600 ml-2" />;
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto pb-20 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter italic uppercase">Riwayat Layanan Bengkel</h2>
            <p className="text-slate-500 font-medium">Log aktivitas pengerjaan dan pengambilan unit</p>
        </div>
        <div className="flex flex-wrap gap-3">
            <button onClick={copyToWhatsApp} className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-black uppercase tracking-wider shadow-lg transition-all active:scale-95 text-sm">
                <Copy size={18} /> Copy WA Hari Ini
            </button>
            <button onClick={exportToExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-black uppercase tracking-wider shadow-lg transition-all active:scale-95 text-sm">
                <FileSpreadsheet size={18} /> Export Excel (Filtered)
            </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-6 rounded-2xl border-2 border-slate-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="flex flex-col gap-1 lg:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 flex items-center gap-1"><Search size={10}/> Cari Pelanggan / ID / Sepeda</label>
                <input type="text" placeholder="Ketik nama, no tiket, atau sepeda..." className={inputStyle} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 flex items-center gap-1"><Calendar size={10}/> Dari Tanggal</label>
                <input type="date" className={inputStyle} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 flex items-center gap-1"><Calendar size={10}/> Sampai Tanggal</label>
                <input type="date" className={inputStyle} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 flex items-center gap-1"><Filter size={10}/> Status</label>
                <select className={inputStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="all" className="bg-white">Semua Status</option>
                    <option value="waiting" className="bg-white">Menunggu</option>
                    <option value="active" className="bg-white">Dikerjakan</option>
                    <option value="pending" className="bg-white">Tertunda</option>
                    <option value="ready" className="bg-white">Siap Diambil</option>
                    <option value="done" className="bg-white">Selesai / Diambil</option>
                    <option value="cancelled" className="bg-white">Dibatalkan</option>
                </select>
            </div>
            <div className="flex flex-col gap-1 lg:col-span-1">
                <label className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1 flex items-center gap-1"><Filter size={10}/> Mekanik</label>
                <select className={inputStyle} value={mechanicFilter} onChange={e => setMechanicFilter(e.target.value)}>
                    <option value="all" className="bg-white">Semua Mekanik</option>
                    {uniqueMechanics.map(m => <option key={m} value={m as string} className="bg-white">{m}</option>)}
                </select>
            </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border-2 border-slate-100 rounded-[2rem] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-50 border-b-2 border-slate-100">
                    <tr>
                        <th className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => handleSort('id')}>
                            <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">NO. TIKET <SortIcon currentKey="id" /></div>
                        </th>
                        <th className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('customerName')}>
                             <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">PELANGGAN <SortIcon currentKey="customerName" /></div>
                        </th>
                        <th className="px-6 py-5">
                             <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">LAYANAN</div>
                        </th>
                        <th className="px-6 py-5">
                             <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">MEKANIK</div>
                        </th>
                        <th className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('status')}>
                             <div className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">STATUS <SortIcon currentKey="status" /></div>
                        </th>
                        <th className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors bg-blue-50/30" onClick={() => handleSort('arrival')}>
                             <div className="flex items-center text-[10px] font-black text-blue-700 uppercase tracking-widest">DATANG <SortIcon currentKey="arrival" /></div>
                        </th>
                        <th className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors bg-orange-50/30" onClick={() => handleSort('called')}>
                             <div className="flex items-center text-[10px] font-black text-orange-700 uppercase tracking-widest">MULAI <SortIcon currentKey="called" /></div>
                        </th>
                        <th className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors bg-emerald-50/30" onClick={() => handleSort('ready')}>
                             <div className="flex items-center text-[10px] font-black text-emerald-700 uppercase tracking-widest">SIAP <SortIcon currentKey="ready" /></div>
                        </th>
                        <th className="px-6 py-5 cursor-pointer hover:bg-slate-100 transition-colors bg-slate-100" onClick={() => handleSort('finished')}>
                             <div className="flex items-center text-[10px] font-black text-slate-800 uppercase tracking-widest">AMBIL <SortIcon currentKey="finished" /></div>
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-50">
                    {filteredAndSortedTickets.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="px-6 py-20 text-center text-slate-400 font-bold italic">Tidak ada data ditemukan dengan filter tersebut.</td>
                        </tr>
                    ) : (
                        filteredAndSortedTickets.map(t => (
                            <tr key={t.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="px-6 py-4 font-mono font-black text-slate-400 text-lg">#{t.id}</td>
                                <td className="px-6 py-4">
                                    <div className="font-black text-slate-800">{t.customerName}</div>
                                    <div className="text-[11px] font-extrabold text-blue-600 uppercase tracking-tighter italic">{t.unitSepeda}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1">
                                        {t.serviceTypes.map((svc, i) => (
                                            <span key={i} className="bg-slate-100 text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">{svc}</span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-bold text-slate-700">{t.mechanic || <span className="text-slate-300">-</span>}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 border-2 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                        t.status === 'active' ? 'border-blue-200 text-blue-600 bg-blue-50' :
                                        t.status === 'pending' ? 'border-orange-200 text-orange-600 bg-orange-50' :
                                        t.status === 'ready' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' :
                                        t.status === 'done' ? 'border-green-300 text-green-700 bg-green-50' :
                                        t.status === 'cancelled' ? 'border-red-200 text-red-600 bg-red-50' :
                                        'border-slate-200 text-slate-500 bg-slate-50'
                                    }`}>
                                        {t.status === 'active' ? 'Proses' : 
                                         t.status === 'pending' ? 'Tunda' :
                                         t.status === 'ready' ? 'Siap' :
                                         t.status === 'done' ? 'Selesai' :
                                         t.status === 'waiting' ? 'Antri' : 'Batal'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-blue-800 font-bold bg-blue-50/10">
                                    {formatTime(t.timestamps.arrival)}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-orange-800 font-bold bg-orange-50/10">
                                    {t.timestamps.called ? formatTime(t.timestamps.called) : '-'}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-emerald-800 font-bold bg-emerald-50/10">
                                    {t.timestamps.ready ? formatTime(t.timestamps.ready) : '-'}
                                </td>
                                <td className="px-6 py-4 font-mono text-xs text-slate-800 font-black bg-slate-100/50">
                                    {t.timestamps.finished ? formatTime(t.timestamps.finished) : '-'}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
