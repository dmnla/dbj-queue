
import React, { useState } from 'react';
import { StorageSlot, Customer } from '../types';
import { Warehouse, Clock, Bike, CheckCircle, AlertTriangle } from 'lucide-react';
import { StorageCheckInModal, StorageActionModal, StorageReturnModal, StorageHistoryModal } from '../components/Modals';
import { checkInStorage, updateStorageSlot } from '../services/ticketService';

interface StorageModeProps {
  slots: StorageSlot[];
  customers: Customer[];
}

const StorageMode: React.FC<StorageModeProps> = ({ slots, customers }) => {
  const [checkInModal, setCheckInModal] = useState<{ isOpen: boolean; slotId: string }>({ isOpen: false, slotId: '' });
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; slot: StorageSlot | null }>({ isOpen: false, slot: null });
  const [returnModal, setReturnModal] = useState<{ isOpen: boolean; slot: StorageSlot | null }>({ isOpen: false, slot: null });
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; slot: StorageSlot | null }>({ isOpen: false, slot: null });

  // Handle Slot Click
  const handleSlotClick = (slot: StorageSlot) => {
      if (slot.status === 'vacant') {
          setCheckInModal({ isOpen: true, slotId: slot.id });
      } else if (slot.status === 'occupied') {
          setActionModal({ isOpen: true, slot });
      } else if (slot.status === 'on_ride') {
          setReturnModal({ isOpen: true, slot });
      }
  };

  // Check In
  const handleCheckIn = (customer: any, bike: string, startDate: string, endDate: string, notes: string, photo?: string) => {
      checkInStorage(checkInModal.slotId, customer, bike, startDate, endDate, notes, photo);
  };

  // Actions
  const handleRide = (slotId: string) => {
      updateStorageSlot(slotId, { status: 'on_ride' }, 'ride_out');
  };
  const handleCheckout = (slotId: string) => {
      updateStorageSlot(slotId, { 
          status: 'vacant', 
          customerId: undefined, 
          customerName: undefined, 
          customerPhone: undefined,
          bikeModel: undefined,
          inDate: undefined,
          expiryDate: undefined,
          notes: undefined
      }, 'checkout');
  };
  const handleReturn = (slotId: string, photo?: string) => {
      updateStorageSlot(slotId, { status: 'occupied' }, 'ride_return', photo);
  };

  const isOverdue = (dateStr?: string) => {
      if (!dateStr) return false;
      return new Date(dateStr) < new Date();
  };

  const getSlotColor = (slot: StorageSlot) => {
      if (slot.status === 'vacant') return 'bg-slate-100 border-slate-200 text-slate-400 hover:border-slate-300';
      if (slot.status === 'on_ride') return 'bg-yellow-50 border-yellow-300 text-yellow-800 hover:border-yellow-400';
      
      // Occupied
      if (isOverdue(slot.expiryDate)) return 'bg-red-50 border-red-500 text-red-900 animate-pulse';
      return 'bg-white border-purple-500 text-slate-800 shadow-md hover:shadow-lg';
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-20">
      
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
         <div>
            <h1 className="text-3xl font-black text-slate-800 uppercase italic flex items-center gap-3">
                <Warehouse className="text-purple-600" size={32} />
                Bike Storage Unit
            </h1>
            <p className="text-slate-500 font-bold">PIK 2 Branch - 30 Slots Capacity</p>
         </div>
         <div className="flex gap-4 text-xs font-bold uppercase">
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-200 rounded-full"></div> Vacant</div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border border-purple-500 rounded-full"></div> Stored</div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-100 border border-yellow-400 rounded-full"></div> On Ride</div>
             <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-100 border border-red-500 rounded-full"></div> Expired</div>
         </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {slots.map(slot => (
              <div 
                key={slot.id}
                onClick={() => handleSlotClick(slot)}
                className={`relative h-40 rounded-2xl border-2 p-3 flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${getSlotColor(slot)}`}
              >
                  <div className="flex justify-between items-start">
                      <span className="font-mono text-xl font-black opacity-50">{slot.id}</span>
                      {slot.status === 'occupied' && <Bike size={16} className="text-purple-500" />}
                      {slot.status === 'on_ride' && <Clock size={16} className="text-yellow-600" />}
                      {isOverdue(slot.expiryDate) && slot.status === 'occupied' && <AlertTriangle size={16} className="text-red-600" />}
                  </div>

                  {slot.status === 'vacant' ? (
                      <div className="self-center text-xs font-bold uppercase tracking-widest opacity-30">Available</div>
                  ) : (
                      <div className="mt-2">
                          <p className="font-black text-sm line-clamp-1 leading-tight">{slot.customerName}</p>
                          <p className="text-xs font-bold opacity-70 line-clamp-1 mb-2">{slot.bikeModel}</p>
                          
                          {slot.status !== 'on_ride' && (
                             <div className="text-[10px] bg-black/5 p-1 rounded font-mono">
                                Exp: {new Date(slot.expiryDate!).toLocaleDateString('id-ID', {day:'numeric', month:'numeric'})}
                             </div>
                          )}
                          {slot.status === 'on_ride' && (
                              <div className="text-[10px] bg-yellow-200/50 p-1 rounded font-bold uppercase text-center text-yellow-800">
                                  Sedang Dipakai
                              </div>
                          )}
                      </div>
                  )}
              </div>
          ))}
      </div>

      {/* Modals */}
      <StorageCheckInModal 
        isOpen={checkInModal.isOpen} 
        onClose={() => setCheckInModal({isOpen: false, slotId: ''})} 
        slotId={checkInModal.slotId}
        customers={customers}
        onConfirm={handleCheckIn}
      />

      <StorageActionModal 
        isOpen={actionModal.isOpen}
        onClose={() => setActionModal({isOpen: false, slot: null})}
        slot={actionModal.slot}
        onRide={() => handleRide(actionModal.slot!.id)}
        onCheckout={() => handleCheckout(actionModal.slot!.id)}
        onViewHistory={() => setHistoryModal({isOpen: true, slot: actionModal.slot})}
      />

      <StorageReturnModal 
        isOpen={returnModal.isOpen}
        onClose={() => setReturnModal({isOpen: false, slot: null})}
        slot={returnModal.slot}
        onConfirm={(photo: string) => handleReturn(returnModal.slot!.id, photo)}
      />

      <StorageHistoryModal 
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({isOpen: false, slot: null})}
        slot={historyModal.slot}
      />

    </div>
  );
};

export default StorageMode;
