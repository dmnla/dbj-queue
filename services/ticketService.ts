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
  Timestamp 
} from 'firebase/firestore';
import { Ticket, MechanicDefinition, ServiceDefinition, TicketStatus, Branch } from "../types";

// --- Collection References ---
const ticketsRef = collection(db, 'tickets');
const mechanicsRef = collection(db, 'mechanics');
const servicesRef = collection(db, 'services');

// --- Subscriptions (Real-time Read) ---

export const subscribeToTickets = (onUpdate: (tickets: Ticket[]) => void) => {
  // Order by arrival time descending so newest are easy to find, 
  // though the UI might sort them differently.
  const q = query(ticketsRef, orderBy('timestamps.arrival', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, // Use Firestore Doc ID as the Ticket ID
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
    const mechanics = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));
    onUpdate(mechanics);
  });
};

export const subscribeToServices = (onUpdate: (services: ServiceDefinition[]) => void) => {
  return onSnapshot(servicesRef, (snapshot) => {
    const services = snapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name
    }));
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
  
  await addDoc(ticketsRef, newTicket);
};

export const updateTicketStatusInCloud = async (
  id: string, 
  currentTicket: Ticket, // We pass the current ticket to safely update timestamps based on logic
  status: TicketStatus, 
  mechanic?: string, 
  notes?: string, 
  reason?: string
) => {
  const ticketDocRef = doc(db, 'tickets', id);
  const ts = { ...currentTicket.timestamps };
  
  // Logic to set timestamps based on status change
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

export const addMechanicToCloud = async (name: string) => {
  await addDoc(mechanicsRef, { name });
};

export const removeMechanicFromCloud = async (id: string) => {
  await deleteDoc(doc(db, 'mechanics', id));
};

export const addServiceToCloud = async (name: string) => {
  await addDoc(servicesRef, { name });
};

export const removeServiceFromCloud = async (id: string) => {
  await deleteDoc(doc(db, 'services', id));
};

// --- Helpers (Pure Functions) ---
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