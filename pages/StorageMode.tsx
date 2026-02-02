
import React, { useState, useEffect } from 'react';
import { StorageSlot, Customer, StorageRequest } from '../types';
import { Warehouse, Clock, Bike, CheckCircle, AlertTriangle, Inbox, Calendar, UserPlus, GripVertical, Info, X, Tag } from 'lucide-react';
import { StorageCheckInModal, StorageActionModal, StorageReturnModal, StorageHistoryModal, AdjustContractModal, StorageApprovalModal, PhotoGuidanceModal, ConfirmationModal } from '../components/Modals';
import { checkInStorage, updateStorageSlot, adjustStorageContract, subscribeToStorageRequests, approveStorageRequest, moveStorageSlot, deleteStorageRequest } from '../services/ticketService';

interface StorageModeProps {
  slots: StorageSlot[];
  customers: Customer[];
}

const StorageMode: React.FC<StorageModeProps> = ({ slots, customers }) => {
  // Modal States
  const [checkInModal, setCheckInModal] = useState<{ isOpen: boolean; slotId: string }>({ isOpen: false, slotId: '' });
  const [actionModal, setActionModal] = useState<{ isOpen: boolean; slot: StorageSlot | null }>({ isOpen: false, slot: null });
  const [returnModal, setReturnModal] = useState<{ isOpen: boolean; slot: StorageSlot | null }>({ isOpen: false, slot: null });
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean; slot: StorageSlot | null }>({ isOpen: false, slot: null });
  const [extendModal, setExtendModal] = useState<{ isOpen: boolean; slot: StorageSlot | null }>({ isOpen: false, slot: null });
  const [approvalModal, setApprovalModal] = useState<{ isOpen: boolean; request: StorageRequest | null; slotId: string }>({ isOpen: false, request: null, slotId: '' });
  const [guidanceModal, setGuidanceModal] = useState(false);
  const [deleteReqModal, setDeleteReqModal] = useState<{ isOpen: boolean; reqId: string | null }>({ isOpen: false, reqId: null });

  // Incoming Requests State
  const [requests, setRequests] = useState<StorageRequest[]>([]);
  
  // Drag State
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  
  useEffect(() => {
      const unsub = subscribeToStorageRequests(setRequests);
      return () => unsub();
  }, []);

  // --- DRAG AND DROP LOGIC ---
  const handleDragStartRequest = (e: React.DragEvent, request: StorageRequest) => {
      e.dataTransfer.setData("type", "REQUEST");
      e.dataTransfer.setData("id", request.id);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragStartSlot = (e: React.DragEvent, slot: StorageSlot) => {
      if (slot.status === 'vacant') {
          e.preventDefault(); // Cannot drag empty slot
          return;
      }
      e.dataTransfer.setData("type", "SLOT_MOVE");
      e.dataTransfer.setData("id", slot.id);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetSlotId: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragOverSlotId !== targetSlotId) {
          setDragOverSlotId(targetSlotId);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      setDragOverSlotId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetSlot: StorageSlot) => {
      e.preventDefault();
      setDragOverSlotId(null); // Clear drag state immediately

      if (targetSlot.status !== 'vacant') return; 

      const type = e.dataTransfer.getData("type");
      const id = e.dataTransfer.getData("id");

      if (type === "REQUEST") {
          const request = requests.find(r => r.id === id);
          if (request) {
              setApprovalModal({ isOpen: true, request, slotId: targetSlot.id });
          }
      } else if (type === "SLOT_MOVE") {
          try {
             await moveStorageSlot(id, targetSlot.id);
          } catch (err) {
             console.error(err);
             alert("Gagal memindahkan slot. Pastikan slot tujuan kosong.");
          }
      }
  };

  // --- ACTIONS ---
  const handleSlotClick = (slot: StorageSlot) => {
      if (slot.status === 'vacant') {
          setCheckInModal({ isOpen: true, slotId: slot.id });
      } else if (slot.status === 'occupied') {
          setActionModal({ isOpen: true, slot });
      } else if (slot.status === 'on_ride') {
          setReturnModal({ isOpen: true, slot });
      }
  };

  const handleCheckIn = async (customer: any, bike: string, startDate: string, endDate: string, notes: string, photos: any) => {
      try {
          await checkInStorage(checkInModal.slotId, customer, bike, startDate, endDate, notes, photos);
          setCheckInModal({ isOpen: false, slotId: '' });
      } catch (error) {
          console.error("CheckIn Error:", error);
          alert(`Gagal Check-In: ${error}`);
      }
  };

  const handleApprovalConfirm = async (reqId: string, slotId: string, data: any) => {
      // Ensure we have a valid slotId before calling service
      if (!slotId) {
          alert("Error: No slot selected");
          return;
      }
      try {
          await approveStorageRequest(reqId, slotId, data);
          setApprovalModal({ isOpen: false, request: null, slotId: '' });
      } catch (err) {
            console.error("Failed to approve request:", err);
            alert(`Gagal memproses request: ${err}`);
      }
  };

  const handleDeleteRequest = () => {
      if (deleteReqModal.reqId) {
          deleteStorageRequest(deleteReqModal.reqId);
          setDeleteReqModal({ isOpen: false, reqId: null });
      }
  };

  // Robust Handlers for Modal Actions
  const handleRide = async (slotId: string) => {
      if (!slotId) return;
      try {
        await updateStorageSlot(slotId, { status: 'on_ride' }, 'ride_out');
      } catch (error) {
        console.error("Ride Out Error", error);
        alert("Gagal update status.");
      }
  };
  
  const handleCheckout = async (slotId: string) => {
      if (!slotId) return;
      try {
        await updateStorageSlot(slotId, { 
            status: 'vacant', 
            customerId: undefined, 
            customerName: undefined, 
            customerPhone: undefined,
            bikeModel: undefined,
            inDate: undefined,
            expiryDate: undefined,
            notes: undefined,
            photos: undefined,
            storageTicketId: undefined
        }, 'checkout');
      } catch (error) {
        console.error("Checkout Error", error);
        alert("Gagal checkout.");
      }
  };
  
  const handleReturn = (slotId: string, photo?: string, notes?: string) => {
      // Pass notes in updates object so it gets picked up by updateStorageSlot for the log
      // However, we don't want to replace the main slot notes usually?
      // updateStorageSlot uses updates.notes for the log note.
      updateStorageSlot(slotId, { status: 'occupied', notes: notes }, 'ride_return', photo);
  };

  const handleAdjustContract = (slotId: string, start: string, end: string) => adjustStorageContract(slotId, start, end);

  // Helpers
  const isOverdue = (dateStr?: string) => dateStr ? new Date(dateStr) < new Date() : false;
  const getDaysStored = (dateStr?: string) => dateStr ? Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / (1000 * 3600 * 24)) : 0;
  const getDaysOnRide = (slot: StorageSlot) => (slot.status === 'on_ride' && slot.lastActivity) ? Math.floor((new Date().getTime() - new Date(slot.lastActivity).getTime()) / (1000 * 3600 * 24)) : 0;

  const getSlotColor = (slot: StorageSlot) => {
      const isDragTarget = dragOverSlotId === slot.id && slot.status === 'vacant';
      
      // Drag Hover State (Priority)
      if (isDragTarget) {
          return 'bg-purple-50 border-purple-500 scale-105 shadow-xl ring-4 ring-purple-200 z-10';
      }

      if (slot.status === 'vacant') return 'bg-slate-100 border-slate-200 text-slate-400 hover:border-blue-400 hover:bg-blue-50 border-dashed';
      
      if (isOverdue(slot.expiryDate)) return 'bg-red-500 border-red-700 text-white shadow-md animate-pulse';

      if (slot.status === 'on_ride') return 'bg-yellow-50 border-yellow-300 text-yellow-800 hover:border-yellow-400';
      return 'bg-white border-purple-500 text-slate-800 shadow-md hover:shadow-lg';
  };

  return (
    <div className="flex flex-row h-[calc(100vh-80px)] overflow-hidden bg-slate-50">
        
        {/* LEFT SIDEBAR: INCOMING REQUESTS */}
        <div className="w-1/4 min-w-[300px] max-w-[400px] bg-white border-r border-slate-200 flex flex-col z-10 shadow-lg">
            <div className="p-5 border-b border-slate-100 bg-purple-50">
                <h2 className="text-lg font-black text-purple-900 uppercase italic flex items-center gap-2">
                    <Inbox size={20} /> Incoming Request
                </h2>
                <p className="text-xs text-purple-600 font-bold mt-1">Drag card to empty slot</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {requests.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                        <Inbox size={40} className="mx-auto mb-2 text-slate-400" />
                        <p className="text-xs font-bold text-slate-400">No pending requests</p>
                    </div>
                ) : (
                    requests.map(req => (
                        <div 
                            key={req.id}
                            draggable
                            onDragStart={(e) => handleDragStartRequest(e, req)}
                            className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-all hover:border-purple-300 group relative pr-8"
                        >
                            <button 
                                onClick={(e) => { e.stopPropagation(); setDeleteReqModal({ isOpen: true, reqId: req.id }); }}
                                className="absolute top-2 right-2 text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded-full transition-colors z-20"
                            >
                                <X size={16} />
                            </button>

                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded uppercase">
                                    {req.durationMonths} Bulan
                                </span>
                                <GripVertical size={16} className="text-slate-300 group-hover:text-purple-400" />
                            </div>
                            <h3 className="font-black text-slate-800 text-lg">{req.name}</h3>
                            <p className="text-xs font-bold text-slate-500 mb-2">{req.phone}</p>
                            <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <p className="text-sm font-bold text-purple-600 uppercase flex items-center gap-2">
                                    <Bike size={14} /> {req.bikeModel}
                                </p>
                            </div>
                            {req.notes && (
                                <p className="text-[10px] text-slate-400 italic mt-2 line-clamp-2">"{req.notes}"</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* RIGHT SIDE: STORAGE GRID */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center">
                 <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase italic flex items-center gap-3">
                            <Warehouse className="text-purple-600" size={28} />
                            Bike Storage Unit
                        </h1>
                    </div>
                    {/* Guidance Button */}
                    <button 
                        onClick={() => setGuidanceModal(true)}
                        className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-colors"
                    >
                        <Info size={16} /> Panduan Foto
                    </button>
                </div>

                <div className="flex gap-4 text-xs font-bold uppercase bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-200 rounded-full"></div> Vacant</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white border border-purple-500 rounded-full"></div> Stored</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-100 border border-yellow-400 rounded-full"></div> On Ride</div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div> Expired</div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pb-20">
                    {slots.map(slot => {
                        const daysStored = getDaysStored(slot.inDate);
                        const daysRide = getDaysOnRide(slot);
                        const expired = isOverdue(slot.expiryDate);

                        return (
                        <div 
                            key={slot.id}
                            draggable={slot.status === 'occupied'}
                            onDragStart={(e) => handleDragStartSlot(e, slot)}
                            onDragOver={(e) => handleDragOver(e, slot.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, slot)}
                            onClick={() => handleSlotClick(slot)}
                            className={`relative min-h-[160px] rounded-xl border-2 p-4 flex flex-col justify-between cursor-pointer transition-all ${getSlotColor(slot)} ${slot.status === 'occupied' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        >
                            <div className="flex justify-between items-start">
                                <span className={`font-mono text-xl font-black ${expired ? 'opacity-80 text-white' : 'opacity-40'}`}>{slot.id}</span>
                                {slot.status === 'occupied' && <Bike size={18} className={expired ? 'text-white' : 'text-purple-500'} />}
                                {slot.status === 'on_ride' && <Clock size={18} className="text-yellow-600" />}
                                {expired && slot.status === 'occupied' && <AlertTriangle size={18} className="text-white" />}
                            </div>

                            {slot.status === 'vacant' ? (
                                <div className={`self-center text-xs font-bold uppercase tracking-widest pointer-events-none transition-opacity ${dragOverSlotId === slot.id ? 'opacity-100 text-purple-600' : 'opacity-30'}`}>
                                    {dragOverSlotId === slot.id ? 'Drop Here!' : 'Empty'}
                                </div>
                            ) : (
                                <div className="mt-2 flex flex-col h-full justify-end">
                                    {/* Ticket ID Display */}
                                    {slot.storageTicketId && (
                                        <div className="mb-1 flex items-center gap-1 opacity-70">
                                            <Tag size={10} />
                                            <span className="text-[10px] font-mono font-bold uppercase">{slot.storageTicketId}</span>
                                        </div>
                                    )}

                                    <p className={`font-black text-sm line-clamp-1 leading-tight ${expired ? 'text-white' : 'text-slate-800'}`}>{slot.customerName}</p>
                                    <p className={`text-xs font-bold line-clamp-1 mb-2 ${expired ? 'text-red-100' : 'opacity-60'}`}>{slot.bikeModel}</p>
                                    
                                    {slot.status === 'occupied' && (
                                        <div className="space-y-1">
                                            <div className={`text-[10px] p-1.5 rounded flex justify-between font-mono ${expired ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                <span>In: {daysStored}d</span>
                                                <span className={expired ? 'font-bold text-white' : ''}>
                                                    End: {new Date(slot.expiryDate!).toLocaleDateString('id-ID', {day:'numeric', month:'numeric'})}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {slot.status === 'on_ride' && (
                                        <div className="text-[10px] bg-yellow-100 p-1.5 rounded font-bold uppercase text-center text-yellow-800 flex flex-col">
                                            <span>Sedang Dipakai</span>
                                            <span className="text-[9px] mt-0.5">{daysRide} Hari Keluar</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            </div>
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
        onRide={() => { if(actionModal.slot) handleRide(actionModal.slot.id); }}
        onCheckout={() => { if(actionModal.slot) handleCheckout(actionModal.slot.id); }}
        onViewHistory={() => setHistoryModal({isOpen: true, slot: actionModal.slot})}
        onExtend={() => setExtendModal({isOpen: true, slot: actionModal.slot})}
      />

      <StorageReturnModal 
        isOpen={returnModal.isOpen}
        onClose={() => setReturnModal({isOpen: false, slot: null})}
        slot={returnModal.slot}
        onConfirm={(photo: string, notes: string) => handleReturn(returnModal.slot!.id, photo, notes)}
      />

      <StorageHistoryModal 
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({isOpen: false, slot: null})}
        slot={historyModal.slot}
      />

      <AdjustContractModal 
        isOpen={extendModal.isOpen}
        onClose={() => setExtendModal({isOpen: false, slot: null})}
        slot={extendModal.slot}
        onConfirm={handleAdjustContract}
      />

      <StorageApprovalModal 
        isOpen={approvalModal.isOpen}
        onClose={() => setApprovalModal({isOpen: false, request: null, slotId: ''})}
        request={approvalModal.request}
        slotId={approvalModal.slotId}
        onConfirm={handleApprovalConfirm}
      />

      <PhotoGuidanceModal 
        isOpen={guidanceModal}
        onClose={() => setGuidanceModal(false)}
      />

      <ConfirmationModal 
        isOpen={deleteReqModal.isOpen}
        title="Hapus Permintaan?"
        message="Anda yakin ingin menghapus permintaan penitipan ini? Tindakan tidak dapat dibatalkan."
        confirmText="Hapus"
        onClose={() => setDeleteReqModal({ isOpen: false, reqId: null })}
        onConfirm={handleDeleteRequest}
      />
    </div>
  );
};

export default StorageMode;
