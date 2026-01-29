
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Search, ChevronDown, Check, UserCog, User, Phone, Bike, Calendar, Camera, History, Image as ImageIcon } from 'lucide-react';
import { Ticket, Customer, StorageSlot, StorageLog } from '../types';
import { formatTime } from '../services/ticketService';

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
        <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
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

const inputClass = "w-full p-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium transition-all shadow-sm placeholder:text-slate-400";

// --- CUSTOMER SEARCH COMPONENT ---
export const CustomerSearchInput = ({ 
    customers, 
    onSelect, 
    onClear 
}: { 
    customers: Customer[], 
    onSelect: (c: Customer) => void,
    onClear: () => void 
}) => {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    
    const filtered = useMemo(() => {
        if (!query) return [];
        const lowerQ = query.toLowerCase();
        return customers.filter(c => c.name.toLowerCase().includes(lowerQ) || c.phone.includes(lowerQ)).slice(0, 5);
    }, [customers, query]);

    const handleSelect = (c: Customer) => {
        setQuery(c.name);
        onSelect(c);
        setIsFocused(false);
    };

    return (
        <div className="relative">
             <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Cari Pelanggan</label>
             <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                 <input 
                    type="text" 
                    className={`${inputClass} pl-10`} 
                    placeholder="Ketik nama atau no. telepon..."
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); onClear(); }}
                    onFocus={() => setIsFocused(true)}
                 />
                 {query && (
                    <button onClick={() => { setQuery(''); onClear(); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X size={16} />
                    </button>
                 )}
             </div>
             
             {isFocused && query && (
                 <div className="absolute z-50 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-xl overflow-hidden">
                     {filtered.length > 0 ? (
                         filtered.map(c => (
                             <button 
                                key={c.id} 
                                type="button" 
                                onClick={() => handleSelect(c)}
                                className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-slate-100 last:border-0"
                             >
                                 <div className="font-bold text-slate-800">{c.name}</div>
                                 <div className="text-xs text-slate-500 flex gap-2">
                                     <span>{c.phone}</span>
                                     <span>• {c.bikes.length} Sepeda</span>
                                 </div>
                             </button>
                         ))
                     ) : (
                         <div className="p-4 text-center text-slate-500 text-sm">
                             Pelanggan baru? Isi formulir di bawah.
                         </div>
                     )}
                 </div>
             )}
        </div>
    );
};

