import React, { useState } from 'react';
import { MechanicDefinition, ServiceDefinition } from '../types';
import { Trash2, Plus } from 'lucide-react';

interface SettingsProps {
  mechanics: MechanicDefinition[];
  services: ServiceDefinition[];
  setMechanics: (m: MechanicDefinition[]) => void;
  setServices: (s: ServiceDefinition[]) => void;
}

const Settings: React.FC<SettingsProps> = ({ mechanics, services, setMechanics, setServices }) => {
  const [newMech, setNewMech] = useState('');
  const [newService, setNewService] = useState('');

  const addMechanic = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMech) {
      setMechanics([...mechanics, { id: Date.now().toString(), name: newMech }]);
      setNewMech('');
    }
  };

  const removeMechanic = (id: string) => {
    // Removed native confirm dialog to ensure consistent functionality
    setMechanics(mechanics.filter(m => m.id !== id));
  };

  const addService = (e: React.FormEvent) => {
    e.preventDefault();
    if (newService) {
      setServices([...services, { id: Date.now().toString(), name: newService }]);
      setNewService('');
    }
  };

  const removeService = (id: string) => {
    // Removed native confirm dialog to ensure consistent functionality
    setServices(services.filter(s => s.id !== id));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Pengaturan</h2>
        <p className="text-slate-500">Kelola daftar mekanik dan jenis layanan</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Mechanics Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Daftar Mekanik</h3>
          
          <ul className="space-y-2 mb-6">
            {mechanics.map(mech => (
              <li key={mech.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                <span className="font-medium text-slate-700">{mech.name}</span>
                <button 
                  type="button"
                  onClick={() => removeMechanic(mech.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  title="Hapus Mekanik"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={addMechanic} className="flex gap-2">
            <input 
              type="text" 
              value={newMech}
              onChange={(e) => setNewMech(e.target.value)}
              placeholder="Nama Mekanik Baru"
              className="flex-1 p-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button type="submit" className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700">
              <Plus size={20} />
            </button>
          </form>
        </div>

        {/* Services Section */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Jenis Layanan</h3>
          
          <ul className="space-y-2 mb-6">
            {services.map(svc => (
              <li key={svc.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-200 transition-colors">
                <span className="font-medium text-slate-700">{svc.name}</span>
                <button 
                  type="button"
                  onClick={() => removeService(svc.id)}
                  className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  title="Hapus Layanan"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={addService} className="flex gap-2">
            <input 
              type="text" 
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
              placeholder="Nama Layanan Baru"
              className="flex-1 p-2 bg-white text-slate-900 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button type="submit" className="bg-brand-dark text-white p-2 rounded-lg hover:bg-slate-700">
              <Plus size={20} />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Settings;