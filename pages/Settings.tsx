import React, { useState } from 'react';
import { MechanicDefinition, ServiceDefinition, Branch, Customer } from '../types';
import { Trash2, Plus, MapPin, Edit2, Save, X, Check, AlertTriangle, Search, User, RefreshCw } from 'lucide-react';
import { wipeDatabase, resetTicketNumber } from '../services/ticketService';
import { EditCustomerModal } from '../components/Modals';

interface SettingsProps {
  mechanics: MechanicDefinition[];
  services: ServiceDefinition[];
  customers: Customer[]; // Added
  onAddMechanic: (name: string, branches: Branch[]) => void;
  onUpdateMechanic: (id: string, name: string, branches: Branch[]) => void;
  onRemoveMechanic: (id: string) => void;
  onAddService: (name: string, branches: Branch[]) => void;
  onUpdateService: (id: string, name: string, branches: Branch[]) => void;
  onRemoveService: (id: string) => void;
  onUpdateCustomer: (id: string, name: string, phone: string, bikes: string[]) => void; // Added
  onRemoveCustomer: (id: string) => void; // Added
}

interface EditableItemProps { 
  item: { id: string, name: string, branches: Branch[] };
  onSave: (id: string, name: string, branches: Branch[]) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  setEditingId: (id: string | null) => void;
}