// 1. Tambah Tiket (Formerly AddCustomerModal)
export const CreateTicketModal = ({ isOpen, onClose, services, customers, onAdd }: any) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [unit, setUnit] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const serviceNames = useMemo(() => services.map((s: any) => s.name), [services]);

  // When customer selected, auto-fill
  const handleSelectCustomer = (c: Customer) => {
      setSelectedCustomer(c);
      setName(c.name);
      setPhone(c.phone);
      // If customer has only 1 bike, auto select it
      if (c.bikes.length === 1) setUnit(c.bikes[0]);
      else setUnit(''); 
  };

  const handleClearCustomer = () => {
      setSelectedCustomer(null);
      // Don't clear name immediately to allow "New Customer" typing
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && selectedServices.length > 0 && unit) {
      onAdd(name, phone, unit, selectedServices, notes, selectedCustomer?.id);
      onClose();
      // Reset
      setName(''); setPhone(''); setUnit(''); setSelectedServices([]); setNotes(''); setSelectedCustomer(null);
    }
  };

  return (
    <ModalBase title="Buat Tiket Baru" isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Search Existing */}
        <CustomerSearchInput customers={customers} onSelect={handleSelectCustomer} onClear={handleClearCustomer} />

        {/* Divider */}
        <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-xs font-bold text-slate-400 uppercase">Detail Tiket</span>
            <div className="flex-grow border-t border-slate-200"></div>
        </div>

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
              {selectedCustomer && selectedCustomer.bikes.length > 0 ? (
                  <div className="relative">
                      <input 
                         type="text" 
                         list="bike-options" 
                         className={inputClass} 
                         value={unit} 
                         onChange={e => setUnit(e.target.value)} 
                         placeholder="Pilih atau ketik baru..."
                      />
                      <datalist id="bike-options">
                          {selectedCustomer.bikes.map(b => <option key={b} value={b} />)}
                      </datalist>
                  </div>
              ) : (
                  <input required type="text" className={inputClass} placeholder="Contoh: Brompton M6L" value={unit} onChange={e => setUnit(e.target.value)} />
              )}
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
    const [notes, setNotes] = useState('');
    const serviceNames = useMemo(() => services.map((s: any) => s.name), [services]);

    useEffect(() => {
        if (ticket) {
            setSelectedServices(ticket.serviceTypes);
            setNotes(ticket.notes || '');
        }
    }, [ticket]);

    const handleSave = () => {
        if (ticket && selectedServices.length > 0) {
            onUpdate(ticket.id, selectedServices, notes);
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
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">Daftar Layanan:</label>
                    <MultiSearchableSelect options={serviceNames} selectedValues={selectedServices} onChange={setSelectedServices} placeholder="Pilih layanan..." />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase">Catatan:</label>
                    <textarea 
                        className={inputClass} 
                        rows={3} 
                        placeholder="Update catatan..." 
                        value={notes} 
                        onChange={e => setNotes(e.target.value)} 
                    />
                </div>
                <button onClick={handleSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Simpan Perubahan</button>
            </div>
        </ModalBase>
    );
};

// 3. Assign Mechanic
export const AssignMechanicModal = ({ isOpen, onClose, ticket, mechanics, onAssign }: any) => {
    const [mechanic, setMechanic] = useState('');

    useEffect(() => {
        if (isOpen && mechanics && mechanics.length > 0) {
            setMechanic(mechanics[0].name);
        }
    }, [isOpen, mechanics]);

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

// --- STORAGE MODALS ---

const PhotoUpload = ({ onPhotoSelect }: { onPhotoSelect: (base64: string) => void }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setPreview(base64);
                onPhotoSelect(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:bg-slate-50 transition-colors h-32 relative overflow-hidden"
        >
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            {preview ? (
                <img src={preview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <>
                    <Camera size={24} />
                    <span className="text-[10px] font-bold mt-2 uppercase">Upload Foto</span>
                </>
            )}
        </div>
    );
};

// 6. Check In Modal
export const StorageCheckInModal = ({ isOpen, onClose, slotId, customers, onConfirm }: any) => {
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [bike, setBike] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);

    const handleSelectCustomer = (c: Customer) => {
        setSelectedCustomer(c);
        setName(c.name);
        setPhone(c.phone);
        if (c.bikes.length === 1) setBike(c.bikes[0]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Construct object conditionally
        const customerData: any = { name, phone, bikes: [bike] };
        if (selectedCustomer?.id) {
            customerData.id = selectedCustomer.id;
        }

        onConfirm(customerData, bike, startDate, endDate, notes, photo);
        
        onClose();
        // Reset form
        setName(''); setPhone(''); setBike(''); setNotes(''); setPhoto(null); setSelectedCustomer(null);
    };

    return (
        <ModalBase title={`Storage Check-In: ${slotId}`} isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                 <CustomerSearchInput customers={customers} onSelect={handleSelectCustomer} onClear={() => setSelectedCustomer(null)} />
                 
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nama</label>
                         <input required value={name} onChange={e => setName(e.target.value)} className={inputClass} />
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Telepon</label>
                         <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
                     </div>
                 </div>

                 <div className="grid grid-cols-3 gap-4">
                     <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Sepeda</label>
                        {selectedCustomer && selectedCustomer.bikes.length > 0 ? (
                            <input list="bikes" required value={bike} onChange={e => setBike(e.target.value)} className={inputClass} placeholder="Pilih sepeda..." />
                        ) : (
                            <input required value={bike} onChange={e => setBike(e.target.value)} className={inputClass} placeholder="Model Sepeda" />
                        )}
                        {selectedCustomer && (
                            <datalist id="bikes">
                                {selectedCustomer.bikes.map(b => <option key={b} value={b} />)}
                            </datalist>
                        )}
                     </div>
                     <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Kondisi Awal</label>
                        <PhotoUpload onPhotoSelect={setPhoto} />
                     </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                     <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Mulai Kontrak</label>
                         <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
                     </div>
                     <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Selesai Kontrak</label>
                         <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
                     </div>
                 </div>

                 <div>
                     <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Catatan / Defect List</label>
                     <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputClass} rows={2} placeholder="Lecet di frame, dll..." />
                 </div>

                 <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold uppercase shadow-lg">
                     Simpan & Check-In
                 </button>
            </form>
        </ModalBase>
    );
};

// 7. Action Modal
export const StorageActionModal = ({ isOpen, onClose, slot, onRide, onCheckout, onViewHistory }: any) => {
    return (
        <ModalBase title={`Menu Slot ${slot?.id}`} isOpen={isOpen} onClose={onClose}>
            <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border mb-4">
                    <h3 className="font-bold text-lg">{slot?.customerName}</h3>
                    <p className="text-slate-500">{slot?.bikeModel}</p>
                    <p className="text-xs mt-2 text-slate-400">Exp: {new Date(slot?.expiryDate).toLocaleDateString()}</p>
                </div>

                <button onClick={() => { onRide(); onClose(); }} className="w-full p-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-xl font-black uppercase flex items-center justify-center gap-3 shadow-sm">
                    <Bike size={24} />
                    Unit Keluar (Ride)
                </button>
                
                <button onClick={() => { onViewHistory(); onClose(); }} className="w-full p-4 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-xl font-black uppercase flex items-center justify-center gap-3 shadow-sm">
                    <History size={24} />
                    Riwayat / Log
                </button>

                <button onClick={() => { onCheckout(); onClose(); }} className="w-full p-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-black uppercase flex items-center justify-center gap-3 shadow-sm">
                    <Check size={24} />
                    Selesai Kontrak (Checkout)
                </button>
            </div>
        </ModalBase>
    );
};

// 8. Return Modal
export const StorageReturnModal = ({ isOpen, onClose, slot, onConfirm }: any) => {
    const [photo, setPhoto] = useState<string | null>(null);

    return (
        <ModalBase title="Unit Kembali" isOpen={isOpen} onClose={onClose}>
            <div className="text-center space-y-6 py-4">
                <p className="text-slate-600">Konfirmasi unit <strong>{slot?.bikeModel}</strong> milik <strong>{slot?.customerName}</strong> telah kembali ke storage?</p>
                
                <PhotoUpload onPhotoSelect={setPhoto} />

                <button onClick={() => { onConfirm(photo); onClose(); setPhoto(null); }} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold uppercase shadow-lg">
                    Konfirmasi Masuk
                </button>
            </div>
        </ModalBase>
    );
};

// 9. History Modal
export const StorageHistoryModal = ({ isOpen, onClose, slot }: { isOpen: boolean, onClose: () => void, slot: StorageSlot | null }) => {
    return (
        <ModalBase title={`Riwayat Slot ${slot?.id}`} isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
            <div className="space-y-4">
                {!slot?.history || slot.history.length === 0 ? (
                    <p className="text-center text-slate-500 italic">Belum ada riwayat.</p>
                ) : (
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-4">
                        {slot.history.slice().reverse().map((log: StorageLog) => (
                            <div key={log.id} className="ml-6 relative">
                                <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                                    log.action === 'check_in' ? 'bg-purple-500' :
                                    log.action === 'ride_out' ? 'bg-yellow-500' :
                                    log.action === 'ride_return' ? 'bg-green-500' : 'bg-slate-500'
                                }`}></div>
                                <div className="flex justify-between items-start">
                                    <div className="text-xs text-slate-400 font-mono mb-1">{formatTime(log.timestamp)}</div>
                                    <div className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                        log.action === 'check_in' ? 'bg-purple-100 text-purple-700' :
                                        log.action === 'ride_out' ? 'bg-yellow-100 text-yellow-700' :
                                        log.action === 'ride_return' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                        {log.action.replace('_', ' ')}
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-1">
                                    {log.notes && <p className="text-sm text-slate-700 italic mb-2">"{log.notes}"</p>}
                                    {log.photo && (
                                        <div className="mt-2">
                                            <img src={log.photo} alt="Bukti" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </ModalBase>
    );
};

// 10. Edit Customer Modal
export const EditCustomerModal = ({ isOpen, onClose, customer, onSave }: any) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [bikes, setBikes] = useState<string[]>([]);
    const [newBike, setNewBike] = useState('');

    useEffect(() => {
        if (customer) {
            setName(customer.name);
            setPhone(customer.phone);
            setBikes(customer.bikes || []);
        }
    }, [customer]);

    const handleAddBike = () => {
        if (newBike && !bikes.includes(newBike)) {
            setBikes([...bikes, newBike]);
            setNewBike('');
        }
    };

    const removeBike = (bike: string) => {
        setBikes(bikes.filter(b => b !== bike));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(customer.id, name, phone, bikes);
        onClose();
    };

    return (
        <ModalBase title="Edit Data Pelanggan" isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nama</label>
                    <input required value={name} onChange={e => setName(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Telepon</label>
                    <input value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Daftar Sepeda</label>
                    <div className="flex gap-2 mb-2">
                        <input 
                            value={newBike} 
                            onChange={e => setNewBike(e.target.value)} 
                            className={`${inputClass} py-2`} 
                            placeholder="Tambah sepeda..." 
                            onKeyDown={(e) => { if(e.key === 'Enter'){ e.preventDefault(); handleAddBike(); }}}
                        />
                        <button type="button" onClick={handleAddBike} className="bg-slate-200 p-2 rounded-xl hover:bg-slate-300">
                            <Check size={20} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {bikes.map(b => (
                            <span key={b} className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-2">
                                {b}
                                <X size={12} className="cursor-pointer hover:text-red-600" onClick={() => removeBike(b)} />
                            </span>
                        ))}
                    </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold uppercase shadow-lg mt-4">
                    Simpan Perubahan
                </button>
            </form>
        </ModalBase>
    );
};
