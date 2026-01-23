import { db } from './firebaseConfig';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
  runTransaction,
  writeBatch,
  getDocs
} from 'firebase/firestore';
import { Ticket, MechanicDefinition, ServiceDefinition, TicketStatus, Branch } from "../types";

// --- Collection References ---
const ticketsRef = collection(db, 'tickets');
const mechanicsRef = collection(db, 'mechanics');
const servicesRef = collection(db, 'services');

// --- Subscriptions (Real-time Read) ---

export const subscribeToTickets = (onUpdate: (tickets: Ticket[]) => void) => {
  // Order by arrival time descending
  const q = query(ticketsRef, orderBy('timestamps.arrival', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Will now be "1", "2", etc.
        branch: data.branch,
        customerName: data.customerName,
        unitSepeda: data.unitSepeda,
        phone: data.phone,
        serviceTypes: data.serviceTypes,
        mechanic: data.mechanic,
        status: data.status,
        notes: data.notes,
        cancellationReason: data.cancellationReason,
        timestamps: data.timestamps
      } as Ticket;
    });
    onUpdate(tickets);
  }, (error) => {
    console.error("Error subscribing to tickets:", error);
  });
};

export const subscribeToMechanics = (onUpdate: (mechanics: MechanicDefinition[]) => void) => {
  return onSnapshot(mechanicsRef, (snapshot) => {
    const mechanics = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        branches: data.branches || ['mk', 'pik']
      };
    });
    onUpdate(mechanics);
  });
};

export const subscribeToServices = (onUpdate: (services: ServiceDefinition[]) => void) => {
  return onSnapshot(servicesRef, (snapshot) => {
    const services = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        branches: data.branches || ['mk', 'pik']
      };
    });
    onUpdate(services);
  });
};

// --- Cloud Actions (Write) ---

export const addTicketToCloud = async (
  branch: Branch,
  customerName: string,
  phone: string,
  unitSepeda: string,
  serviceTypes: string[],
  notes: string
) => {
  const counterRef = doc(db, 'settings', 'ticketCounter');

  try {
    await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      
      let nextId = 1;
      if (counterDoc.exists()) {
        nextId = counterDoc.data().count + 1;
      }

      // 1. Increment the counter
      transaction.set(counterRef, { count: nextId });

      // 2. Create the ticket with the custom ID (e.g., "101")
      const ticketId = String(nextId);
      const ticketRef = doc(db, 'tickets', ticketId);

      const newTicket = {
        branch,
        customerName,
        unitSepeda,
        phone,
        serviceTypes,
        mechanic: null,
        status: 'waiting',
        notes,
        timestamps: {
          arrival: new Date().toISOString(),
          called: null,
          ready: null,
          finished: null
        }
      };

      transaction.set(ticketRef, newTicket);
    });
  } catch (e) {
    console.error("Transaction failed: ", e);
  }
};

export const updateTicketStatusInCloud = async (
  id: string, 
  currentTicket: Ticket, 
  status: TicketStatus, 
  mechanic?: string, 
  notes?: string, 
  reason?: string
) => {
  const ticketDocRef = doc(db, 'tickets', id);
  const ts = { ...currentTicket.timestamps };
  
  if (status === 'active' && currentTicket.status === 'waiting') ts.called = new Date().toISOString();
  if (status === 'ready') ts.ready = new Date().toISOString();
  if (status === 'done') ts.finished = new Date().toISOString();

  const updates: any = {
    status,
    timestamps: ts
  };

  if (mechanic !== undefined) updates.mechanic = mechanic;
  if (notes !== undefined) updates.notes = notes;
  if (reason !== undefined) updates.cancellationReason = reason;

  await updateDoc(ticketDocRef, updates);
};

export const updateTicketServicesInCloud = async (id: string, serviceTypes: string[]) => {
  const ticketDocRef = doc(db, 'tickets', id);
  await updateDoc(ticketDocRef, { serviceTypes });
};

// --- Settings Management ---

export const addMechanicToCloud = async (name: string, branches: Branch[]) => {
  await addDoc(mechanicsRef, { name, branches });
};

export const updateMechanicInCloud = async (id: string, name: string, branches: Branch[]) => {
  const docRef = doc(db, 'mechanics', id);
  await updateDoc(docRef, { name, branches });
};

export const removeMechanicFromCloud = async (id: string) => {
  await deleteDoc(doc(db, 'mechanics', id));
};

export const addServiceToCloud = async (name: string, branches: Branch[]) => {
  await addDoc(servicesRef, { name, branches });
};

export const updateServiceInCloud = async (id: string, name: string, branches: Branch[]) => {
  const docRef = doc(db, 'services', id);
  await updateDoc(docRef, { name, branches });
};

export const removeServiceFromCloud = async (id: string) => {
  await deleteDoc(doc(db, 'services', id));
};

export const resetDatabase = async () => {
  if (!window.confirm("PERINGATAN: Ini akan menghapus SEMUA tiket dan mereset nomor antrian kembali ke 1. Apakah Anda yakin?")) return;

  try {
    const batch = writeBatch(db);
    
    // 1. Get all tickets
    const snapshot = await getDocs(collection(db, 'tickets'));
    snapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });

    // 2. Reset Counter
    const counterRef = doc(db, 'settings', 'ticketCounter');
    batch.set(counterRef, { count: 0 });

    await batch.commit();
    alert("Database berhasil direset. Nomor tiket berikutnya akan dimulai dari 1.");
    window.location.reload();
  } catch (error) {
    console.error("Error resetting DB:", error);
    alert("Gagal mereset database. Cek console untuk detail.");
  }
};

// --- Helpers ---
export const formatTime = (isoString: string | null): string => {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('id-ID', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  }).replace(',', '');
};

export const calculateWaitTime = (arrival: string, called: string | null): string => {
  if (!called) return '-';
  const diffMs = new Date(called).getTime() - new Date(arrival).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  return `${diffMins} min`;
};