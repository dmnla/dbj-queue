import { Ticket, MechanicDefinition, ServiceDefinition, TicketStatus, Branch, Customer, StorageSlot, StorageStatus, StorageLog } from "../types";
import { INITIAL_DUMMY_DATA, DEFAULT_MECHANICS, DEFAULT_SERVICES } from "../constants";

// --- MOCK DATABASE IMPLEMENTATION ---
// Since no valid Firebase credentials are provided in the environment,
// we are using LocalStorage to simulate a database so the app is fully functional.

const DB_KEY = 'daily-bike-db';

interface DB {
    tickets: Ticket[];
    mechanics: MechanicDefinition[];
    services: ServiceDefinition[];
    customers: Customer[];
    storageSlots: StorageSlot[];
    ticketCounter: number;
}

// --- Helpers ---

const getDb = (): DB => {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
    
    // Initialize with default data if empty
    const initialDb: DB = {
        tickets: INITIAL_DUMMY_DATA,
        mechanics: DEFAULT_MECHANICS,
        services: DEFAULT_SERVICES,
        customers: [],
        storageSlots: [],
        ticketCounter: 2 // Start after dummy data
    };

    // Initialize 30 Storage Slots
    for (let i = 1; i <= 30; i++) {
      const id = `A-${String(i).padStart(2, '0')}`;
      initialDb.storageSlots.push({
        id,
        status: 'vacant',
        lastActivity: new Date().toISOString(),
        history: []
      });
    }

    localStorage.setItem(DB_KEY, JSON.stringify(initialDb));
    return initialDb;
};

const saveDb = (db: DB) => {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    // Dispatch event to update components in real-time (in same tab)
    window.dispatchEvent(new CustomEvent('db-update'));
};

// Simulate network delay for realism
const delay = (ms: number = 300) => new Promise(resolve => setTimeout(resolve, ms));

// --- Subscriptions ---

const createSubscription = <T>(getData: (db: DB) => T, callback: (data: T) => void) => {
    // Initial data
    callback(getData(getDb()));

    const handler = () => {
        callback(getData(getDb()));
    };

    window.addEventListener('db-update', handler);
    // Listen to storage events (cross-tab sync)
    window.addEventListener('storage', (e) => {
        if (e.key === DB_KEY) handler();
    });

    return () => {
        window.removeEventListener('db-update', handler);
        window.removeEventListener('storage', handler);
    };
};

export const subscribeToTickets = (onUpdate: (tickets: Ticket[]) => void) => {
    return createSubscription(
        db => db.tickets.sort((a,b) => new Date(b.timestamps.arrival).getTime() - new Date(a.timestamps.arrival).getTime()), 
        onUpdate
    );
};

export const subscribeToMechanics = (onUpdate: (mechanics: MechanicDefinition[]) => void) => {
    return createSubscription(db => db.mechanics, onUpdate);
};

export const subscribeToServices = (onUpdate: (services: ServiceDefinition[]) => void) => {
    return createSubscription(db => db.services, onUpdate);
};

export const subscribeToCustomers = (onUpdate: (customers: Customer[]) => void) => {
    return createSubscription(db => db.customers.sort((a,b) => a.name.localeCompare(b.name)), onUpdate);
};

export const subscribeToStorage = (onUpdate: (slots: StorageSlot[]) => void) => {
    return createSubscription(
        db => db.storageSlots.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })), 
        onUpdate
    );
};

// --- Actions ---

export const initializeStorageSlots = async () => {
    // handled in getDb() automatically
};

