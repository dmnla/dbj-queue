import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, ChevronDown, Check, UserCog } from 'lucide-react';
import { Ticket, ServiceDefinition, MechanicDefinition } from '../types';

interface ModalBaseProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

const ModalBase: React.FC<ModalBaseProps> = ({ title, isOpen, onClose, children, maxWidth = "max-w-lg" }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center p-5 border-b border-slate-100">
          <h2 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-visible">{children}</div>
      </div>
    </div>
  );
};

// MULTI Searchable Dropdown
const MultiSearchableSelect = ({ 
  options, 
  selectedValues, 
  onChange, 
  placeholder 
}: { 
  options: string[], 
  selectedValues: string[], 
  onChange: (v: string[]) => void,
  placeholder: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options
    .filter(opt => opt.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (opt: string) => {
    if (selectedValues.includes(opt)) {
        onChange(selectedValues.filter(v => v !== opt));
    } else {
        onChange([...selectedValues, opt]);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl flex flex-wrap gap-2 min-h-[52px] justify-between items-center cursor-pointer hover:border-blue-400 transition-all shadow-sm"
      >
        <div className="flex flex-wrap gap-2">
            {selectedValues.length === 0 && <span className="text-slate-400 font-medium">{placeholder}</span>}
            {selectedValues.map(v => (
                <span key={v} className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-2 shadow-sm">
                    {v}
                    <X size={14} className="hover:text-red-200" onClick={(e) => { e.stopPropagation(); toggleOption(v); }} />
                </span>
            ))}
        </div>
        <ChevronDown size={20} className={`transition-transform text-slate-400 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-2xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-3 border-b bg-slate-50 relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              autoFocus
              className="w-full pl-10 pr-4 py-2 bg-white text-slate-900 border-2 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Cari layanan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm font-medium italic">Layanan tidak ditemukan</div>
            ) : (
              filteredOptions.map(opt => (
                <div 
                  key={opt}
                  className={`px-5 py-3 cursor-pointer text-sm flex items-center justify-between hover:bg-blue-50 transition-colors ${selectedValues.includes(opt) ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 font-medium'}`}
                  onClick={() => toggleOption(opt)}
                >
                  {opt}
                  {selectedValues.includes(opt) && <Check size={18} className="text-blue-600" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Common Input Style
const inputClass = "w-full p-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium transition-all shadow-sm placeholder:text-slate-400";

// 1. Tambah Pelanggan
export const AddCustomerModal = ({ isOpen, onClose, services, onAdd }: any) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [unit, setUnit] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const serviceNames = useMemo(() => services.map((s: any) => s.name), [services]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && selectedServices.length > 0 && unit) {
      onAdd(name, phone, unit, selectedServices, notes);
      onClose();
      setName(''); setPhone(''); setUnit(''); setSelectedServices([]); setNotes('');
    }
  };

  return (
    <ModalBase title="Tambah Pelanggan Baru" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Nama Pelanggan</label>
          <input required type="text" className={inputClass} placeholder="Contoh: Budi Prasetyo" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Nomor Telepon</label>
              <input type="tel" className={inputClass} placeholder="08xxxx" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Unit Sepeda</label>
              <input required type="text" className={inputClass} placeholder="Contoh: Brompton M6L" value={unit} onChange={e => setUnit(e.target.value)} />
            </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Pilih Layanan</label>
          <MultiSearchableSelect options={serviceNames} selectedValues={selectedServices} onChange={setSelectedServices} placeholder="Pilih satu atau lebih layanan..." />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Catatan Keluhan</label>
          <textarea className={inputClass} rows={2} placeholder="Sebutkan detail kerusakan jika ada..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
        <button type="submit" disabled={!name || selectedServices.length === 0} className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">Buat Tiket Antrian</button>
      </form>
    </ModalBase>
  );
};

// 2. Edit Services
export const EditServicesModal = ({ isOpen, onClose, ticket, services, onUpdate }: any) => {
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const serviceNames = useMemo(() => services.map((s: any) => s.name), [services]);

    useEffect(() => {
        if (ticket) setSelectedServices(ticket.serviceTypes);
    }, [ticket]);

    const handleSave = () => {
        if (ticket && selectedServices.length > 0) {
            onUpdate(ticket.id, selectedServices);
            onClose();
        }
    };

    return (
        <ModalBase title={`Edit Layanan #${ticket?.id}`} isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
             <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-xs font-bold text-slate-400 uppercase mb-1">Pelanggan</div>
                <div className="text-lg font-black text-slate-800">{ticket?.customerName}</div>
                <div className="text-sm text-slate-500 font-medium">{ticket?.unitSepeda}</div>
            </div>
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">Daftar Layanan Baru:</label>
                    <MultiSearchableSelect options={serviceNames} selectedValues={selectedServices} onChange={setSelectedServices} placeholder="Pilih layanan..." />
                </div>
                <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Simpan Perubahan</button>
            </div>
        </ModalBase>
    );
};

// 3. Assign Mechanic
export const AssignMechanicModal = ({ isOpen, onClose, ticket, mechanics, onAssign }: any) => {
    const [mechanic, setMechanic] = useState(mechanics[0]?.name || '');
    return (
        <ModalBase title="Pilih Mekanik" isOpen={isOpen} onClose={onClose}>
            <div className="space-y-6">
                <div className="bg-slate-50 p-4 rounded-xl text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Menugaskan untuk tiket</p>
                    <p className="text-2xl font-black text-slate-800">#{ticket?.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">Nama Mekanik:</label>
                  <select className="w-full p-4 bg-white text-slate-900 border-2 border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none shadow-sm cursor-pointer" value={mechanic} onChange={e => setMechanic(e.target.value)}>
                      {mechanics.map((m: any) => <option key={m.id} value={m.name} className="bg-white text-slate-900">{m.name}</option>)}
                  </select>
                </div>
                <button onClick={() => { onAssign(ticket.id, mechanic); onClose(); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95">
                    <UserCog size={20} />
                    Mulai Pengerjaan
                </button>
            </div>
        </ModalBase>
    );
};

// 4. Pending Reasons
export const PendingModal = ({ isOpen, onClose, ticket, onConfirm }: any) => {
    const reasons = ["Menunggu Sparepart", "Menunggu Persetujuan Pelanggan", "Istirahat / Ganti Shift"];
    return (
        <ModalBase title="Tunda Pengerjaan" isOpen={isOpen} onClose={onClose}>
            <div className="space-y-4">
                <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-tight text-center">Pilih alasan penundaan:</p>
                {reasons.map(r => (
                    <button key={r} onClick={() => { onConfirm(ticket.id, r); onClose(); }} className="w-full text-left p-5 bg-white border-2 border-slate-200 rounded-2xl hover:bg-orange-50 hover:border-orange-400 transition-all group active:scale-95 shadow-sm">
                        <span className="font-black text-slate-700 group-hover:text-orange-700 text-lg uppercase">{r}</span>
                    </button>
                ))}
            </div>
        </ModalBase>
    );
};

// 5. Cancel
export const CancelModal = ({ isOpen, onClose, ticket, onConfirm }: any) => {
    const [reason, setReason] = useState('');
    return (
        <ModalBase title="Batalkan Tiket" isOpen={isOpen} onClose={onClose}>
            <textarea required className="w-full p-4 bg-white text-slate-900 border-2 border-slate-200 rounded-xl mb-6 font-medium focus:ring-2 focus:ring-red-500 outline-none shadow-sm" rows={4} placeholder="Tuliskan alasan pembatalan tiket..." value={reason} onChange={e => setReason(e.target.value)} />
            <button disabled={!reason} onClick={() => { onConfirm(ticket.id, reason); onClose(); setReason(''); }} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl transition-all disabled:opacity-30 active:scale-95">Batalkan Tiket</button>
        </ModalBase>
  );
};