const EditableItem: React.FC<EditableItemProps> = ({ 
  item, 
  onSave, 
  onDelete, 
  isEditing, 
  setEditingId 
}) => {
  const [editName, setEditName] = useState(item.name);
  const [editBranches, setEditBranches] = useState<Branch[]>(item.branches);

  const handleSave = () => {
    if (editName && editBranches.length > 0) {
      onSave(item.id, editName, editBranches);
      setEditingId(null);
    }
  };

  const toggleEditBranch = (target: Branch) => {
    if (editBranches.includes(target)) {
      setEditBranches(editBranches.filter(b => b !== target));
    } else {
      setEditBranches([...editBranches, target]);
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-3 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
         <input 
            type="text" 
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full p-2 bg-white border border-blue-300 rounded text-sm font-bold focus:outline-none"
            autoFocus
         />
         <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${editBranches.includes('mk') ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                 {editBranches.includes('mk') && <Check size={12} className="text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={editBranches.includes('mk')} onChange={() => toggleEditBranch('mk')} />
              Muara Karang
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${editBranches.includes('pik') ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-slate-300'}`}>
                 {editBranches.includes('pik') && <Check size={12} className="text-white" />}
              </div>
              <input type="checkbox" className="hidden" checked={editBranches.includes('pik')} onChange={() => toggleEditBranch('pik')} />
              PIK 2
            </label>
         </div>
         <div className="flex gap-2 mt-1">
            <button onClick={handleSave} disabled={!editName || editBranches.length === 0} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
              <Save size={14} /> Simpan
            </button>
            <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">
              <X size={14} /> Batal
            </button>
         </div>
      </div>
    );
  }

  return (
    <li className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors group">
      <div>
          <span className="font-bold text-slate-700 block">{item.name}</span>
          <div className="flex gap-1 mt-1">
            {item.branches.includes('mk') && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase">MK</span>
            )}
            {item.branches.includes('pik') && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold uppercase">PIK</span>
            )}
          </div>
      </div>
      <div className="flex gap-1">
        <button 
          type="button"
          onClick={() => setEditingId(item.id)}
          className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all p-2 rounded-lg"
          title="Edit"
        >
          <Edit2 size={16} />
        </button>
        <button 
          type="button"
          onClick={() => onDelete(item.id)}
          className="text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all p-2 rounded-lg"
          title="Hapus"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
};

const Settings: React.FC<SettingsProps> = ({ 
  mechanics, 
  services,
  customers,
  onAddMechanic, 
  onUpdateMechanic,
  onRemoveMechanic,
  onAddService,
  onUpdateService,
  onRemoveService,
  onUpdateCustomer,
  onRemoveCustomer
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'customers'>('general');

  // Mechanic State
  const [newMech, setNewMech] = useState('');
  const [mechBranches, setMechBranches] = useState<Branch[]>(['mk', 'pik']);
  const [editingMechId, setEditingMechId] = useState<string | null>(null);

  // Service State
  const [newService, setNewService] = useState('');
  const [serviceBranches, setServiceBranches] = useState<Branch[]>(['mk', 'pik']);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  
  // Customer DB State
  const [customerSearch, setCustomerSearch] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Helpers
  const toggleBranch = (
    current: Branch[], 
    setter: React.Dispatch<React.SetStateAction<Branch[]>>, 
    target: Branch
  ) => {
    if (current.includes(target)) {
      setter(current.filter(b => b !== target));
    } else {
      setter([...current, target]);
    }
  };

  const handleAddMechanic = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMech && mechBranches.length > 0) {
      onAddMechanic(newMech, mechBranches);
      setNewMech('');
    }
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (newService && serviceBranches.length > 0) {
      onAddService(newService, serviceBranches);
      setNewService('');
    }
  };
  
  // Customer Filter Logic
  const filteredCustomers = customers.filter(c => {
      const q = customerSearch.toLowerCase();
      return c.name.toLowerCase().includes(q) || 
             c.phone.includes(q) || 
             c.bikes.some(b => b.toLowerCase().includes(q));
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 pb-32">
       {/* Header & Tabs */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
                <h2 className="text-2xl font-bold text-slate-800">Pengaturan System</h2>
                <p className="text-slate-500">Kelola master data bengkel dan pelanggan</p>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    General
                </button>
                <button 
                    onClick={() => setActiveTab('customers')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'customers' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Database Pelanggan
                </button>
            </div>
        </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-6 rounded-lg border-2 border-red-100 space-y-4">
        <h3 className="text-lg font-bold text-red-700 flex items-center gap-2"><AlertTriangle size={20} /> Danger Zone</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between">
                <div>
                    <p className="text-sm font-bold text-slate-700 mb-1">Reset Database (Bersih Total)</p>
                    <p className="text-xs text-slate-500 mb-3">Menghapus <strong>SEMUA</strong> data (Tiket, Pelanggan, Storage) dan mereset sistem dari 0 tanpa data dummy.</p>
                </div>
                <button 
                    onClick={wipeDatabase}
                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                    <Trash2 size={16} /> Hapus Semua Data
                </button>
            </div>

            <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex flex-col justify-between">
                <div>
                    <p className="text-sm font-bold text-slate-700 mb-1">Reset Nomor Tiket</p>
                    <p className="text-xs text-slate-500 mb-3">Hanya mereset counter nomor antrian kembali ke 1. Data tiket yang ada <strong>TIDAK</strong> dihapus.</p>
                </div>
                <button 
                    onClick={resetTicketNumber}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCw size={16} /> Reset Counter
                </button>
            </div>
        </div>
      </div>

      {activeTab === 'general' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Mechanics Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col h-[500px]">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="bg-slate-800 text-white p-1 rounded">
                <MapPin size={14}/>
                </span>
                Daftar Mekanik
            </h3>
            
            <ul className="space-y-2 mb-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {mechanics.map(mech => (
                <EditableItem 
                    key={mech.id} 
                    item={mech} 
                    onSave={onUpdateMechanic} 
                    onDelete={onRemoveMechanic}
                    isEditing={editingMechId === mech.id}
                    setEditingId={setEditingMechId}
                />
                ))}
            </ul>

            <form onSubmit={handleAddMechanic} className="space-y-3 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase">Tambah Baru</p>
                <input 
                type="text" 
                value={newMech}
                onChange={(e) => setNewMech(e.target.value)}
                placeholder="Nama Mekanik..."
                className="w-full p-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                
                <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={mechBranches.includes('mk')} onChange={() => toggleBranch(mechBranches, setMechBranches, 'mk')} className="accent-blue-600 w-4 h-4" />
                    MK
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={mechBranches.includes('pik')} onChange={() => toggleBranch(mechBranches, setMechBranches, 'pik')} className="accent-emerald-600 w-4 h-4" />
                    PIK
                </label>
                </div>

                <button type="submit" disabled={!newMech || mechBranches.length === 0} className="w-full bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <Plus size={20} className="mx-auto" />
                </button>
            </form>
            </div>

            {/* Services Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col h-[500px]">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="bg-slate-800 text-white p-1 rounded">
                <MapPin size={14}/>
                </span>
                Jenis Layanan
            </h3>
            
            <ul className="space-y-2 mb-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                {services.map(svc => (
                <EditableItem 
                    key={svc.id} 
                    item={svc} 
                    onSave={onUpdateService} 
                    onDelete={onRemoveService}
                    isEditing={editingServiceId === svc.id}
                    setEditingId={setEditingServiceId}
                />
                ))}
            </ul>

            <form onSubmit={handleAddService} className="space-y-3 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase">Tambah Baru</p>
                <input 
                type="text" 
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                placeholder="Nama Layanan..."
                className="w-full p-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                
                <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={serviceBranches.includes('mk')} onChange={() => toggleBranch(serviceBranches, setServiceBranches, 'mk')} className="accent-blue-600 w-4 h-4" />
                    MK
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={serviceBranches.includes('pik')} onChange={() => toggleBranch(serviceBranches, setServiceBranches, 'pik')} className="accent-emerald-600 w-4 h-4" />
                    PIK
                </label>
                </div>

                <button type="submit" disabled={!newService || serviceBranches.length === 0} className="w-full bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed">
                <Plus size={20} className="mx-auto" />
                </button>
            </form>
            </div>
        </div>
      ) : (
          // Customer DB Layout
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
            {/* Search Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Cari nama, nomor HP, atau sepeda..." 
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
                {filteredCustomers.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <User size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold">Tidak ada pelanggan ditemukan</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">Nama</th>
                                <th className="px-4 py-3">Telepon</th>
                                <th className="px-4 py-3">Unit Sepeda</th>
                                <th className="px-4 py-3 rounded-r-lg text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCustomers.map(c => (
                                <tr key={c.id} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                            <User size={16} />
                                        </div>
                                        {c.name}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-slate-500">
                                        {c.phone || '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                            {c.bikes.map((b, i) => (
                                                <span key={i} className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-medium">
                                                    {b}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingCustomer(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => { if(window.confirm('Hapus pelanggan ini?')) onRemoveCustomer(c.id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
      )}

      {/* Modals */}
      <EditCustomerModal 
        isOpen={!!editingCustomer} 
        onClose={() => setEditingCustomer(null)} 
        customer={editingCustomer} 
        onSave={onUpdateCustomer} 
      />
    </div>
  );
};

export default Settings;