export const addTicketToCloud = async (
  branch: Branch,
  customerName: string,
  phone: string,
  unitSepeda: string,
  serviceTypes: string[],
  notes: string,
  customerId?: string
) => {
    await delay();
    const db = getDb();

    // 1. Handle Customer
    let finalCustomerId = customerId;
    if (!finalCustomerId) {
        // Create new
        finalCustomerId = 'CUST-' + Date.now();
        db.customers.push({
            id: finalCustomerId,
            name: customerName,
            phone,
            bikes: [unitSepeda]
        });
    } else {
        // Update existing bike list
        const cust = db.customers.find(c => c.id === finalCustomerId);
        if (cust && !cust.bikes.includes(unitSepeda)) {
            cust.bikes.push(unitSepeda);
        }
    }

    // 2. Create Ticket
    db.ticketCounter++;
    const ticketId = db.ticketCounter.toString();
    const newTicket: Ticket = {
        id: ticketId,
        branch,
        customerName,
        phone,
        unitSepeda,
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
    db.tickets.push(newTicket);
    saveDb(db);
};

export const updateTicketStatusInCloud = async (
  id: string, 
  currentTicket: Ticket, 
  status: TicketStatus, 
  mechanic?: string, 
  notes?: string, 
  reason?: string
) => {
    const db = getDb();
    const ticket = db.tickets.find(t => t.id === id);
    
    if (ticket) {
        // Timestamp logic
        if (status === 'active' && ticket.status === 'waiting') ticket.timestamps.called = new Date().toISOString();
        if (status === 'ready') ticket.timestamps.ready = new Date().toISOString();
        if (status === 'done') ticket.timestamps.finished = new Date().toISOString();

        ticket.status = status;
        if (mechanic !== undefined) ticket.mechanic = mechanic;
        
        // --- NOTE APPENDING LOGIC (Constraint #3) ---
        if (notes !== undefined) {
             // If status is pending (Tunda), append instead of overwrite
             if (status === 'pending' && ticket.notes) {
                 const timestamp = new Date().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
                 ticket.notes = `${ticket.notes} | [${timestamp}] ${notes}`;
             } else {
                 ticket.notes = notes;
             }
        }
        
        if (reason !== undefined) ticket.cancellationReason = reason;

        saveDb(db);
    }
};

export const updateTicketServicesInCloud = async (id: string, serviceTypes: string[], notes?: string) => {
    const db = getDb();
    const ticket = db.tickets.find(t => t.id === id);
    if (ticket) {
        ticket.serviceTypes = serviceTypes;
        if (notes !== undefined) ticket.notes = notes;
        saveDb(db);
    }
};

// --- Customer Actions ---

export const updateCustomerInCloud = async (id: string, name: string, phone: string, bikes: string[]) => {
    const db = getDb();
    const c = db.customers.find(x => x.id === id);
    if (c) {
        c.name = name;
        c.phone = phone;
        c.bikes = bikes;
        saveDb(db);
    }
};

export const removeCustomerFromCloud = async (id: string) => {
    const db = getDb();
    db.customers = db.customers.filter(x => x.id !== id);
    saveDb(db);
};

// --- Storage Actions ---

export const updateStorageSlot = async (
    slotId: string, 
    updates: Partial<StorageSlot>, 
    logAction?: 'ride_out' | 'ride_return' | 'checkout',
    logPhoto?: string
) => {
    const db = getDb();
    const slot = db.storageSlots.find(s => s.id === slotId);
    if (slot) {
        Object.assign(slot, updates);
        slot.lastActivity = new Date().toISOString();
        
        // Add History Log
        if (logAction) {
            const log: StorageLog = {
                id: Date.now().toString(),
                action: logAction,
                timestamp: new Date().toISOString(),
                notes: updates.notes,
                photo: logPhoto
            };
            if (!slot.history) slot.history = [];
            slot.history.push(log);
        }

        saveDb(db);
    }
};

export const checkInStorage = async (
  slotId: string, 
  customer: Customer | { name: string, phone: string, bikes: string[] },
  bikeModel: string,
  startDate: string,
  endDate: string,
  notes: string,
  photo?: string
) => {
    const db = getDb();

    // 1. Handle Customer
    let customerId: string;
    const inputId = 'id' in customer ? (customer as any).id : undefined;

    if (inputId) {
        customerId = inputId;
        const existing = db.customers.find(c => c.id === customerId);
        if (existing) {
            if (!existing.bikes.includes(bikeModel)) {
                existing.bikes.push(bikeModel);
            }
        }
    } else {
        // Create new
        customerId = 'CUST-' + Date.now();
        db.customers.push({
            id: customerId,
            name: customer.name,
            phone: customer.phone,
            bikes: [bikeModel]
        });
    }

    // 2. Update Slot
    const slot = db.storageSlots.find(s => s.id === slotId);
    if (slot) {
        const inDate = new Date(startDate);
        const expiryDate = new Date(endDate);

        slot.status = 'occupied';
        slot.customerId = customerId;
        slot.customerName = customer.name;
        slot.customerPhone = customer.phone;
        slot.bikeModel = bikeModel;
        slot.inDate = inDate.toISOString();
        slot.expiryDate = expiryDate.toISOString();
        slot.notes = notes;
        slot.lastActivity = inDate.toISOString();

        // Initial History Log
        const log: StorageLog = {
            id: Date.now().toString(),
            action: 'check_in',
            timestamp: inDate.toISOString(),
            notes: notes,
            photo: photo
        };
        slot.history = [log]; // Reset history on new check-in
    }
    
    saveDb(db);
};

// --- Settings ---

export const addMechanicToCloud = async (name: string, branches: Branch[]) => {
    const db = getDb();
    db.mechanics.push({ id: 'MECH-' + Date.now(), name, branches });
    saveDb(db);
};

export const updateMechanicInCloud = async (id: string, name: string, branches: Branch[]) => {
    const db = getDb();
    const m = db.mechanics.find(x => x.id === id);
    if (m) {
        m.name = name;
        m.branches = branches;
        saveDb(db);
    }
};

export const removeMechanicFromCloud = async (id: string) => {
    const db = getDb();
    db.mechanics = db.mechanics.filter(x => x.id !== id);
    saveDb(db);
};

export const addServiceToCloud = async (name: string, branches: Branch[]) => {
    const db = getDb();
    db.services.push({ id: 'SVC-' + Date.now(), name, branches });
    saveDb(db);
};

export const updateServiceInCloud = async (id: string, name: string, branches: Branch[]) => {
    const db = getDb();
    const s = db.services.find(x => x.id === id);
    if (s) {
        s.name = name;
        s.branches = branches;
        saveDb(db);
    }
};

export const removeServiceFromCloud = async (id: string) => {
    const db = getDb();
    db.services = db.services.filter(x => x.id !== id);
    saveDb(db);
};

export const resetDatabase = async () => {
    if (!window.confirm("PERINGATAN: Ini akan menghapus SEMUA data lokal. Apakah Anda yakin?")) return;
    localStorage.removeItem(DB_KEY);
    window.location.reload();
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